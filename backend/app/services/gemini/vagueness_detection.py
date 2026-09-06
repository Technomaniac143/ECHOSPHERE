"""Vagueness detection service using Gemini."""
import logging
import re
from typing import Any

from app.services.gemini.client import GeminiError, get_gemini_client

logger = logging.getLogger("vagueness-detection")


class VaguenessDetectionError(Exception):
    """Raised when vagueness detection fails."""
    pass


# Keywords that often indicate vague statements
VAGUE_KEYWORDS = [
    "much faster", "much better", "significantly", "dramatically",
    "huge improvement", "massive improvement", "greatly improved",
    "lot of", "tons of", "loads of", "many", "various",
    "etc", "and so on", "and the like", "or something",
    "some kind of", "something like", "approximately",
    "a lot", "plenty", "numerous", "countless",
    "huge", "big", "large", "substantial"  # Without supporting numbers
]

# Metric/quantification patterns that indicate specificity
SPECIFIC_PATTERNS = [
    r'\d+%', r'\d+\.?\d*\s*(?:percent|%)\b',
    r'\$\d+', r'\d+\s*(?:x|times|folds?)\b',
    r'\d+\s*(?:ms|milliseconds?|seconds?|minutes?|hours?|days?)\b',
    r'(?:reduced|increased|improved|decreased)\s+by\s+\d+',
    r'(?:from|to)\s+\d+',
    r'\d+\s*(?:users?|customers?|requests?|transactions?|records?|GB|TB|requests/sec|rps)\b',
    r'(?:P\d|priority\s*\d)\b', r'(?:SLA|RTO|RPO)\s*[=:]\s*\d+',
]


class VaguenessDetector:
    """
    Detects vague statements in candidate answers.
    
    Can use Gemini for deep analysis or fall back to keyword-based detection.
    """

    SYSTEM_PROMPT = """You are EchoSphere's vagueness detection engine.

Your job is to analyze a candidate's statement and determine if it's vague — meaning it lacks specific, verifiable details.

A statement is VAGUE if it:
1. Uses outcome language ("improved performance", "made it faster") without quantifying HOW MUCH
2. Mentions technologies or approaches without explaining HOW they were used
3. Claims impact without describing the metrics or measurement method
4. Uses hand-wavy language ("etc", "and so on", "various things") to avoid specifics
5. Describes a result without explaining the mechanism that produced it

A statement is SPECIFIC if it:
1. Includes numbers, percentages, timeframes, or measurements
2. Explains the technical mechanism behind an outcome
3. Names specific tools, techniques, or approaches and WHY they were chosen
4. Describes the before/after state concretely
5. Explains how success was measured

Your response must be a JSON object with EXACTLY this structure:
{
  "is_vague": true/false,
  "confidence": 0.0-1.0,
  "vague_phrases": ["specific phrases that are vague"],
  "missing_elements": ["what's missing to make this specific"],
  "suggested_probe": "a targeted follow-up question to elicit specifics",
  "analysis": "brief explanation of why this is or isn't vague"
}

Rules:
- is_vague should be true if the statement would benefit from more specifics
- confidence should reflect how certain you are
- suggested_probe should be a natural follow-up question
- Return ONLY the JSON. No markdown, no explanation."""

    def __init__(self):
        self._client = get_gemini_client()

    async def detect(
        self,
        statement: str,
        context: str | None = None,
    ) -> dict[str, Any]:
        """
        Detect vagueness in a statement.
        
        Args:
            statement: The candidate's statement to analyze
            context: Optional surrounding context (previous sentences, etc.)
        
        Returns:
            Dict with vagueness analysis results
        """
        # First try quick regex-based detection
        quick_result = self._quick_detect(statement)
        if quick_result["is_vague"] and quick_result["confidence"] > 0.7:
            # High confidence from pattern matching — return quickly
            return quick_result

        # Use Gemini for deeper analysis
        if context:
            full_text = f"CONTEXT:\n{context}\n\nSTATEMENT: {statement}"
        else:
            full_text = statement

        try:
            result = await self._client.generate_content_with_json(
                prompt=full_text,
                system_instruction=self.SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=1024,
            )
            
            result.setdefault("vague_phrases", [])
            result.setdefault("missing_elements", [])
            result.setdefault("suggested_probe", "")
            result.setdefault("analysis", "")
            
            return result

        except GeminiError as e:
            logger.warning(f"Gemini vagueness detection failed, using pattern-based: {e}")
            return self._quick_detect(statement)

    def _quick_detect(self, statement: str) -> dict[str, Any]:
        """Quick pattern-based vagueness detection."""
        statement_lower = statement.lower()
        
        vague_phrases: list[str] = []
        missing_elements: list[str] = []
        has_specifics = False
        
        # Check for vague keywords
        for keyword in VAGUE_KEYWORDS:
            if keyword in statement_lower:
                # Find the phrase containing the keyword
                pattern = re.compile(r'[^.]*' + re.escape(keyword) + r'[^.]*\.?', re.IGNORECASE)
                matches = pattern.findall(statement)
                for match in matches:
                    vague_phrases.append(match.strip())
        
        # Check for specific patterns (good sign)
        for pattern in SPECIFIC_PATTERNS:
            if re.search(pattern, statement, re.IGNORECASE):
                has_specifics = True
                break
        
        # Determine if vague
        is_vague = len(vague_phrases) > 0 and not has_specifics
        
        # Determine what's missing
        if is_vague:
            if not re.search(r'\d+%|\d+\.?\d*\s*%|percent', statement_lower):
                missing_elements.append("quantified impact (percentage, absolute numbers)")
            if not re.search(r'ms|millisecond|second|minute|hour|day|GB|TB|requests', statement_lower):
                missing_elements.append("timeframe or scale of impact")
            if not re.search(r'because|since|due to|by using|by implementing', statement_lower):
                missing_elements.append("explanation of HOW the result was achieved")
            if not re.search(r'before|after|previously|originally|initially', statement_lower):
                missing_elements.append("before/after comparison")
        
        # Generate suggested probe
        suggested_probe = ""
        if is_vague:
            if "faster" in statement_lower or "speed" in statement_lower or "performance" in statement_lower:
                suggested_probe = "Can you be more specific about the improvement? What metrics did you measure, and what was the before/after?"
            elif "improved" in statement_lower or "better" in statement_lower:
                suggested_probe = "What specifically improved, and how did you measure that improvement?"
            elif "many" in statement_lower or "lot of" in statement_lower:
                suggested_probe = "Can you give me a specific number or example?"
            elif "etc" in statement_lower or "and so on" in statement_lower:
                suggested_probe = "Which specific items are you referring to? Can you name a few?"
            else:
                suggested_probe = "Can you be more specific about what you mean?"

        confidence = 0.0
        if len(vague_phrases) > 0 and not has_specifics:
            confidence = 0.6
        elif len(vague_phrases) > 1 and not has_specifics:
            confidence = 0.75
        elif has_specifics:
            confidence = 0.1

        return {
            "is_vague": is_vague,
            "confidence": confidence,
            "vague_phrases": vague_phrases[:5],
            "missing_elements": missing_elements[:3],
            "suggested_probe": suggested_probe,
            "analysis": f"Statement {'contains' if vague_phrases else 'does not contain'} vague language patterns. {'Specific details are' if has_specifics else 'No specific details were'} present.",
        }


# Singleton
_vagueness_detector: VaguenessDetector | None = None


def get_vagueness_detector() -> VaguenessDetector:
    """Get the vagueness detector singleton."""
    global _vagueness_detector
    if _vagueness_detector is None:
        _vagueness_detector = VaguenessDetector()
    return _vagueness_detector


# ── Aliases & Helper Wrappers ────────────────────────────────────────────────

VaguenessDetectionService = VaguenessDetector
VaguenessFlag = dict
VaguenessDetectionUnavailable = VaguenessDetectionError
VaguenessLevel = str
create_vagueness_detection_service = get_vagueness_detector
