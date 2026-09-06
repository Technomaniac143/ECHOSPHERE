"""Service for managing interview sessions."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session, SessionMode, SessionStatus
from app.models.whiteboard import WhiteboardState
from app.models.user import User, UserRole
from app.models.panel import Panel
from app.schemas.interview import InterviewResponse
from app.services.agora.types import AgoraChannelConfig
from app.config import settings
from app.services.agora.token_service import generate_token_for_session
from app.services.agora.conversation_service import start_convo_agent, build_system_message


logger = logging.getLogger("interview-manager")


class InterviewNotFoundError(Exception):
    """Raised when an interview session cannot be found."""
    pass


class InterviewManager:
    """Manages the lifecycle of interview sessions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(
        self,
        *,
        mode: str = "practice",
        panel_id: str | None = None,
        candidate_id: str | None = None,
        target_role: str,
        target_company: str | None = None,
        org_id: str | None = None,
        target_domain: str | None = None,
        persona_list: list[str] | None = None,
        difficulty_seed: dict[str, Any] | None = None,
        interview_duration_minutes: int = 20,
    ) -> Session:
        # Ensure candidate exists in users table to satisfy foreign key constraint
        resolved_candidate_id = candidate_id or "demo-candidate"
        existing_candidate = await self.db.get(User, resolved_candidate_id)
        if not existing_candidate:
            res = await self.db.execute(select(User).limit(1))
            any_user = res.scalar_one_or_none()
            if any_user:
                resolved_candidate_id = any_user.id
            else:
                demo_user = User(
                    id=resolved_candidate_id,
                    email="candidate@echosphere.ai",
                    name="Demo Candidate",
                    role=UserRole.STUDENT,
                )
                self.db.add(demo_user)
                await self.db.flush()

        session = Session(
            mode=SessionMode(mode),
            status=SessionStatus.LOBBY,
            panel_id=panel_id,
            candidate_id=resolved_candidate_id,
            target_role=target_role,
            target_company=target_company,
            target_domain=target_domain,
            persona_list=persona_list or ["technical", "product", "hiring_manager", "behavioral"],
            difficulty_seed=difficulty_seed or {},
            interview_duration_minutes=interview_duration_minutes,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)


        # Initialize whiteboard state
        whiteboard = WhiteboardState(
            session_id=session.id,
            claims=[],
            competency_ledger={},
            open_threads=[],
            contradiction_flags=[],
            vagueness_flags=[],
            difficulty_state={competency: "medium" for competency in ["Technical", "Problem Solving", "Communication", "Product Thinking", "Leadership", "Behavioral", "Adaptability"]},
            strengths=[],
            weaknesses=[],
            evidence=[],
            questions_asked=[],
            current_persona="technical",
            candidate_context={
                "target_role": target_role,
                "target_company": target_company,
                "target_domain": target_domain,
                "mode": mode,
            },
        )
        self.db.add(whiteboard)

        logger.info(f"Created session {session.id} for {target_role} at {target_company}")
        return session

    async def start_session(
        self,
        session_id: str,
        candidate_voiceprint_id: str | None = None,
        initial_persona_system_prompt: str | None = None,
        greeting_text: str | None = None,
        agora_app_id: str | None = None,
    ) -> Session:
        """Start an interview session — provisions Agora channel and ConvoAI agent."""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise InterviewNotFoundError(f"Session not found: {session_id}")

        if session.status != SessionStatus.LOBBY:
            raise ValueError(f"Cannot start session in status {session.status.value}")

        # Update status
        await self.db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(
                status=SessionStatus.IN_PROGRESS,
                started_at=datetime.now(timezone.utc),
            )
        )

        # Create Agora channel and token
        agora_app_id = settings.agora_app_id
        agora_app_certificate = settings.agora_app_certificate
        channel_name = f"echosphere-{session_id}"
        
        token_obj = generate_token_for_session(
            app_id=agora_app_id,
            app_certificate=agora_app_certificate,
            channel_name=channel_name,
            uid=0,
            expiration=3600
        )
        agora_token = token_obj.token

        # Update session with Agora info
        await self.db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(
                agora_channel_name=channel_name,
                agora_token=agora_token,
            )
        )

        # Launch ConvoAI Agent
        try:
            sys_msg = initial_persona_system_prompt or build_system_message(
                persona=session.persona_list[0] if session.persona_list else "technical",
                target_role=session.target_role,
                target_company=session.target_company
            )
            await start_convo_agent(
                channel_name=channel_name,
                token=agora_token,
                agent_name=f"agent-{session_id[:8]}",
                persona_system_prompt=sys_msg,
                greeting_text=greeting_text
            )
        except Exception as e:
            logger.error(f"Failed to start ConvoAI agent for {session_id}: {e}")
            # We don't fail the session start if the agent fails in case it's dev mode

        # Initialize whiteboard with default difficulty
        whiteboard_result = await self.db.execute(
            select(WhiteboardState).where(WhiteboardState.session_id == session_id)
        )
        whiteboard = whiteboard_result.scalar_one_or_none()
        if whiteboard:
            for competency in ["Technical", "Problem Solving", "Communication", "Product Thinking", "Leadership", "Behavioral", "Adaptability"]:
                if competency not in whiteboard.difficulty_state:
                    whiteboard.difficulty_state[competency] = "medium"
            whiteboard.current_persona = "technical"
            whiteboard.candidate_context = {
                "target_role": session.target_role,
                "target_company": session.target_company,
                "target_domain": session.target_domain,
                "mode": session.mode.value,
            }

        logger.info(f"Started session {session_id}, Agora channel: {channel_name}")
        return session

    async def get_session(self, session_id: str) -> Session:
        """Get a session by ID."""
        from sqlalchemy.orm import selectinload
        result = await self.db.execute(
            select(Session)
            .options(selectinload(Session.report))
            .where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise InterviewNotFoundError(f"Session not found: {session_id}")
        return session

    async def end_session(
        self,
        session_id: str,
        reason: str | None = None,
    ) -> Session:
        """End an interview session."""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise InterviewNotFoundError(f"Session not found: {session_id}")

        await self.db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(
                status=SessionStatus.COMPLETED if reason != "abandoned" else SessionStatus.ABANDONED,
                ended_at=datetime.now(timezone.utc),
            )
        )

        logger.info(f"Ended session {session_id} with reason: {reason}")
        return session

    async def get_session_state(self, session_id: str) -> dict[str, Any]:
        """Get the current whiteboard state for a session."""
        result = await self.db.execute(
            select(WhiteboardState).where(WhiteboardState.session_id == session_id)
        )
        whiteboard = result.scalar_one_or_none()
        
        if not whiteboard:
            return {}
        
        return {
            "session_id": session_id,
            "claims": whiteboard.claims or [],
            "competency_ledger": whiteboard.competency_ledger or {},
            "open_threads": whiteboard.open_threads or [],
            "contradiction_flags": whiteboard.contradiction_flags or [],
            "vagueness_flags": whiteboard.vagueness_flags or [],
            "difficulty_state": whiteboard.difficulty_state or {},
            "strengths": whiteboard.strengths or [],
            "weaknesses": whiteboard.weaknesses or [],
            "evidence": whiteboard.evidence or [],
            "questions_asked": whiteboard.questions_asked or [],
            "current_persona": whiteboard.current_persona or "technical",
            "candidate_context": whiteboard.candidate_context or {},
            "updated_at": whiteboard.updated_at.isoformat() if whiteboard.updated_at else None,
        }

    async def adjust_difficulty(
        self,
        session_id: str,
        competency: str,
        level: str,
    ) -> None:
        """Adjust difficulty for a specific competency."""
        result = await self.db.execute(
            select(WhiteboardState).where(WhiteboardState.session_id == session_id)
        )
        whiteboard = result.scalar_one_or_none()
        if not whiteboard:
            raise InterviewNotFoundError(f"Session not found: {session_id}")

        if competency not in whiteboard.difficulty_state:
            whiteboard.difficulty_state[competency] = "medium"

        whiteboard.difficulty_state[competency] = level
        await self.db.commit()

        logger.info(f"Adjusted {competency} difficulty to {level} for session {session_id}")

    async def list_interviews(
        self,
        candidate_id: str | None = None,
        status: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Session]:
        """List interviews, optionally filtered."""
        from sqlalchemy.orm import selectinload
        query = select(Session).options(selectinload(Session.report))

        if candidate_id:
            query = query.where(Session.candidate_id == candidate_id)
        if status:
            try:
                query = query.where(Session.status == SessionStatus(status))
            except (ValueError, KeyError):
                query = query.where(Session.status == status)

        query = query.order_by(Session.created_at.desc())
        if limit is not None and limit > 0:
            query = query.limit(limit)
        if offset is not None and offset > 0:
            query = query.offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_active_sessions(
        self,
        candidate_id: str | None = None,
        org_id: str | None = None,
        mode: str | None = None,
    ) -> list[Session]:
        """List active (in_progress) sessions."""
        query = select(Session).where(Session.status == SessionStatus.IN_PROGRESS)

        if candidate_id:
            query = query.where(Session.candidate_id == candidate_id)
        if org_id:
            query = query.where(Session.org_id == org_id)
        if mode:
            query = query.where(Session.mode == SessionMode(mode))

        query = query.order_by(Session.started_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())


# ── Aliases & Factories ──────────────────────────────────────────────────────

InterviewSession = InterviewManager
SessionStore = InterviewManager
SessionNotFoundError = InterviewNotFoundError


class SessionStateTransitionError(Exception):
    """Invalid session state transition."""
    pass


class SessionAlreadyStartedError(Exception):
    """Session already started."""
    pass


class SessionAlreadyEndedError(Exception):
    """Session already ended."""
    pass


def create_interview_manager(db: AsyncSession) -> InterviewManager:
    """Create an InterviewManager instance."""
    return InterviewManager(db)
