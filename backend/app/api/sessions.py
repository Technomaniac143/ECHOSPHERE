"""Session management routes — create, start, monitor, end interviews."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.websocket import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    
    try:
        session = await interview_mgr.create_session(
            mode=request.mode,
            panel_id=request.panel_id,
            candidate_id=request.candidate_id,
            target_role=request.target_role,
            target_company=request.target_company,
            org_id=request.org_id,
        )
        return session
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create session: {str(e)}",
        )


@router.post("/start", response_model=SessionCreateResponse)
async def start_session(
    request: SessionStartRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Session:
    """Start an interview session — provisions Agora channel and ConvoAI agent."""
    interview_mgr = InterviewManager(db)
    
    try:
        session = await interview_mgr.start_session(
            session_id=request.session_id,
            candidate_voiceprint_id=request.candidate_voiceprint_id,
            initial_persona_system_prompt=request.initial_persona_system_prompt,
            greeting_text=request.greeting_text,
            agorad_app_id=request.agora_app_id,  # optional override
        )
        return session
    except InterviewNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    except AgoraClientError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Agora service unavailable: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start session: {str(e)}",
        )


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


@router.get("/batches/{batch_id}", response_model=list[SessionCreateResponse])
async def list_batch_sessions(
    batch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Session]:
    """List all sessions in a batch."""
    from app.models.batch import Batch
    
    result = await db.execute(
        select(Session)
        .join(Batch, Session.id == Batch.id)  # This needs proper relationship
        .where(Batch.id == batch_id)
    )
    sessions = result.scalars().all()
    return list(sessions)


@router.get("/all", response_model=list[SessionCreateResponse])
async def list_all_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Session]:
    """List sessions with pagination (for admin/dashboard)."""
    from app.models.batch import Batch
    
    result = await db.execute(
        select(Session)
        .options()
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
            status=session.status,
            current_persona=session.current_persona,
            remaining_time=session.get_remaining_time() if session else 0,
            whiteboard_state={},  # Will be populated from whiteboard service
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


@router.get("/{session_id}", response_model=SessionCreateResponse)
async def get_session(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Session:
    """Get session details by ID."""
    interview_mgr = InterviewManager(db)
    
    try:
        session = await interview_mgr.get_session(session_id)
        return session
    except InterviewNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )


@router.get("/{session_id}/state", response_model=SessionStateResponse)
async def get_session_state(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionStateResponse:
    """Get current whiteboard state for a session."""
    from app.services.interview.manager import InterviewManager
    
    interview_mgr = InterviewManager(db)
    
    try:
        state = await interview_mgr.get_session_state(session_id)
        return SessionStateResponse(
            session_id=session_id,
            whiteboard_state=state,
            current_persona=state.get("current_persona"),
            difficulty_state=state.get("difficulty_state", {}),
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
