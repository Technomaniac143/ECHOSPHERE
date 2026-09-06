"""Real-time batch and candidate analytics — queries the actual database."""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, case, Float, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session, Batch, BatchSession
from app.models.user import User

logger = logging.getLogger(__name__)

SCORE_BANDS = {
    "excellent": (90, 101),
    "good": (75, 90),
    "average": (60, 75),
    "below_average": (45, 60),
    "poor": (0, 45),
}


class BatchAnalyticsService:
    """Service for calculating real batch analytics from the database."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_analytics(self, batch_id: str) -> Dict[str, Any]:
        """
        Compute analytics for a batch from actual session/report data.
        Raises ValueError if batch_id does not exist.
        """
        # Resolve "latest" to the most-recently-created batch
        if batch_id == "latest":
            result = await self.db.execute(
                select(Batch).order_by(Batch.created_at.desc()).limit(1)
            )
            batch = result.scalar_one_or_none()
            if not batch:
                raise ValueError("No batches found in the database.")
            batch_id = batch.id

        # Verify the batch exists
        result = await self.db.execute(select(Batch).where(Batch.id == batch_id))
        batch = result.scalar_one_or_none()
        if not batch:
            raise ValueError(f"Batch '{batch_id}' not found.")

        # Fetch all sessions for this batch (via batch_sessions join)
        sessions_q = (
            select(Session)
            .join(BatchSession, BatchSession.session_id == Session.id)
            .where(BatchSession.batch_id == batch_id)
        )
        result = await self.db.execute(sessions_q)
        sessions: List[Session] = list(result.scalars().all())

        total = len(sessions)
        completed = [s for s in sessions if s.status == "completed"]

        # --- overall scores from the Report relationship ---
        # Session.report is a one-to-one back-populated relationship
        # We eagerly need the report's overall_score.  Load them individually.
        overall_scores: List[float] = []
        technical_scores: List[float] = []
        behavioral_scores: List[float] = []
        product_scores: List[float] = []
        integrity_flag_counts: List[int] = []

        for s in completed:
            # Load related report via scalar
            from app.models.report import Report as ReportModel
            rep_q = await self.db.execute(
                select(ReportModel).where(ReportModel.session_id == s.id)
            )
            report = rep_q.scalar_one_or_none()
            if report and report.overall_score is not None:
                overall_scores.append(float(report.overall_score))
                comps = report.competency_scores or {}
                technical_scores.append(float(comps.get("Technical", {}).get("score", 0)))
                behavioral_scores.append(float(comps.get("Behavioral", {}).get("score", 0)))
                product_scores.append(float(comps.get("Product Thinking", {}).get("score", 0)))

            # Integrity flag count from session JSON field
            integrity_flag_counts.append(len(s.integrity_flags or []))

        avg_overall = (
            round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else None
        )

        # Score distribution
        score_distribution: Dict[str, int] = {band: 0 for band in SCORE_BANDS}
        for score in overall_scores:
            for band, (low, high) in SCORE_BANDS.items():
                if low <= score < high:
                    score_distribution[band] += 1
                    break

        # Panel disagreement: sessions where per-persona scores spread > 20 points
        disagreement_count = 0
        for s in completed:
            from app.models.report import Report as ReportModel
            rep_q = await self.db.execute(
                select(ReportModel).where(ReportModel.session_id == s.id)
            )
            report = rep_q.scalar_one_or_none()
            if report and report.persona_scores:
                scores = [v for v in report.persona_scores.values() if isinstance(v, (int, float))]
                if scores and (max(scores) - min(scores)) > 20:
                    disagreement_count += 1

        panel_disagreement_rate = (
            round(disagreement_count / len(completed), 3) if completed else 0.0
        )

        # Integrity events across all sessions
        total_flags = sum(integrity_flag_counts)
        integrity_event_frequency = (
            round(total_flags / len(completed), 3) if completed else 0.0
        )

        return {
            "batch_id": batch_id,
            "batch_name": batch.name,
            "total_candidates": total,
            "completed_candidates": len(completed),
            "average_overall_score": avg_overall,
            "score_distribution": score_distribution,
            "technical_distribution": technical_scores,
            "behavioral_distribution": behavioral_scores,
            "product_distribution": product_scores,
            "panel_disagreement_rate": panel_disagreement_rate,
            "integrity_event_frequency": integrity_event_frequency,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }


class CandidateAnalyticsService:
    """Per-candidate competency analytics derived from completed session reports."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_competency_scores(self, candidate_id: str) -> Dict[str, Any]:
        """
        Aggregate competency scores across all completed sessions for a candidate.
        Raises ValueError if candidate does not exist.
        """
        # Verify candidate exists
        result = await self.db.execute(select(User).where(User.id == candidate_id))
        user = result.scalar_one_or_none()
        if not user:
            from datetime import datetime, timezone
            return {
                "candidate_id": candidate_id,
                "total_sessions": 0,
                "competency_scores": [],
                "session_history": [],
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

        # Fetch all completed sessions
        result = await self.db.execute(
            select(Session)
            .where(Session.candidate_id == candidate_id)
            .where(Session.status == "completed")
            .order_by(Session.ended_at.desc())
        )
        sessions = list(result.scalars().all())

        if not sessions:
            from datetime import datetime, timezone
            return {
                "candidate_id": candidate_id,
                "total_sessions": 0,
                "competency_scores": [],
                "session_history": [],
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

        from app.models.report import Report as ReportModel

        competency_accumulator: Dict[str, List[float]] = {}
        per_session: List[Dict[str, Any]] = []

        for s in sessions:
            rep_q = await self.db.execute(
                select(ReportModel).where(ReportModel.session_id == s.id)
            )
            report = rep_q.scalar_one_or_none()
            if not report or not report.competency_scores:
                continue

            session_comps: Dict[str, float] = {}
            for comp_name, detail in report.competency_scores.items():
                score = float(detail.get("score", 0)) if isinstance(detail, dict) else float(detail)
                competency_accumulator.setdefault(comp_name, []).append(score)
                session_comps[comp_name] = score

            per_session.append({
                "session_id": s.id,
                "role": s.target_role,
                "company": s.target_company,
                "date": s.ended_at.isoformat() if s.ended_at else None,
                "overall_score": float(report.overall_score) if report.overall_score else None,
                "competency_scores": session_comps,
            })

        if not competency_accumulator:
            from datetime import datetime, timezone
            return {
                "candidate_id": candidate_id,
                "total_sessions": len(sessions),
                "competency_scores": [],
                "session_history": per_session,
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

        # Average each competency across sessions
        averaged: List[Dict[str, Any]] = [
            {
                "label": name,
                "score": round(sum(vals) / len(vals), 1),
                "sessions": len(vals),
                "trend": _compute_trend(vals),
            }
            for name, vals in competency_accumulator.items()
        ]
        averaged.sort(key=lambda x: x["score"], reverse=True)

        return {
            "candidate_id": candidate_id,
            "total_sessions": len(sessions),
            "competency_scores": averaged,
            "session_history": per_session,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }


def _compute_trend(scores: List[float]) -> str:
    """Return 'improving', 'declining', or 'stable' based on score trajectory."""
    if len(scores) < 2:
        return "stable"
    # Compare first half avg vs second half avg
    mid = len(scores) // 2
    first_half = sum(scores[:mid]) / max(1, mid)
    second_half = sum(scores[mid:]) / max(1, len(scores) - mid)
    delta = second_half - first_half
    if delta > 5:
        return "improving"
    if delta < -5:
        return "declining"
    return "stable"
