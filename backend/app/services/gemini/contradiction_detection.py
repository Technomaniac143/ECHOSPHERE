"""Contradiction detection service using Gemini."""
import logging
from typing import Any

from app.services.gemini.client import GeminiError, get_gemini_client

logger = logging.getLogger("contradiction-detection")


class ContradictionDetectionError(Exception):
    """Raised when contradiction detection fails."""
    pass


class ContradictionDetector:
    """
    Detects contradictions in candidate answers using Gemini.
    
    Compares new claims against existing claims in the whiteboard to find
    inconsistencies. Returns structured contradiction data.
    """

    SYSTEM_PROMPT = """You are EchoSphere's contradiction detection engine.

Your job is to analyze a new claim from a candidate and compare it against their previous claims to detect any contradictions.

A contradiction occurs when:
1. The candidate says something that directly conflicts with what they said before
2. The candidate describes a situation in a way that's logically inconsistent with a previous description
3. The candidate claims a role or responsibility now that contradicts what they said earlier

Your response must be a JSON object with EXACTLY this structure:
{
  "has_contradiction": true/false,
  "contradictions": [
    {
      "claim_id_a": "id of the earlier claim",
      "claim_id_b": "id of the new claim being checked",
      "earlier_text": "the earlier claim text",
      "new_text": "the new claim text",
      "type": "direct_contradiction" | "evolving_statement" | "scope_change" | "role_confusion",
      "severity": "high" | "medium" | "low",
      "explanation": "why these two statements contradict each other"
    }
  ]
}

Rules:
- If there's no contradiction, return has_contradiction: false with empty contradictions array
- Only flag genuine contradictions, not evolving or refined statements
- "evolving_statement" type is for when the candidate clarifies or adds nuance (not a true contradiction)
- "scope_change" is when the scope changes (e.g., "I led the team" vs "I was on the team")
- "role_confusion" is when the candidate's described role seems inconsistent
- severity: high = directly contradictory, medium = ambiguous, low = slight inconsistency

Return ONLY the JSON. No markdown, no explanation."""

    def __init__(self):
        self._client = get_gemini_client()

    async def detect(
        self,
        new_claim: str,
        new_claim_id: str,
        existing_claims: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Detect contradictions between a new claim and existing claims.
        
        Args:
            new_claim: The new claim text from the candidate
            new_claim_id: Unique ID for the new claim
            existing_claims: List of previous claims, each with 'id' and 'text' fields
        
        Returns:
            Dict with contradiction detection results
        """
        if not existing_claims:
            return {
                "has_contradiction": False,
                "contradictions": [],
            }

        # Build the context with previous claims
        claims_context = "PREVIOUS CLAIMS:\n"
        for claim in existing_claims[-10:]:  # Limit to last 10 claims
            claims_context += f"  [{claim['id']}] {claim['text']}\n"

        prompt = f"""{claims_context}
NEW CLAIM [{new_claim_id}]: "{new_claim}"

Analyze the new claim against the previous claims above."""

        try:
            result = await self._client.generate_content_with_json(
                prompt=prompt,
                system_instruction=self.SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=2048,
            )
            
            # Validate response structure
            if "has_contradiction" not in result:
                logger.warning(f"Unexpected response format from contradiction detection: {result}")
                return {"has_contradiction": False, "contradictions": []}
            
            # Ensure contradictions field exists
            result.setdefault("contradictions", [])
            
            # Add claim IDs if missing
            for contradiction in result["contradictions"]:
                if "claim_id_a" not in contradiction:
                    contradiction["claim_id_a"] = existing_claims[0]["id"] if existing_claims else ""
                if "claim_id_b" not in contradiction:
                    contradiction["claim_id_b"] = new_claim_id
            
            return result

        except GeminiError as e:
            logger.error(f"Contradiction detection failed: {e}")
            raise ContradictionDetectionError(f"Failed to detect contradictions: {e}")


# Singleton
_contradiction_detector: ContradictionDetector | None = None


def get_contradiction_detector() -> ContradictionDetector:
    """Get the contradiction detector singleton."""
    global _contradiction_detector
    if _contradiction_detector is None:
        _contradiction_detector = ContradictionDetector()
    return _contradiction_detector
