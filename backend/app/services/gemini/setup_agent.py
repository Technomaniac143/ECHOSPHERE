"""Setup agent — parses free-text into structured interview configuration using Gemini."""
import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.schemas.interview import SetupParseResponse

logger = logging.getLogger("setup-agent")


# Known companies for suggestion
KNOWN_COMPANIES = [
    "Google", "Microsoft", "Amazon", "Apple", "Meta", "Netflix", "Adobe",
    "Infosys", "TCS", "Wipro", "Accenture", "Deloitte", "Zoho", "Freshworks",
]

# Known job roles
KNOWN_ROLES = [
    "Software Engineer", "Backend Developer", "Frontend Developer", "Full Stack Developer",
    "Data Analyst", "Data Scientist", "Machine Learning Engineer", "DevOps Engineer",
    "Cloud Engineer", "Cybersecurity Engineer", "Product Manager", "Business Analyst", "QA Engineer",
]

# Known domains
KNOWN_DOMAINS = [
    "Web Development", "Backend Development", "Frontend Development", "Full Stack Development",
    "Machine Learning", "Artificial Intelligence", "Data Science", "Cloud Computing",
    "DevOps", "Cybersecurity", "Mobile Development", "Blockchain", "Embedded Systems",
    "Product Management", "Software Engineering",
]


class SetupAgentError(Exception):
    """Base error for SetupAgent."""
    pass


class SetupAgentParseError(SetupAgentError):
    """Failed to parse interview setup."""
    pass


SetupParseResult = SetupParseResponse


def build_setup_prompt_for_display(user_input: str) -> str:
    """Format setup prompt for display."""
    return f"Interview setup request: {user_input}"


class SetupAgent:
    """Parses free-text interview setup requests into structured configuration."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._api_key = settings.gemini_api_key

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def parse(
        self,
        user_input: str,
        mode: str = "practice",
        existing_profile: dict[str, Any] | None = None,
    ) -> SetupParseResponse:
        """Parse free-text into structured interview configuration."""
        user_input_lower = user_input.lower()

        # Try to use Gemini for intelligent parsing
        if self._api_key:
            try:
                return await self._parse_with_gemini(user_input, mode, existing_profile)
            except Exception as e:
                logger.warning(f"Gemini parsing failed, falling back to rule-based: {e}")

        # Fallback to rule-based parsing
        return self._parse_rule_based(user_input, mode, existing_profile)

    async def _parse_with_gemini(
        self,
        user_input: str,
        mode: str,
        existing_profile: dict[str, Any] | None,
    ) -> SetupParseResponse:
        """Use Gemini to intelligently parse the setup request."""
        client = await self._get_client()

        profile_context = ""
        if existing_profile:
            profile_context = f"""
The candidate's existing profile information:
- Target role: {existing_profile.get('target_role', 'Not specified')}
- Target company: {existing_profile.get('target_company', 'Not specified')}
- Target domain: {existing_profile.get('target_domain', 'Not specified')}
- Skills: {existing_profile.get('skills', 'Not specified')}
"""

        prompt = f"""You are EchoSphere's setup agent. Parse the user's interview setup request into a structured configuration.

{mode == 'assessment' and 'This is an ASSESSMENT setup (HR/organization creating a test).' or 'This is a PRACTICE setup (candidate preparing for an interview).'}

{profile_context}

User input: "{user_input}"

Extract and return a JSON object with EXACTLY these fields:
{{
  "target_role": "<inferred job role or the role mentioned, or 'Software Engineer' as default>",
  "target_company": "<company mentioned, or null>",
  "target_company_type": "<type of company if inferable: 'fintech', 'big_tech', 'startup', 'enterprise', etc. or null>",
  "panel": ["technical", "product", "hiring_manager", "behavioral"],  // subset based on role and mode, always include at least technical
  "difficulty_seed": {{"<competency>": "<beginner|easy|medium|hard|expert>"}},  // seed difficulty per competency based on what user said about strengths/weaknesses
  "est_duration_minutes": 20,
  "focus_areas": ["<list of focus areas extracted from input>"]
}}

Rules:
- If user mentions weakness in a specific area, seed that competency as "easy" or "medium"
- If user mentions strength, seed as "hard" or "expert"
- Panel must include "technical" at minimum
- Keep panel short for practice mode (2-3 personas), can be longer for assessment
- focus_areas should be 3-6 key areas
- If user mentions specific technologies or domains, include them in focus_areas

Return ONLY the JSON object. No markdown, no explanation."""

        response = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            params={"key": self._api_key},
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{
                    "parts": [{
                        "text": prompt,
                    }],
                }],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.3,
                    "maxOutputTokens": 1024,
                },
            },
        )

        if response.status_code != 200:
            raise Exception(f"Gemini API error: {response.status_code} {response.text}")

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise Exception("Gemini returned no candidates")

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            raise Exception("Gemini returned empty content")

        text = parts[0].get("text", "")
        
        # Parse JSON from response
        try:
            # Try to find JSON in the response (might be wrapped in markdown)
            text = text.strip()
            if text.startswith("```"):
                # Extract JSON from markdown code block
                lines = text.split("\n")
                json_lines = []
                in_json = False
                for line in lines:
                    if line.startswith("```json") or line.startswith("```"):
                        in_json = True
                        continue
                    if in_json and line.startswith("```"):
                        break
                    if in_json:
                        json_lines.append(line)
                text = "\n".join(json_lines)
            
            parsed = json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse Gemini response as JSON: {text[:200]}")
            raise Exception("Failed to parse Gemini response")

        return SetupParseResponse(
            target_role=parsed.get("target_role", "Software Engineer"),
            target_company=parsed.get("target_company"),
            target_company_type=parsed.get("target_company_type"),
            panel=parsed.get("panel", ["technical", "product", "hiring_manager", "behavioral"]),
            difficulty_seed=parsed.get("difficulty_seed", {}),
            est_duration_minutes=parsed.get("est_duration_minutes", 20),
            focus_areas=parsed.get("focus_areas", []),
        )

    def _parse_rule_based(
        self,
        user_input: str,
        mode: str,
        existing_profile: dict[str, Any] | None,
    ) -> SetupParseResponse:
        """Rule-based fallback parsing when Gemini is unavailable."""
        user_input_lower = user_input.lower()

        # Try to extract role
        target_role = "Software Engineer"  # default
        for role in KNOWN_ROLES:
            if role.lower() in user_input_lower:
                target_role = role
                break

        # Try to extract company
        target_company = None
        for company in KNOWN_COMPANIES:
            if company.lower() in user_input_lower:
                target_company = company
                break

        # Determine company type
        target_company_type = None
        if "fintech" in user_input_lower:
            target_company_type = "fintech"
        elif any(c.lower() in user_input_lower for c in ["google", "microsoft", "amazon", "meta", "apple"]):
            target_company_type = "big_tech"
        elif "startup" in user_input_lower:
            target_company_type = "startup"

        # Determine difficulty seed from user input
        difficulty_seed: dict[str, str] = {}
        weak_areas = ["weak", "struggle", "poor", "bad", "not good", "lack", "improve", "gap"]
        strong_areas = ["strong", "good", "excellent", "expert", "experienced", "proficient"]

        for area in weak_areas:
            if area in user_input_lower:
                # Mark all competencies as medium/easy by default
                for comp in ["Technical", "Problem Solving", "Communication", "Product Thinking"]:
                    if comp.lower() not in difficulty_seed:
                        difficulty_seed[comp] = "easy"

        for area in strong_areas:
            if area in user_input_lower:
                for comp in ["Technical", "Problem Solving", "Communication"]:
                    if comp.lower() not in difficulty_seed:
                        difficulty_seed[comp] = "medium"

        # Extract focus areas
        focus_areas: list[str] = []
        focus_keywords = [
            "system design", "dsa", "data structures", "algorithms", "coding",
            "architecture", "backend", "frontend", "database", "api",
            "problem solving", "ownership", "leadership", "communication",
            "product", "customer", "teamwork", "behavior",
        ]
        for keyword in focus_keywords:
            if keyword in user_input_lower:
                # Normalize the keyword
                normalized = {
                    "dsa": "DSA",
                    "data structures": "Data Structures",
                    "problem solving": "Problem Solving",
                }.get(keyword, keyword.title())
                if normalized not in focus_areas:
                    focus_areas.append(normalized)

        if not focus_areas:
            focus_areas = ["Technical", "Problem Solving", "Communication"]

        # Default panel
        if mode == "practice":
            panel = ["technical", "behavioral"]
            if "product" in user_input_lower or "business" in user_input_lower:
                panel.append("product")
        else:
            panel = ["technical", "product", "hiring_manager", "behavioral"]

        # Ensure technical is always included
        if "technical" not in panel:
            panel.insert(0, "technical")

        return SetupParseResponse(
            target_role=target_role,
            target_company=target_company,
            target_company_type=target_company_type,
            panel=panel,
            difficulty_seed=difficulty_seed if difficulty_seed else {"Technical": "medium", "Problem Solving": "medium"},
            est_duration_minutes=20,
            focus_areas=focus_areas,
        )


# Singleton instance
_setup_agent: SetupAgent | None = None


def get_setup_agent() -> SetupAgent:
    """Get the setup agent singleton."""
    global _setup_agent
    if _setup_agent is None:
        _setup_agent = SetupAgent()
    return _setup_agent


async def parse_interview_setup(
    user_input: str,
    mode: str = "practice",
    existing_profile: dict[str, Any] | None = None,
) -> SetupParseResponse:
    """Helper wrapper for parsing interview setup."""
    agent = get_setup_agent()
    return await agent.parse(user_input, mode, existing_profile)
