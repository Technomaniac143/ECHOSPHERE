"""Interview routes — history, details, setup configuration."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.schemas.interview import (
    InterviewHistoryResponse,
    InterviewDetailResponse,
    InterviewSetupConfirmRequest,
)
from app.services.interview.manager import InterviewManager

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.get("", response_model=list[InterviewHistoryResponse])
async def list_interviews(
    candidate_id: Annotated[str | None, Query()] = None,
    status_filter: Annotated[str | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    """List interviews for a candidate (or all if admin)."""
    interview_mgr = InterviewManager(db)
    
    try:
        interviews = await interview_mgr.list_interviews(
            candidate_id=candidate_id,
            status=status_filter,
        )
        return [
            {
                "id": i.id,
                "target_role": i.target_role,
                "target_company": i.target_company,
                "target_domain": i.target_domain,
                "status": i.status,
                "started_at": i.started_at,
                "ended_at": i.ended_at,
                "created_at": i.created_at,
                "overall_score": i.overall_score,
            }
            for i in interviews
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/setup/confirm", response_model=InterviewSetupConfirmRequest)
async def confirm_setup(
    request: InterviewSetupConfirmRequest,
) -> dict:
    """Confirm or adjust the interview setup configuration."""
    # In production, store the confirmed config and create a panel
    return {
        **request.model_dump(),
        "confirmed": True,
        "message": "Interview setup confirmed. You can now start the interview.",
    }


@router.get("/{session_id}", response_model=InterviewDetailResponse)
async def get_interview_detail(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get detailed interview information."""
    interview_mgr = InterviewManager(db)
    
    try:
        session = await interview_mgr.get_session(session_id)
        
        # Get whiteboard state
        state = await interview_mgr.get_session_state(session_id)
        
        return {
            "id": session.id,
            "mode": session.mode,
            "target_role": session.target_role,
            "target_company": session.target_company,
            "status": session.status,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "whiteboard_state": state,
            "transcript": [],  # Would query transcript_turns
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/{session_id}/adjust-difficulty")
async def adjust_difficulty(
    session_id: str,
    target_competency: Annotated[str, Query()],
    level: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Manually adjust difficulty for a competency (HR/advanced use)."""
    from app.services.interview.manager import InterviewManager
    
    interview_mgr = InterviewManager(db)
    
    try:
        await interview_mgr.adjust_difficulty(
            session_id=session_id,
            competency=target_competency,
            level=level,
        )
        return {"success": True, "message": f"Difficulty adjusted for {target_competency}"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
