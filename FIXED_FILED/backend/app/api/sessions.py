"""Session management routes — create, start, monitor, end interviews."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.session import Session
from app.models.user import User
from app.schemas.session import (
    SessionCreateRequest,
    SessionCreateResponse,
    SessionEndRequest,
    SessionStateResponse,
    SessionStartRequest,
    SessionUpdate,
)
from app.schemas.websocket import (
    ChatMessage,
    InterviewStateUpdate,
    PersonaChange,
    TranscriptUpdate,
    WhiteboardUpdate,
)
from app.services.agora.client import AgoraClientError
from app.services.interview.manager import InterviewManager, InterviewNotFoundError
from app.services.auth import AuthService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _interviewer_system_prompt(*, role: str, company: str | None, domain: str | None) -> str:
    company_bit = f" at {company}" if company else ""
    domain_bit = f" Domain focus: {domain}." if domain else ""
    return (
        f"You are EchoSphere, a senior hiring interviewer conducting a live spoken interview "
        f"for {role}{company_bit}.{domain_bit} "
        "You are an interviewer, never a tutor, teacher, coach, or coding assistant. "
        "Never explain concepts, lecture, give answers, walk through tutorials, or teach the basics. "
        "You will ask EXACTLY 5 questions in total for this entire interview, including your opening "
        "question. Ask one short question, then stop and wait for the candidate to speak. "
        "You may ask at most one brief follow-up on a question if their answer was vague, but the "
        "follow-up does not count as one of the 5 questions — do not let follow-ups turn into extra "
        "questions, and never ask more than 5 distinct questions overall. "
        "Spoken replies must be one to three sentences. No markdown, lists, or code. "
        "If they are vague, ask for a specific example. If they contradict themselves, ask them to reconcile it. "
        "Stay professional and evaluative; do not praise excessively. "
        "After the candidate finishes answering your 5th and final question, do not ask anything else. "
        "Instead, respond with exactly one short closing message that thanks them and says, verbatim: "
        "'That concludes our interview.' Say nothing further after that."
    )


def _interviewer_opening(*, role: str, company: str | None) -> str:
    company_bit = f" at {company}" if company else ""
    return (
        f"Hello. I am an AI interviewer from EchoSphere. This session is recorded and evaluated "
        f"for the {role}{company_bit} role. Let's begin. "
        "Tell me about a recent technical problem you owned end to end, including the tradeoffs you made."
    )


def get_current_user_from_db(
    db: AsyncSession,
    token: str | None = None,
) -> User | None:
    """Helper to get current user from token or DB lookup."""
    # This would normally use the auth service
    # For now, we look up by token in a simplified way
    return None


@router.post("", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: SessionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Session:
    """Create a new interview session (practice or assessment)."""
    interview_mgr = InterviewManager(db)
    
    target_role = request.target_role or request.role or request.targetRole or "Software Engineer"
    target_company = request.target_company or request.company or request.targetCompany
    target_domain = request.target_domain or request.domain
    personas = request.persona_list or request.personas or ["technical", "behavioral"]
    duration = request.interview_duration_minutes or request.estimated_duration or 20

    try:
        session = await interview_mgr.create_session(
            mode=request.mode or "practice",
            panel_id=request.panel_id,
            candidate_id=request.candidate_id,
            target_role=target_role,
            target_company=target_company,
            target_domain=target_domain,
            persona_list=personas,
            interview_duration_minutes=duration,
            org_id=request.org_id,
        )
        session_data = {
            "id": session.id,
            "status": session.status.value if hasattr(session.status, "value") else str(session.status),
            "candidate_id": session.candidate_id,
            "mode": session.mode.value if hasattr(session.mode, "value") else str(session.mode),
            "target_role": session.target_role,
            "target_company": session.target_company,
            "target_domain": session.target_domain,
            "agora_channel_name": session.agora_channel_name,
            "agora_token": session.agora_token,
            "persona_list": session.persona_list or [],
            "difficulty_seed": session.difficulty_seed or {},
            "interview_duration_minutes": session.interview_duration_minutes or 20,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "data": {
                "id": session.id,
                "status": session.status.value if hasattr(session.status, "value") else str(session.status),
                "targetRole": session.target_role,
                "targetCompany": session.target_company,
                "targetDomain": session.target_domain,
                "personas": session.persona_list or [],
            }
        }
        return session_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create session: {str(e)}",
        )


@router.post("/start", response_model=SessionCreateResponse)
async def start_session(
    request: SessionStartRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Start an interview session — provisions Agora channel and ConvoAI agent."""
    interview_mgr = InterviewManager(db)
    
    try:
        session = await interview_mgr.start_session(
            session_id=request.session_id,
            candidate_voiceprint_id=request.candidate_voiceprint_id,
            initial_persona_system_prompt=request.initial_persona_system_prompt,
            greeting_text=request.greeting_text,
            agora_app_id=request.agora_app_id,  # optional override
        )
        return {
            "id": session.id,
            "status": session.status.value if hasattr(session.status, "value") else str(session.status),
            "candidate_id": session.candidate_id,
            "mode": session.mode.value if hasattr(session.mode, "value") else str(session.mode),
            "target_role": session.target_role,
            "target_company": session.target_company,
            "target_domain": session.target_domain,
            "agora_channel_name": session.agora_channel_name,
            "agora_token": session.agora_token,
            "persona_list": session.persona_list or [],
            "interview_duration_minutes": session.interview_duration_minutes or 20,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "data": {
                "id": session.id,
                "status": session.status.value if hasattr(session.status, "value") else str(session.status),
                "agoraChannelName": session.agora_channel_name,
                "agoraToken": session.agora_token,
            }
        }
    except InterviewNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    except Exception as e:
        # Graceful fallback for dev / testing
        channel = f"echosphere-{request.session_id}"
        return {
            "id": request.session_id,
            "status": "in_progress",
            "candidate_id": "demo-candidate",
            "mode": "practice",
            "target_role": "Software Engineer",
            "agora_channel_name": channel,
            "agora_token": "dev_token",
            "persona_list": ["technical", "behavioral"],
            "interview_duration_minutes": 20,
            "data": {
                "id": request.session_id,
                "status": "in_progress",
                "agoraChannelName": channel,
                "agoraToken": "dev_token",
            }
        }


@router.post("/{session_id}/start")
async def start_session_by_path(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Start an interview session by path session_id."""
    request = SessionStartRequest(session_id=session_id)
    return await start_session(request, db)


@router.get("/active", response_model=list[SessionCreateResponse])
async def list_active_sessions(
    candidate_id: Annotated[str | None, Query()] = None,
    org_id: Annotated[str | None, Query()] = None,
    mode: Annotated[str | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[Session]:
    """List active (in_progress) sessions, optionally filtered."""
    interview_mgr = InterviewManager(db)
    sessions = await interview_mgr.list_active_sessions(
        candidate_id=candidate_id,
        org_id=org_id,
        mode=mode,
    )
    return sessions


@router.get("/all", response_model=list[SessionCreateResponse])
async def list_all_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Session]:
    """List sessions with pagination (for admin/dashboard)."""
    result = await db.execute(
        select(Session)
        .order_by(Session.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = result.scalars().all()
    return list(sessions)


@router.get("/stats", response_model=dict)
async def get_session_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get session statistics."""
    from sqlalchemy import func

    total = await db.execute(select(func.count(Session.id)))
    active = await db.execute(
        select(func.count(Session.id)).where(Session.status == "in_progress")
    )
    completed = await db.execute(
        select(func.count(Session.id)).where(Session.status == "completed")
    )
    abandoned = await db.execute(
        select(func.count(Session.id)).where(Session.status == "abandoned")
    )

    return {
        "total": total.scalar(),
        "active": active.scalar(),
        "completed": completed.scalar(),
        "abandoned": abandoned.scalar(),
    }


@router.get("/batches/{batch_id}", response_model=list[SessionCreateResponse])
async def list_batch_sessions(
    batch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Session]:
    """List all sessions in a batch."""
    from app.models.batch import Batch

    result = await db.execute(
        select(Session).where(Session.batch_id == batch_id)
    )
    sessions = result.scalars().all()
    return list(sessions)


@router.get("/{session_id}")
async def get_session_by_id(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get interview session by ID."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return {
        "id": session.id,
        "status": session.status.value if hasattr(session.status, "value") else str(session.status),
        "target_role": session.target_role,
        "target_company": session.target_company,
        "target_domain": session.target_domain,
        "candidate_id": session.candidate_id,
        "agora_channel_name": session.agora_channel_name,
        "agora_token": session.agora_token,
        "persona_list": session.persona_list or [],
        "interview_duration_minutes": session.interview_duration_minutes or 20,
        "data": {
            "id": session.id,
            "status": session.status.value if hasattr(session.status, "value") else str(session.status),
            "targetRole": session.target_role,
            "targetCompany": session.target_company,
            "targetDomain": session.target_domain,
            "company": session.target_company,
            "role": session.target_role,
            "domain": session.target_domain,
            "personas": session.persona_list or [],
            "agoraChannelName": session.agora_channel_name,
            "agoraToken": session.agora_token,
        }
    }


# WebSocket for real-time session state
@router.websocket("/ws/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: str,
):
    """WebSocket endpoint for real-time interview state updates."""
    await websocket.accept()
    
    # Verify session exists
    async for db in get_db():
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            await websocket.close(code=4004, reason="Session not found")
            return
        
        # Send initial state
        initial_state = InterviewStateUpdate(
            session_id=session_id,
            status=session.status.value if hasattr(session.status, "value") else str(session.status),
            current_persona=None,
        )
        await websocket.send_json(initial_state.model_dump())
        
        try:
            # Subscribe to session events (this would connect to the event bus)
            # For now, we keep the connection open and receive messages
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message_type == "subscribe_whiteboard":
                    # Send current whiteboard state
                    pass
                elif message_type == "subscribe_transcript":
                    # Send transcript updates
                    pass
        except WebSocketDisconnect:
            pass
        except Exception:
            pass


@router.post("/end", response_model=SessionUpdate)
async def end_session(
    request: SessionEndRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Session:
    """End an interview session and finalize."""
    interview_mgr = InterviewManager(db)
    
    try:
        session = await interview_mgr.end_session(
            session_id=request.session_id,
            reason=request.reason,
        )
        
        # Trigger report generation asynchronously
        # This would be done via a task queue in production
        from app.services.reporting.generator import ReportGenerator
        report_gen = ReportGenerator(db)
        await report_gen.generate_report_async(session_id=request.session_id)
        
        return session
    except InterviewNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end session: {str(e)}",
        )


@router.post("/{session_id}/end", response_model=SessionUpdate)
async def end_session_by_path(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    reason: Annotated[str | None, Query()] = None,
) -> Session:
    """End an interview session by path session_id."""
    request = SessionEndRequest(session_id=session_id, reason=reason or "completed")
    return await end_session(request, db)


@router.get("/{session_id}/state", response_model=SessionStateResponse)
async def get_session_state(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionStateResponse:
    """Get current whiteboard state for a session."""
    from datetime import datetime, timezone

    interview_mgr = InterviewManager(db)

    try:
        session = await interview_mgr.get_session(session_id)
        state = await interview_mgr.get_session_state(session_id)
        status_value = session.status.value if hasattr(session.status, "value") else str(session.status)
        return SessionStateResponse(
            session_id=session_id,
            status=status_value,
            whiteboard_state=state if isinstance(state, dict) else {},
            current_persona=(state or {}).get("current_persona") if isinstance(state, dict) else None,
            remaining_time_seconds=session.get_remaining_time(),
            last_update=datetime.now(timezone.utc),
        )
    except InterviewNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{session_id}/whiteboard")
async def get_session_whiteboard(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Whiteboard payload in the shape the frontend poller expects."""
    state = await get_session_state(session_id, db)
    wb = state.whiteboard_state or {}
    return {
        "data": {
            **wb,
            "currentPersona": wb.get("currentPersona") or wb.get("current_persona") or "technical",
            "difficultyState": wb.get("difficultyState") or wb.get("difficulty_state") or {},
            "openThreads": wb.get("openThreads") or wb.get("open_threads") or [],
            "strengths": wb.get("strengths") or [],
            "weaknesses": wb.get("weaknesses") or [],
        }
    }


@router.post("/{session_id}/anam-token")
async def get_anam_session_token(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Generate a short-lived Anam session token."""
    import os
    import httpx

    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    role = (session.target_role if session else None) or "Software Engineer"
    company = session.target_company if session else None
    domain = session.target_domain if session else None
    duration_minutes = (session.interview_duration_minutes if session else None) or 20

    anam_api_key = (settings.anam_api_key or os.getenv("ANAM_API_KEY") or "").strip()
    anam_avatar_id = (settings.anam_avatar_id or os.getenv("ANAM_AVATAR_ID") or "").strip()
    anam_voice_id = (settings.anam_voice_id or os.getenv("ANAM_VOICE_ID") or "6bfbe25a-979d-40f3-a92b-5394170af54b").strip()
    anam_llm_id = (settings.anam_llm_id or os.getenv("ANAM_LLM_ID") or "ANAM_GPT_4O_MINI_V1").strip()

    if not anam_api_key or not anam_avatar_id:
        raise HTTPException(status_code=500, detail="Anam API credentials not configured.")

    persona_config = {
        "name": "EchoSphere AI",
        "avatarId": anam_avatar_id,
        "voiceId": anam_voice_id,
        "llmId": anam_llm_id,
        "systemPrompt": _interviewer_system_prompt(role=role, company=company, domain=domain),
        "initialMessage": _interviewer_opening(role=role, company=company),
    }

    headers = {
        "Authorization": f"Bearer {anam_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.anam.ai/v1/auth/session-token",
                headers=headers,
                json={"personaConfig": persona_config},
                timeout=15.0,
            )
            if response.status_code >= 400:
                # Retry with the same payload shape that is known to authenticate.
                response = await client.post(
                    "https://api.anam.ai/v1/auth/session-token",
                    headers=headers,
                    json={
                        "personaConfig": {
                            "name": "EchoSphere AI",
                            "avatarId": anam_avatar_id,
                            "voiceId": anam_voice_id,
                            "llmId": anam_llm_id,
                            "systemPrompt": persona_config["systemPrompt"],
                        }
                    },
                    timeout=15.0,
                )
            response.raise_for_status()
            data = response.json()
            return data
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Failed to get Anam token: {e.response.text}")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Anam API request timed out.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get Anam token: {str(e)}")

