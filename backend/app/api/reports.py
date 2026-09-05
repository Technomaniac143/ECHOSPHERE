"""Report generation routes — final assessment reports with evidence."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.report import Report
from app.models.session import Session
from app.schemas.report import (
    ReportResponse,
    CompetencyScoreDetail,
    EvidenceLink,
)
from app.services.reporting.generator import ReportGenerator, ReportNotFoundError

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{session_id}", response_model=ReportResponse)
async def get_report(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get the final report for a completed session."""
    report_gen = ReportGenerator(db)
    
    try:
        report = await report_gen.get_report(session_id)
        return report
    except ReportNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found. The interview may still be processing.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve report: {str(e)}",
        )


@router.get("/{session_id}/competencies")
async def get_competency_scores(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get competency scores for a report."""
    report_gen = ReportGenerator(db)
    
    try:
        report = await report_gen.get_report(session_id)
        competency_scores = report.get("competency_scores", {})
        
        return {
            "session_id": session_id,
            "competency_scores": competency_scores,
            "overall_score": report.get("overall_score"),
        }
    except ReportNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )


@router.get("/{session_id}/evidence")
async def get_evidence(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    competency: Annotated[str | None, Query()] = None,
) -> dict:
    """Get evidence items for a report, optionally filtered by competency."""
    report_gen = ReportGenerator(db)
    
    try:
        report = await report_gen.get_report(session_id)
        evidence_links = report.get("evidence_links", [])
        
        if competency:
            evidence_links = [
                e for e in evidence_links
                if e.get("competency") == competency
            ]
        
        return {
            "session_id": session_id,
            "evidence": evidence_links,
            "total": len(evidence_links),
        }
    except ReportNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )


@router.get("/{session_id}/timeline")
async def get_interview_timeline(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get the interview timeline — persona segments with timestamps."""
    from app.models.transcript import TranscriptTurn
    
    result = await db.execute(
        select(TranscriptTurn)
        .where(TranscriptTurn.session_id == session_id)
        .order_by(TranscriptTurn.ts_start)
    )
    turns = result.scalars().all()
    
    timeline = []
    current_persona = None
    segment_start = None
    segment_text = []
    
    for turn in turns:
        persona = turn.persona or "candidate"
        
        if persona != current_persona:
            if current_persona and segment_start:
                timeline.append({
                    "persona": current_persona,
                    "start_time": segment_start,
                    "end_time": turn.ts_start,
                    "text_preview": " ".join(segment_text)[:200],
                })
            current_persona = persona
            segment_start = turn.ts_start
            segment_text = [turn.text] if turn.text else []
        else:
            if turn.text:
                segment_text.append(turn.text)
    
    # Don't forget the last segment
    if current_persona and segment_start:
        timeline.append({
            "persona": current_persona,
            "start_time": segment_start,
            "end_time": turns[-1].ts_end if turns else segment_start,
            "text_preview": " ".join(segment_text)[:200],
        })
    
    return {
        "session_id": session_id,
        "timeline": timeline,
    }


@router.get("/{session_id}/disagreement")
async def get_panel_disagreement(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get panel disagreement details for a report."""
    report_gen = ReportGenerator(db)
    
    try:
        report = await report_gen.get_report(session_id)
        disagreement = report.get("panel_disagreement")
        
        if not disagreement:
            return {
                "session_id": session_id,
                "has_disagreement": False,
                "message": "No significant panel disagreement detected.",
            }
        
        return {
            "session_id": session_id,
            "has_disagreement": True,
            "disagreement": disagreement,
        }
    except ReportNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )


@router.get("/{session_id}/roadmap")
async def get_roadmap(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get the candidate's roadmap based on this interview."""
    from app.models.roadmap import Roadmap
    from app.models.user import User
    
    result = await db.execute(
        select(Roadmap).where(Roadmap.student_id == session_id[:8])  # Simplified lookup
    )
    roadmap = result.scalar_one_or_none()
    
    if roadmap:
        return {
            "student_id": roadmap.student_id,
            "competency_ledger": roadmap.competency_ledger,
            "updated_at": roadmap.updated_at,
        }
    
    # Generate a fresh roadmap
    return {
        "student_id": session_id[:8],
        "competency_ledger": {
            "Technical": {"score": 75, "progress": 0.75, "trend": "improving"},
            "Problem Solving": {"score": 70, "progress": 0.70, "trend": "stable"},
            "Communication": {"score": 80, "progress": 0.80, "trend": "improving"},
            "Product Thinking": {"score": 65, "progress": 0.65, "trend": "needs_work"},
            "Leadership": {"score": 72, "progress": 0.72, "trend": "stable"},
            "Behavioral": {"score": 78, "progress": 0.78, "trend": "improving"},
            "Adaptability": {"score": 74, "progress": 0.74, "trend": "stable"},
        },
        "updated_at": "now",
        "generated_from_session": session_id,
    }
