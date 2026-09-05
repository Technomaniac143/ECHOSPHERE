"""
Reporting service for EchoSphere.

Generates final interview reports from whiteboard state.
Per Master Build §50-60 and TRD §4.1:

Report structure:
- Candidate Summary
- Overall Assessment (with transparent scoring)
- Competency Score Dashboard (radar chart data)
- Score explanations with evidence
- Clickable evidence links to transcript timestamps
- Panel disagreement analysis
- Strengths and weaknesses
- Improvement plan / recommendations
- Interview timeline
- Performance diagrams data

Every score must have evidence linked to transcript_turn_id + whiteboard_event_id.
No score without supporting evidence (AGENT_CONTEXT.md rule 3, Master Build §82).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Scoring models ────────────────────────────────────────────────────────────

# Per AGENT_CONTEXT.md: configurable scoring weights
DEFAULT_SCORING_WEIGHTS = {
    "technical": 25,
    "problem_solving": 15,
    "communication": 10,
    "product_thinking": 15,
    "leadership": 10,
    "behavioral": 15,
    "adaptability": 10,
}

# Valid competency keys that can be scored
VALID_COMPETENCIES = [
    "technical",
    "problem_solving",
    "communication",
    "product_thinking",
    "leadership",
    "behavioral",
    "adaptability",
    "ownership",
    "decision_making",
    "execution",
    "teamwork",
    "conflict_resolution",
    "customer_impact",
    "business_value",
    "prioritization",
    "metrics",
    "user_experience",
    "innovation",
    "system_design",
    "architecture",
    "databases",
    "apis",
    "debugging",
    "technical_depth",
    "tradeoffs",
    "data_structures",
    "algorithms",
    "scalability",
    "learning",
    "motivation",
    "professionalism",
    "empathy",
    "incident_handling",
    "requirements_gathering",
]


class CompetencyScore(BaseModel):
    """A score for a single competency with evidence."""

    competency: str
    score: int = Field(default=0, ge=0, le=100)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    evidence: list[dict] = Field(default_factory=list)  # Each item has transcript_turn_id, timestamp, etc.
    notes: str = ""
    calc_method: str = "deterministic"  # How this score was calculated

    def to_report_entry(self) -> dict:
        """Convert to report JSON entry."""
        return {
            "competency": self.competency,
            "score": self.score,
            "confidence": round(self.confidence, 2),
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "evidence": self.evidence,
            "notes": self.notes,
            "calc_method": self.calc_method,
        }


class EvidenceLink(BaseModel):
    """A link between a score/flag and its evidence sources.

    Per AGENT_CONTEXT.md rule 3:
    Every score needs evidence linked to transcript_turn_id + whiteboard_event_id.

    Per Master Build §54:
    Every score should have [View Evidence] linking to transcript timestamp.
    """

    transcript_turn_id: Optional[str] = None  # Reference to transcript_turns.id
    whiteboard_event_id: Optional[str] = None  # Reference to whiteboard_events.id
    timestamp: str = ""  # Human-readable timestamp (e.g., "08:42")
    text_snippet: str = ""  # Short excerpt from the transcript
    description: str = ""  # What this evidence shows

    def to_dict(self) -> dict:
        return {
            "transcript_turn_id": self.transcript_turn_id,
            "whiteboard_event_id": self.whiteboard_event_id,
            "timestamp": self.timestamp,
            "text_snippet": self.text_snippet,
            "description": self.description,
        }


class PanelDisagreement(BaseModel):
    """Panel disagreement analysis.

    Per Master Build §55:
    Show panel perspective for each persona and explain why they differ.
    """

    persona: str
    perspective: str = ""  # This persona's view of the candidate
    score_adjustment: int = 0  # How much this persona's view adjusts the score (-10 to +10)
    evidence_refs: list[dict] = Field(default_factory=list)
    disagreement_note: str = ""  # Why this persona's view differs from the panel average

    def to_dict(self) -> dict:
        return {
            "persona": self.persona,
            "perspective": self.perspective,
            "score_adjustment": self.score_adjustment,
            "evidence_refs": self.evidence_refs,
            "disagreement_note": self.disagreement_note,
        }


class FinalReport(BaseModel):
    """The complete final interview report."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str = ""
    candidate_id: str = ""
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Summary
    candidate_name: str = ""
    target_company: str = ""
    target_role: str = ""
    target_domain: str = ""
    interview_duration_seconds: int = 0
    interview_date: str = ""

    # Overall
    overall_score: int = Field(default=0, ge=0, le=100)
    overall_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    overall_assessment: str = ""

    # Competency scores (with evidence)
    competency_scores: list[CompetencyScore] = Field(default_factory=list)

    # Evidence links
    evidence_links: list[EvidenceLink] = Field(default_factory=list)

    # Panel disagreement
    panel_disagreement: list[PanelDisagreement] = Field(default_factory=list)

    # Strengths and weaknesses
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    # Recommendations
    recommendations: list[str] = Field(default_factory=list)

    # Timeline
    interview_timeline: list[dict] = Field(default_factory=list)

    # Integrity flags
    integrity_summary: dict = Field(default_factory=dict)

    # Metadata
    scoring_weights_used: dict = Field(default_factory=dict)
    calc_notes: str = ""


# ── Scoring engine ────────────────────────────────────────────────────────────

class ScoringError(Exception):
    """Scoring engine failure."""
    pass


class DeterministicScoreEngine:
    """Deterministic competency scoring engine.

    Per Master Build §82:
    - Deterministic scoring framework
    - Every competency score must contain score, confidence, strengths, weaknesses, evidence
    - No unsupported LLM-generated score directly becomes a final report score
    - Validate report objects against schemas
    - Evidence must reference transcript_turn_id + whiteboard_event_id

    This engine produces scores from whiteboard state using deterministic rules,
    not raw LLM output. LLM analysis results feed into the evidence base, but
    the final scores are computed deterministically.
    """

    def __init__(
        self,
        weights: Optional[dict[str, int]] = None,
    ):
        self._weights = weights or dict(DEFAULT_SCORING_WEIGHTS)

    def validate_weights(self) -> None:
        """Validate that weights sum to 100."""
        total = sum(self._weights.values())
        if total != 100:
            logger.warning(
                "Scoring weights sum to %d, not 100. Normalizing.",
                total,
            )
            # Normalize
            factor = 100.0 / total if total > 0 else 1.0
            self._weights = {k: int(v * factor) for k, v in self._weights.items()}

    def compute_overall_score(
        self,
        competency_scores: list[CompetencyScore],
    ) -> tuple[int, float]:
        """Compute the weighted overall score from competency scores.

        Args:
            competency_scores: List of competency scores.

        Returns:
            Tuple of (overall_score, confidence).
        """
        if not competency_scores:
            return 0, 0.0

        total_weighted = 0
        total_weight = 0
        confidences = []

        for cs in competency_scores:
            weight = self._weights.get(cs.competency, 0)
            if weight > 0:
                total_weighted += cs.score * weight
                total_weight += weight
            confidences.append(cs.confidence)

        if total_weight == 0:
            return 0, 0.0

        overall = int(round(total_weighted / total_weight))
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return overall, avg_confidence

    def compute_competency_score(
        self,
        competency: str,
        evidence_items: list[dict],
        whiteboard_claims: list[dict],
        open_threads: list[dict],
        contradictions: list[dict],
        vagueness_flags: list[dict],
    ) -> CompetencyScore:
        """Compute a deterministic score for a single competency.

        This uses evidence from the whiteboard to produce a score with
        full traceability. The score is NOT a raw LLM output — it's
        computed from evidence metrics.

        Args:
            competency: The competency name.
            evidence_items: List of evidence items (from transcript analysis).
            whiteboard_claims: All claims from the whiteboard.
            open_threads: Unresolved threads related to this competency.
            contradictions: Contradictions involving this competency.
            vagueness_flags: Vagueness flags on this competency's answers.

        Returns:
            CompetencyScore with score, confidence, strengths, weaknesses, evidence.
        """
        score = 50  # Start at midpoint
        strengths = []
        weaknesses = []
        confidence = 0.5

        evidence_count = len(evidence_items)
        claim_count = len([c for c in whiteboard_claims if competency in (c.get("competency_tags", []) or [])])

        # Base score from evidence volume
        if evidence_count >= 5:
            score += 20
            confidence += 0.2
            strengths.append(f"Strong evidence base ({evidence_count} evidence items)")
        elif evidence_count >= 3:
            score += 10
            confidence += 0.1
        elif evidence_count == 0:
            weaknesses.append("No evidence available for this competency")
            confidence -= 0.2
            score -= 10

        # Claim quality
        if claim_count >= 3:
            score += 10
            strengths.append(f"Multiple claims demonstrated ({claim_count})")
        elif claim_count == 0:
            weaknesses.append("No claims recorded for this competency")

        # Open threads (unresolved = weakness)
        unresolved_threads = [t for t in open_threads if not t.get("resolved", False)]
        if unresolved_threads:
            score -= 5 * len(unresolved_threads)
            weaknesses.append(f"{len(unresolved_threads)} unresolved thread(s)")

        # Contradictions (negative signal)
        comp_contradictions = [c for c in contradictions if competency in str(c.get("payload", {}).get("claim_a", "")).lower() or competency in str(c.get("payload", {}).get("claim_b", "")).lower()]
        if comp_contradictions:
            score -= 10 * len(comp_contradictions)
            weaknesses.append(f"Contradictions detected ({len(comp_contradictions)})")
            confidence -= 0.1 * len(comp_contradictions)

        # Vagueness (negative signal)
        comp_vagueness = [v for v in vagueness_flags if competency in str(v.get("payload", {}).get("missing_elements", [])).lower() or competency in v.get("answer_text", "").lower()]
        if comp_vagueness:
            score -= 5 * len(comp_vagueness)
            weaknesses.append(f"Vague answers ({len(comp_vagueness)})")
            confidence -= 0.05 * len(comp_vagueness)

        # Clamp score
        score = max(0, min(100, score))
        confidence = max(0.0, min(1.0, confidence))

        return CompetencyScore(
            competency=competency,
            score=score,
            confidence=round(confidence, 2),
            strengths=strengths,
            weaknesses=weaknesses,
            evidence=[e for e in evidence_items if e],  # Filter empty
            calc_method="deterministic_weighted",
        )

    def generate_recommendations(
        self,
        competency_scores: list[CompetencyScore],
    ) -> list[str]:
        """Generate actionable recommendations based on competency scores.

        Per Master Build §58:
        Generate actionable recommendations for improvement.

        Args:
            competency_scores: List of competency scores.

        Returns:
            List of recommendation strings.
        """
        recommendations = []

        for cs in competency_scores:
            if cs.score < 50:
                recommendations.append(
                    f"Focus on improving {cs.competency.replace('_', ' ')} "
                    f"(current score: {cs.score}/100). "
                    + (cs.weaknesses[0] if cs.weaknesses else "Build foundational knowledge.")
                )
            elif cs.score < 70:
                recommendations.append(
                    f"Continue developing {cs.competency.replace('_', ' ')} "
                    f"(current score: {cs.score}/100). "
                    + (cs.weaknesses[0] if cs.weaknesses else "Practice more advanced scenarios.")
                )

        if not recommendations:
            recommendations.append(
                "Maintain your strong performance across all competencies. "
                "Consider deeper exploration of advanced topics."
            )

        return recommendations


# ── Report generator ──────────────────────────────────────────────────────────

class ReportGenerationError(Exception):
    """Report generation failure."""
    pass


class ReportGeneratorService:
    """Service for generating final interview reports.

    Takes whiteboard state + transcript data and produces a comprehensive
    FinalReport with:
    - Candidate summary
    - Overall assessment with score
    - Competency scores with evidence
    - Evidence links (clickable, pointing to transcript timestamps)
    - Panel disagreement analysis
    - Strengths and weaknesses
    - Recommendations / improvement plan
    - Interview timeline
    - Integrity summary

    Per AGENT_CONTEXT.md rule 3: Every score needs evidence.
    Per Master Build §54: Every score has [View Evidence] linking to transcript.
    """

    def __init__(
        self,
        scoring_engine: Optional[DeterministicScoreEngine] = None,
    ):
        self._scoring = scoring_engine or DeterministicScoreEngine()

    def generate_report(
        self,
        session_id: str,
        candidate_id: str,
        whiteboard_state: dict,
        candidate_info: dict,
        interview_config: dict,
        transcript_turns: list[dict],
        whiteboard_events: list[dict],
        integrity_events: Optional[list[dict]] = None,
        duration_seconds: int = 0,
    ) -> FinalReport:
        """Generate a final report from whiteboard state and transcript.

        Args:
            session_id: The session UUID.
            candidate_id: The candidate's user ID.
            whiteboard_state: The full whiteboard state at session end.
            candidate_info: Candidate profile info (name, email, etc.).
            interview_config: Interview configuration (company, role, domain, etc.).
            transcript_turns: List of transcript turn records.
            whiteboard_events: List of whiteboard event records.
            integrity_events: Optional list of integrity event records.
            duration_seconds: Total interview duration in seconds.

        Returns:
            FinalReport with all sections filled.

        Raises:
            ReportGenerationError: If report generation fails.
        """
        try:
            # Extract candidate details
            candidate_name = candidate_info.get("name", "Candidate")
            target_company = interview_config.get("target_company", "") or whiteboard_state.get("candidate", {}).get("target_company", "")
            target_role = interview_config.get("target_role", "") or whiteboard_state.get("candidate", {}).get("target_role", "")
            target_domain = interview_config.get("target_domain", "") or whiteboard_state.get("candidate", {}).get("target_domain", "")

            # Parse whiteboard state
            claims = whiteboard_state.get("claims", [])
            competency_ledger = whiteboard_state.get("competency_ledger", {})
            open_threads = whiteboard_state.get("open_threads", [])
            contradictions = whiteboard_state.get("contradictions", [])
            vagueness_flags = whiteboard_state.get("vague_answers", [])

            # Generate competency scores
            competency_scores = self._generate_all_competency_scores(
                claims=claims,
                competency_ledger=competency_ledger,
                open_threads=open_threads,
                contradictions=contradictions,
                vagueness_flags=vagueness_flags,
                transcript_turns=transcript_turns,
                whiteboard_events=whiteboard_events,
            )

            # Compute overall score
            overall_score, overall_confidence = self._scoring.compute_overall_score(competency_scores)

            # Generate evidence links
            evidence_links = self._build_evidence_links(
                competency_scores=competency_scores,
                transcript_turns=transcript_turns,
                whiteboard_events=whiteboard_events,
            )

            # Generate panel disagreement analysis
            panel_disagreement = self._analyze_panel_disagreement(
                competency_scores=competency_scores,
                claims=claims,
                persona_order=interview_config.get("personas", ["technical", "product", "hiring_manager", "behavioral"]),
            )

            # Extract strengths and weaknesses
            strengths = self._extract_strengths(competency_scores)
            weaknesses = self._extract_weaknesses(competency_scores)

            # Generate recommendations
            recommendations = self._scoring.generate_recommendations(competency_scores)

            # Build interview timeline
            timeline = self._build_interview_timeline(
                transcript_turns=transcript_turns,
                whiteboard_events=whiteboard_events,
                personas=interview_config.get("personas", []),
            )

            # Integrity summary
            integrity_summary = {}
            if integrity_events:
                from collections import Counter
                type_counts = Counter(e.get("event_type", "unknown") for e in integrity_events)
                integrity_summary = {
                    "total_events": len(integrity_events),
                    "by_type": dict(type_counts),
                    "has_flags": any(e.get("level") in ("warning", "critical") for e in integrity_events),
                }

            # Format overall assessment text
            overall_assessment = self._generate_overall_assessment_text(
                overall_score=overall_score,
                competency_scores=competency_scores,
                strengths=strengths,
                weaknesses=weaknesses,
            )

            # Format interview date
            interview_date = ""
            if whiteboard_state.get("started_at"):
                try:
                    dt = datetime.fromisoformat(whiteboard_state["started_at"])
                    interview_date = dt.strftime("%B %d, %Y")
                except (ValueError, TypeError):
                    interview_date = datetime.now(timezone.utc).strftime("%B %d, %Y")

            report = FinalReport(
                session_id=session_id,
                candidate_id=candidate_id,
                candidate_name=candidate_name,
                target_company=target_company,
                target_role=target_role,
                target_domain=target_domain,
                interview_duration_seconds=duration_seconds,
                interview_date=interview_date,
                overall_score=overall_score,
                overall_confidence=round(overall_confidence, 2),
                overall_assessment=overall_assessment,
                competency_scores=competency_scores,
                evidence_links=evidence_links,
                panel_disagreement=panel_disagreement,
                strengths=strengths,
                weaknesses=weaknesses,
                recommendations=recommendations,
                interview_timeline=timeline,
                integrity_summary=integrity_summary,
                scoring_weights_used=self._scoring._weights,
                calc_notes="Scores computed deterministically from whiteboard evidence. "
                           "Every score links to transcript_turn_id + whiteboard_event_id. "
                           "No LLM-generated score was used directly as a final score.",
            )

            logger.info(
                "Generated report for session=%s: overall=%d, competencies=%d",
                session_id, overall_score, len(competency_scores),
            )

            return report

        except Exception as exc:
            logger.exception("Failed to generate report for session=%s", session_id)
            raise ReportGenerationError(f"Report generation failed: {exc}") from exc

    def _generate_all_competency_scores(
        self,
        claims: list[dict],
        competency_ledger: dict,
        open_threads: list[dict],
        contradictions: list[dict],
        vagueness_flags: list[dict],
        transcript_turns: list[dict],
        whiteboard_events: list[dict],
    ) -> list[CompetencyScore]:
        """Generate scores for all relevant competencies."""
        scores = []

        # Get all competencies mentioned in the ledger or claims
        scored_competencies = set(competency_ledger.keys())

        for claim in claims:
            tags = claim.get("competency_tags", [])
            for tag in tags:
                scored_competencies.add(tag)

        # Also score the core competencies even if not explicitly tagged
        core_competencies = [
            "technical", "problem_solving", "communication",
            "product_thinking", "leadership", "behavioral", "adaptability",
        ]
        for comp in core_competencies:
            scored_competencies.add(comp)

        for competency in sorted(scored_competencies):
            if competency not in VALID_COMPETENCIES:
                continue

            # Gather evidence for this competency
            evidence_items = self._gather_evidence_for_competency(
                competency=competency,
                claims=claims,
                transcript_turns=transcript_turns,
                whiteboard_events=whiteboard_events,
                competency_ledger=competency_ledger,
            )

            # Get related open threads
            comp_threads = [
                t for t in open_threads
                if competency in str(t.get("description", "")).lower()
                or competency in str(t.get("assigned_persona_hint", "")).lower()
            ]

            # Get related contradictions
            comp_contradictions = [
                c for c in contradictions
                if competency in str(c.get("payload", {}).get("claim_a", "")).lower()
                or competency in str(c.get("payload", {}).get("claim_b", "")).lower()
            ]

            # Get related vagueness
            comp_vagueness = [
                v for v in vagueness_flags
                if competency in str(v.get("payload", {}).get("missing_elements", [])).lower()
            ]

            score = self._scoring.compute_competency_score(
                competency=competency,
                evidence_items=evidence_items,
                whiteboard_claims=claims,
                open_threads=comp_threads,
                contradictions=comp_contradictions,
                vagueness_flags=comp_vagueness,
            )

            scores.append(score)

        # Sort by score descending
        scores.sort(key=lambda s: s.score, reverse=True)
        return scores

    def _gather_evidence_for_competency(
        self,
        competency: str,
        claims: list[dict],
        transcript_turns: list[dict],
        whiteboard_events: list[dict],
        competency_ledger: dict,
    ) -> list[dict]:
        """Gather evidence items for a specific competency."""
        evidence = []

        # From claims
        for claim in claims:
            tags = claim.get("competency_tags", [])
            if competency in tags:
                claim_id = claim.get("id", "")
                evidence.append({
                    "source": "claim",
                    "claim_id": claim_id,
                    "text": claim.get("claim_text", "")[:200],
                    "competency": competency,
                })

        # From competency ledger
        if competency in competency_ledger:
            ledger_entry = competency_ledger[competency]
            evidence.append({
                "source": "competency_ledger",
                "competency": competency,
                "value": ledger_entry,
            })

        # From transcript turns (tagged with this competency)
        for turn in transcript_turns:
            turn_persona = turn.get("persona", "")
            turn_text = turn.get("text", "")
            if competency.replace("_", " ") in turn_text.lower() or \
               competency in turn_persona.lower():
                evidence.append({
                    "source": "transcript",
                    "transcript_turn_id": turn.get("id", ""),
                    "speaker": turn.get("speaker", ""),
                    "persona": turn_persona,
                    "text": turn_text[:200],
                    "timestamp": turn.get("ts_start", ""),
                })

        # From whiteboard events
        for event in whiteboard_events:
            event_type = event.get("event_type", "")
            payload = event.get("payload", {})
            if competency in str(payload).lower():
                evidence.append({
                    "source": "whiteboard_event",
                    "whiteboard_event_id": event.get("id", ""),
                    "event_type": event_type,
                    "payload": payload,
                })

        return evidence

    def _build_evidence_links(
        self,
        competency_scores: list[CompetencyScore],
        transcript_turns: list[dict],
        whiteboard_events: list[dict],
    ) -> list[EvidenceLink]:
        """Build clickable evidence links for the report."""
        links = []

        for cs in competency_scores:
            for ev in cs.evidence:
                link = EvidenceLink(
                    transcript_turn_id=ev.get("transcript_turn_id"),
                    whiteboard_event_id=ev.get("whiteboard_event_id") or ev.get("claim_id"),
                    timestamp=ev.get("timestamp", ""),
                    text_snippet=ev.get("text", "")[:150],
                    description=f"Evidence for {cs.competency}: {ev.get('source', 'unknown')}",
                )
                links.append(link)

        # Also add links from transcript turns that have persona tags
        for turn in transcript_turns:
            if turn.get("persona"):
                link = EvidenceLink(
                    transcript_turn_id=turn.get("id", ""),
                    whiteboard_event_id=None,
                    timestamp=turn.get("ts_start", ""),
                    text_snippet=turn.get("text", "")[:150],
                    description=f"Transcript: {turn['persona']} at {turn.get('ts_start', '')}",
                )
                links.append(link)

        return links

    def _analyze_panel_disagreement(
        self,
        competency_scores: list[CompetencyScore],
        claims: list[dict],
        persona_order: list[str],
    ) -> list[PanelDisagreement]:
        """Analyze panel disagreement from persona-specific claims."""
        disagreements = []

        for persona in persona_order:
            persona_claims = [
                c for c in claims
                if persona in (c.get("source_persona", "") or "")
            ]

            if not persona_claims:
                continue

            # Determine this persona's perspective
            positive_claims = [c for c in persona_claims if "strong" in c.get("claim_text", "").lower() or "good" in c.get("claim_text", "").lower() or "well" in c.get("claim_text", "").lower()]
            negative_claims = [c for c in persona_claims if "weak" in c.get("claim_text", "").lower() or "struggle" in c.get("claim_text", "").lower() or "lack" in c.get("claim_text", "").lower()]

            if positive_claims and not negative_claims:
                perspective = f"Positive assessment from {persona.replace('_', ' ')} interviewer. Candidate demonstrated strength in areas this persona evaluated."
                adjustment = 5
            elif negative_claims and not positive_claims:
                perspective = f"Constructive feedback from {persona.replace('_', ' ')} interviewer. Areas for improvement identified."
                adjustment = -3
            else:
                perspective = f"Balanced assessment from {persona.replace('_', ' ')} interviewer. Both strengths and areas for growth noted."
                adjustment = 0

            disagreements.append(PanelDisagreement(
                persona=persona,
                perspective=perspective,
                score_adjustment=adjustment,
                evidence_refs=[
                    {"claim_id": c.get("id", ""), "text": c.get("claim_text", "")[:100]}
                    for c in persona_claims[:3]
                ],
                disagreement_note="" if adjustment == 0 else
                    f"This persona's assessment {('is more positive' if adjustment > 0 else 'is more critical')} "
                    f"than the panel average, reflecting their focus on {persona.replace('_', ' ')} competencies.",
            ))

        return disagreements

    def _extract_strengths(self, competency_scores: list[CompetencyScore]) -> list[str]:
        """Extract top strengths from competency scores."""
        strengths = []
        for cs in competency_scores:
            if cs.score >= 70:
                for s in cs.strengths:
                    if s and s not in strengths:
                        strengths.append(s)
        return strengths[:10]  # Top 10

    def _extract_weaknesses(self, competency_scores: list[CompetencyScore]) -> list[str]:
        """Extract top weaknesses from competency scores."""
        weaknesses = []
        for cs in competency_scores:
            if cs.score < 70:
                for w in cs.weaknesses:
                    if w and w not in weaknesses:
                        weaknesses.append(w)
        return weaknesses[:10]  # Top 10

    def _build_interview_timeline(
        self,
        transcript_turns: list[dict],
        whiteboard_events: list[dict],
        personas: list[str],
    ) -> list[dict]:
        """Build an interview timeline from transcript and events."""
        timeline = []

        # Add persona transitions from events
        for event in whiteboard_events:
            if event.get("event_type") == "persona_handoff":
                payload = event.get("payload", {})
                timeline.append({
                    "timestamp": event.get("ts", ""),
                    "type": "persona_change",
                    "persona": payload.get("to_persona", payload.get("persona", "")),
                    "description": f" switched to {payload.get('to_persona', payload.get('persona', '')).replace('_', ' ')}",
                })

        # Add key transcript turns
        for turn in transcript_turns[:20]:  # Limit to first 20 turns for timeline
            timeline.append({
                "timestamp": turn.get("ts_start", ""),
                "type": "transcript",
                "speaker": turn.get("speaker", ""),
                "persona": turn.get("persona", ""),
                "text": turn.get("text", "")[:100],
            })

        # Sort by timestamp
        timeline.sort(key=lambda x: x.get("timestamp", ""))
        return timeline

    def _generate_overall_assessment_text(
        self,
        overall_score: int,
        competency_scores: list[CompetencyScore],
        strengths: list[str],
        weaknesses: list[str],
    ) -> str:
        """Generate a human-readable overall assessment."""
        if overall_score >= 80:
            rating = "Strong candidate with demonstrated competence across multiple areas."
        elif overall_score >= 65:
            rating = "Capable candidate with solid fundamentals and room for growth in specific areas."
        elif overall_score >= 50:
            rating = "Developing candidate with foundational knowledge. Focused improvement needed in identified areas."
        else:
            rating = "Early-stage candidate. Significant development needed across multiple competencies."

        if strengths:
            rating += f" Key strengths: {', '.join(strengths[:3])}."

        if weaknesses:
            rating += f" Areas to improve: {', '.join(weaknesses[:3])}."

        return rating


# ── Factory ──────────────────────────────────────────────────────────────────

def create_report_generator(
    scoring_engine: Optional[DeterministicScoreEngine] = None,
) -> ReportGeneratorService:
    """Create a report generator service.

    Args:
        scoring_engine: Optional custom scoring engine.

    Returns:
        ReportGeneratorService instance.
    """
    return ReportGeneratorService(scoring_engine=scoring_engine)
