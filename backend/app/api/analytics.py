"""
Analytics API — real-time SSE stream + candidate scores + overview.
No mock data. All responses come from the database.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.models.user import User
from app.services.reporting.analytics import (
    BatchAnalyticsService,
    CandidateAnalyticsService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ──────────────────────────────────────────────────────────────────────────────
# GET /analytics/overview  — aggregate real-time counts from DB
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/overview")
async def analytics_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Real aggregate counts — no mocks.
    Returns total, active, completed, and abandoned session counts
    plus total registered candidates, all queried live from the database.
    """
    total_sessions_q = await db.execute(select(func.count(Session.id)))
    active_q = await db.execute(
        select(func.count(Session.id)).where(Session.status == "in_progress")
    )
    completed_q = await db.execute(
        select(func.count(Session.id)).where(Session.status == "completed")
    )
    abandoned_q = await db.execute(
        select(func.count(Session.id)).where(Session.status == "abandoned")
    )
    candidates_q = await db.execute(
        select(func.count(User.id)).where(User.role == "student")
    )

    return {
        "total_sessions": total_sessions_q.scalar() or 0,
        "active_sessions": active_q.scalar() or 0,
        "completed_sessions": completed_q.scalar() or 0,
        "abandoned_sessions": abandoned_q.scalar() or 0,
        "total_candidates": candidates_q.scalar() or 0,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /analytics/candidate/{candidate_id}  — real competency scores
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/candidate/{candidate_id}")
async def candidate_analytics(
    candidate_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Per-candidate competency scores aggregated from real session reports.
    Returns 404 if the candidate doesn't exist.
    Returns 422 if no completed interviews exist yet (data is genuinely absent).
    """
    svc = CandidateAnalyticsService(db)
    try:
        return await svc.get_competency_scores(candidate_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


# ──────────────────────────────────────────────────────────────────────────────
# GET /analytics/live  — Server-Sent Events real-time stream
# ──────────────────────────────────────────────────────────────────────────────

async def _live_event_generator(request: Request, db: AsyncSession) -> AsyncIterator[str]:
    """
    Yield SSE events every 5 seconds with real database counts.
    Stops when the client disconnects.
    """

    async def _snapshot() -> dict:
        total_q = await db.execute(select(func.count(Session.id)))
        active_q = await db.execute(
            select(func.count(Session.id)).where(Session.status == "in_progress")
        )
        completed_q = await db.execute(
            select(func.count(Session.id)).where(Session.status == "completed")
        )

        # Most recently completed sessions (last 5) for the activity feed
        recent_q = await db.execute(
            select(Session)
            .where(Session.status == "completed")
            .order_by(Session.updated_at.desc())
            .limit(5)
        )
        recent_sessions = recent_q.scalars().all()

        activity = [
            {
                "session_id": s.id,
                "role": s.target_role,
                "company": s.target_company,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            }
            for s in recent_sessions
        ]

        return {
            "total_sessions": total_q.scalar() or 0,
            "active_sessions": active_q.scalar() or 0,
            "completed_sessions": completed_q.scalar() or 0,
            "recent_activity": activity,
            "ts": datetime.now(timezone.utc).isoformat(),
        }

    # Send an initial snapshot immediately
    try:
        data = await _snapshot()
        yield f"data: {json.dumps(data)}\n\n"
    except Exception as e:
        logger.error(f"[SSE] initial snapshot failed: {e}")
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        return

    while True:
        # Check if client disconnected
        if await request.is_disconnected():
            logger.info("[SSE] client disconnected, stopping stream")
            break

        await asyncio.sleep(5)

        try:
            data = await _snapshot()
            yield f"data: {json.dumps(data)}\n\n"
        except Exception as e:
            logger.error(f"[SSE] snapshot error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            break


@router.get("/live")
async def analytics_live_stream(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Server-Sent Events stream of real-time session metrics.
    Emits a snapshot every 5 seconds. Stops on client disconnect.
    Connect with: EventSource('/api/analytics/live')
    """
    return StreamingResponse(
        _live_event_generator(request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /analytics/batches/{batch_id}/analytics  — batch summary
# Also handles "latest" as a special alias for the most-recent batch
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/batches/{batch_id}/analytics")
async def get_batch_analytics(
    batch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Real batch analytics — queries actual session/report data.
    Use 'latest' as batch_id to resolve the most recently created batch.
    Returns 404 if the batch doesn't exist. No mock fallback.
    """
    svc = BatchAnalyticsService(db)
    try:
        return await svc.get_analytics(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
