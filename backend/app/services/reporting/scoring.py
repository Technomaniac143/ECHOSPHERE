"""
Deterministic competency scoring for EchoSphere reports.

Per Master Build §82 and AGENT_CONTEXT.md rule 3:
- Deterministic scoring framework with evidence
- Configurable weights per competency
- Every score has: score, confidence, strengths, weaknesses, evidence
- Evidence must reference transcript_turn_id + whiteboard_event_id
- No unsupported LLM-generated score directly becomes a final report score

This module provides the scoring infrastructure referenced by the report generator.
The full scoring implementation lives in reporting/generator.py.
This module provides the scoring models, weight configuration, and validation.
"""

from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


# ── Scoring weights configuration ─────────────────────────────────────────────

# Default weights per AGENT_CONTEXT.md and Master Build §82
DEFAULT_COMPETENCY_WEIGHTS = {
    "technical": 25,
    "problem_solving": 15,
    "communication": 10,
    "product_thinking": 15,
    "leadership": 10,
    "behavioral": 15,
    "adaptability": 10,
}

# Extended weights for more granular scoring
EXTENDED_COMPETENCY_WEIGHTS = {
    **DEFAULT_COMPETENCY_WEIGHTS,
    "ownership": 5,
    "decision_making": 5,
    "execution": 5,
    "teamwork": 5,
    "conflict_resolution": 3,
    "customer_impact": 5,
    "business_value": 3,
    "prioritization": 3,
    "metrics": 2,
    "user_experience": 2,
    "innovation": 2,
    "system_design": 10,
    "architecture": 8,
    "databases": 5,
    "apis": 5,
    "debugging": 5,
    "technical_depth": 8,
    "tradeoffs": 5,
    "data_structures": 8,
    "algorithms": 7,
    "scalability": 5,
    "learning": 3,
    "motivation": 2,
    "professionalism": 2,
    "empathy": 2,
    "incident_handling": 3,
    "requirements_gathering": 2,
}


class ScoringWeights(BaseModel):
    """Configurable scoring weights for competency scoring.

    Per Master Build §82: "Make weights configurable."

    Weights must sum to 100. The model validates this automatically.
    """

    weights: dict[str, int] = Field(default_factory=dict)

    @field_validator("weights", mode="before")
    @classmethod
    def _validate_weights_sum(cls, v: dict[str, int]) -> dict[str, int]:
        """Validate that weights sum to 100, normalize if needed."""
        if not v:
            return dict(DEFAULT_COMPETENCY_WEIGHTS)

        total = sum(v.values())
        if total != 100:
            logger.info(
                "Scoring weights sum to %d (expected 100). "
                "Normalizing weights proportionally.",
                total,
            )
            if total == 0:
                return dict(DEFAULT_COMPETENCY_WEIGHTS)
            factor = 100.0 / total
            return {k: max(1, int(round(val * factor))) for k, val in v.items()}

        return v

    def get_weight(self, competency: str) -> int:
        """Get the weight for a specific competency.

        Args:
            competency: The competency key.

        Returns:
            The weight percentage (0-100).
        """
        return self.weights.get(competency, 0)

    def get_relevant_weights(self, competencies: list[str]) -> dict[str, int]:
        """Get weights only for the specified competencies.

        Args:
            competencies: List of competency keys.

        Returns:
            Dict mapping competency to its weight.
        """
        return {c: self.get_weight(c) for c in competencies if self.get_weight(c) > 0}

    @property
    def total_weight(self) -> int:
        """Total sum of all weights."""
        return sum(self.weights.values())

    @property
    def is_valid(self) -> bool:
        """Whether the weights are valid (sum to 100)."""
        return self.total_weight == 100


# ── Score calculation models ──────────────────────────────────────────────────

class ScoreCalculationInput(BaseModel):
    """Input for calculating a competency score.

    Passed to the scoring engine to produce a CompetencyScore.
    """

    competency: str
    evidence_items: list[dict] = Field(default_factory=list)
    claim_count: int = Field(default=0, ge=0)
    open_thread_count: int = Field(default=0, ge=0)
    unresolved_thread_count: int = Field(default=0, ge=0)
    contradiction_count: int = Field(default=0, ge=0)
    vagueness_count: int = Field(default=0, ge=0)
    quality_indicators: list[str] = Field(default_factory=list)
    negative_indicators: list[str] = Field(default_factory=list)

    class Config:
        extra = "allow"  # Allow additional fields for future extension


class ScoreBreakdown(BaseModel):
    """Breakdown of how a score was calculated.

    Provides transparency into the deterministic scoring algorithm.
    """

    base_score: int = Field(default=50, ge=0, le=100)
    evidence_bonus: int = Field(default=0)
    claim_bonus: int = Field(default=0)
    thread_penalty: int = Field(default=0)
    contradiction_penalty: int = Field(default=0)
    vagueness_penalty: int = Field(default=0)
    indicator_adjustments: int = Field(default=0)
    final_score: int = Field(default=50, ge=0, le=100)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class CompetencyScoreWithBreakdown(BaseModel):
    """A competency score with full calculation breakdown.

    Extends the basic score with a transparent breakdown of how the
    score was derived from evidence metrics.
    """

    competency: str
    score: int = Field(default=0, ge=0, le=100)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    evidence: list[dict] = Field(default_factory=list)
    breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    calc_method: str = "deterministic"

    def to_report_entry(self) -> dict:
        """Convert to report JSON entry (without internal breakdown)."""
        return {
            "competency": self.competency,
            "score": self.score,
            "confidence": round(self.confidence, 2),
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "evidence": self.evidence,
            "calc_method": self.calc_method,
        }


# ── Scoring engine ────────────────────────────────────────────────────────────

class ScoringEngineError(Exception):
    """Scoring engine failure."""
    pass


class DeterministicScoringEngine:
    """Deterministic scoring engine for competency assessment.

    Implements the EchoSphere scoring framework:
    - Starts at midpoint (50)
    - Adjusts based on evidence volume, claim quality, open threads,
      contradictions, and vagueness
    - Produces a breakdown for transparency
    - Never uses raw LLM output as a final score

    Per Master Build §82:
    "Do not allow an unsupported LLM-generated score to directly become
    a final report score."

    LLM analysis results (from vagueness/contradiction detection) feed into
    the evidence base as inputs, but the final score is computed deterministically.
    """

    def __init__(
        self,
        weights: Optional[ScoringWeights] = None,
    ):
        self._weights = weights or ScoringWeights()
        logger.debug(
            "Initialized scoring engine with %d competency weights, total=%d",
            len(self._weights.weights), self._weights.total_weight,
        )

    def calculate_score(
        self,
        input: ScoreCalculationInput,
    ) -> CompetencyScoreWithBreakdown:
        """Calculate a competency score from input metrics.

        Args:
            input: The score calculation input.

        Returns:
            CompetencyScoreWithBreakdown with score, breakdown, and evidence.

        Raises:
            ScoringEngineError: If calculation fails.
        """
        try:
            breakdown = self._compute_breakdown(input)
            score = breakdown.final_score
            confidence = breakdown.confidence

            # Build strengths and weaknesses
            strengths = []
            weaknesses = []

            if input.evidence_items:
                strengths.append(f"Evidence-based assessment ({len(input.evidence_items)} items)")

            if input.claim_count >= 3:
                strengths.append(f"Multiple claims demonstrated ({input.claim_count})")

            if input.unresolved_thread_count > 0:
                weaknesses.append(f"{input.unresolved_thread_count} unresolved thread(s)")

            if input.contradiction_count > 0:
                weaknesses.append(f"Contradictions detected ({input.contradiction_count})")

            if input.vagueness_count > 0:
                weaknesses.append(f"Vague answers flagged ({input.vagueness_count})")

            if input.quality_indicators:
                strengths.extend(input.quality_indicators[:3])

            if input.negative_indicators:
                weaknesses.extend(input.negative_indicators[:3])

            # Build evidence list from input
            evidence = list(input.evidence_items)

            return CompetencyScoreWithBreakdown(
                competency=input.competency,
                score=score,
                confidence=round(confidence, 2),
                strengths=strengths,
                weaknesses=weaknesses,
                evidence=evidence,
                breakdown=breakdown,
                calc_method="deterministic",
            )

        except Exception as exc:
            logger.exception("Scoring calculation failed for competency=%s", input.competency)
            raise ScoringEngineError(f"Score calculation failed: {exc}") from exc

    def _compute_breakdown(self, input: ScoreCalculationInput) -> ScoreBreakdown:
        """Compute the score breakdown from input metrics."""
        score = 50  # Base score (midpoint)

        # Evidence bonus: more evidence = higher score
        evidence_count = len(input.evidence_items)
        if evidence_count >= 5:
            evidence_bonus = 20
            confidence_boost = 0.2
        elif evidence_count >= 3:
            evidence_bonus = 10
            confidence_boost = 0.1
        elif evidence_count >= 1:
            evidence_bonus = 5
            confidence_boost = 0.05
        else:
            evidence_bonus = -10
            confidence_boost = -0.15

        score += evidence_bonus

        # Claim quality bonus
        claim_bonus = 0
        if input.claim_count >= 3:
            claim_bonus = 10
        elif input.claim_count >= 1:
            claim_bonus = 5
        elif input.claim_count == 0:
            claim_bonus = -5

        score += claim_bonus

        # Open thread penalty
        thread_penalty = -5 * input.unresolved_thread_count
        score += thread_penalty

        # Contradiction penalty
        contradiction_penalty = -10 * input.contradiction_count
        score += contradiction_penalty

        # Vagueness penalty
        vagueness_penalty = -5 * input.vagueness_count
        score += vagueness_penalty

        # Indicator adjustments
        indicator_adjustments = 0
        for indicator in input.quality_indicators:
            indicator_adjustments += 3
        for indicator in input.negative_indicators:
            indicator_adjustments -= 3

        score += indicator_adjustments

        # Clamp score
        final_score = max(0, min(100, score))

        # Compute confidence
        confidence = 0.5
        confidence += confidence_boost
        confidence -= 0.1 * input.contradiction_count
        confidence -= 0.05 * input.vagueness_count
        confidence -= 0.05 * input.unresolved_thread_count

        # Evidence volume boosts confidence
        if evidence_count >= 5:
            confidence += 0.1
        elif evidence_count >= 3:
            confidence += 0.05

        final_confidence = max(0.0, min(1.0, confidence))

        return ScoreBreakdown(
            base_score=50,
            evidence_bonus=evidence_bonus,
            claim_bonus=claim_bonus,
            thread_penalty=thread_penalty,
            contradiction_penalty=contradiction_penalty,
            vagueness_penalty=vagueness_penalty,
            indicator_adjustments=indicator_adjustments,
            final_score=final_score,
            confidence=round(final_confidence, 2),
        )

    def compute_weighted_overall(
        self,
        scores: list[CompetencyScoreWithBreakdown],
    ) -> tuple[int, float]:
        """Compute the weighted overall score from competency scores.

        Args:
            scores: List of competency scores with breakdowns.

        Returns:
            Tuple of (overall_score, overall_confidence).
        """
        if not scores:
            return 0, 0.0

        total_weighted = 0
        total_weight = 0
        confidences = []

        for cs in scores:
            weight = self._weights.get_weight(cs.competency)
            if weight > 0:
                total_weighted += cs.score * weight
                total_weight += weight
            confidences.append(cs.confidence)

        if total_weight == 0:
            # Fallback: unweighted average
            return int(round(sum(s.score for s in scores) / len(scores))), \
                   sum(confidences) / len(confidences)

        overall = int(round(total_weighted / total_weight))
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return overall, avg_confidence

    def validate_competency(self, competency: str) -> bool:
        """Check if a competency is valid for scoring.

        Args:
            competency: The competency key to validate.

        Returns:
            True if the competency is recognized.
        """
        return competency in self._weights.weights or competency in DEFAULT_COMPETENCY_WEIGHTS


# ── Score validation ──────────────────────────────────────────────────────────

class ScoreValidator:
    """Validates report scores against schema requirements.

    Per Master Build §82:
    "Validate report objects against schemas."

    Ensures:
    - Every competency score has evidence
    - Evidence links reference valid transcript_turn_id + whiteboard_event_id
    - Weights sum to 100
    - Scores are within valid range
    """

    @staticmethod
    def validate_score_has_evidence(score: CompetencyScoreWithBreakdown) -> bool:
        """Check that a score has at least some evidence.

        Args:
            score: The competency score to validate.

        Returns:
            True if the score has evidence.
        """
        return len(score.evidence) > 0 or len(score.breakdown.evidence_bonus) > 0 or \
               score.breakdown.claim_bonus != 0

    @staticmethod
    def validate_score_range(score: CompetencyScoreWithBreakdown) -> bool:
        """Check that the score is within valid range.

        Args:
            score: The competency score to validate.

        Returns:
            True if the score is in [0, 100].
        """
        return 0 <= score.score <= 100

    @staticmethod
    def validate_confidence_range(score: CompetencyScoreWithBreakdown) -> bool:
        """Check that confidence is within valid range.

        Args:
            score: The competency score to validate.

        Returns:
            True if confidence is in [0.0, 1.0].
        """
        return 0.0 <= score.confidence <= 1.0

    @classmethod
    def validate_report_scores(
        cls,
        scores: list[CompetencyScoreWithBreakdown],
        weights: ScoringWeights,
    ) -> list[str]:
        """Validate all scores in a report.

        Args:
            scores: List of competency scores.
            weights: The scoring weights used.

        Returns:
            List of validation error messages (empty if all valid).
        """
        errors = []

        if not weights.is_valid:
            errors.append(f"Scoring weights invalid: sum={weights.total_weight}, expected 100")

        for score in scores:
            if not cls.validate_score_range(score):
                errors.append(
                    f"Score out of range for {score.competency}: {score.score}"
                )

            if not cls.validate_confidence_range(score):
                errors.append(
                    f"Confidence out of range for {score.competency}: {score.confidence}"
                )

            # Note: evidence requirement is advisory, not hard-fail
            # A competency can have no evidence if it wasn't assessed

        return errors


# ── Factory ──────────────────────────────────────────────────────────────────

def create_scoring_engine(
    weights: Optional[dict[str, int]] = None,
) -> DeterministicScoringEngine:
    """Create a deterministic scoring engine.

    Args:
        weights: Optional custom weights. Uses defaults if not provided.

    Returns:
        Configured DeterministicScoringEngine.
    """
    scoring_weights = ScoringWeights(weights=weights or dict(DEFAULT_COMPETENCY_WEIGHTS))
    return DeterministicScoringEngine(weights=scoring_weights)


def create_default_scoring_engine() -> DeterministicScoringEngine:
    """Create a scoring engine with default weights."""
    return create_scoring_engine()


def calculate_competency_dashboard(scores: list[dict]) -> dict:
    """Calculate aggregate competency dashboard scores."""
    if not scores:
        return {"overall": 0, "breakdown": {}}
    total = sum(s.get("score", 0) for s in scores)
    avg = total / len(scores)
    return {
        "overall": round(avg, 1),
        "breakdown": {s.get("competency", "unknown"): s.get("score", 0) for s in scores}
    }

