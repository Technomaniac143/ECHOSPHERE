"""Gemini client — base HTTP client for Gemini API calls."""
import logging
from typing import Any
from urllib.parse import urljoin

import httpx

from app.config import settings

logger = logging.getLogger("gemini-client")


class GeminiError(Exception):
    """Base exception for Gemini API errors."""
    pass


class GeminiConfigError(GeminiError):
    """Raised when Gemini API key is missing or invalid."""


class GeminiRateLimitError(GeminiError):
    """Rate limit exceeded."""
    pass


class GeminiClient:
    """HTTP client for Google Gemini API."""
    
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
    
    def __init__(self):
        self._api_key = settings.gemini_api_key
        self._client: httpx.AsyncClient | None = None
        self._default_model = "gemini-3.6-flash"
        self._vision_model = "gemini-3.6-flash"  # For multimodal/vision tasks
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={"Content-Type": "application/json"},
            )
        return self._client
    
    def _build_url(self, endpoint: str) -> str:
        """Build a full API URL."""
        clean = endpoint.lstrip("/")
        return f"{self.BASE_URL}/{clean}"
    
    async def generate_content(
        self,
        model: str | None = None,
        contents: list[dict[str, Any]] | str = [],
        system_instruction: str | None = None,
        temperature: float = 0.3,
        max_output_tokens: int = 2048,
        response_mime_type: str = "text/plain",
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Generate content using Gemini.
        
        Args:
            model: Model name (default: gemini-2.0-flash)
            contents: Content to send — either a string (single turn) or list of parts
            system_instruction: System prompt to prepend
            temperature: Sampling temperature (0.0-2.0)
            max_output_tokens: Maximum tokens in response
            response_mime_type: "text/plain" or "application/json"
            tools: Tool definitions for function calling
        """
        model = model or self._default_model
        client = await self._get_client()
        
        # Normalize contents
        if isinstance(contents, str):
            contents = [{"parts": [{"text": contents}]}]
        elif isinstance(contents, list) and all(isinstance(c, str) for c in contents):
            contents = [{"parts": [{"text": c}]} for c in contents]
        
        request_body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": response_mime_type,
            },
        }
        
        if system_instruction:
            request_body["systemInstruction"] = {
                "parts": [{"text": system_instruction}],
            }
        
        if tools:
            request_body["tools"] = tools
        
        # Merge any additional kwargs into generationConfig
        if kwargs:
            request_body["generationConfig"].update(kwargs)
        
        url = self._build_url(f"models/{model}:generateContent")
        
        try:
            response = await client.post(
                url,
                params={"key": self._api_key},
                json=request_body,
            )
            
            if response.status_code == 429:
                raise GeminiRateLimitError("Gemini API rate limit exceeded")
            
            if response.status_code != 200:
                logger.error(f"Gemini API error: {response.status_code} — {response.text[:500]}")
                raise GeminiError(f"Gemini API error: {response.status_code}")
            
            return response.json()
            
        except httpx.TimeoutException:
            raise GeminiError("Gemini API request timed out")
        except httpx.RequestError as e:
            raise GeminiError(f"Gemini API request failed: {e}")
    
    async def generate_content_with_json(
        self,
        prompt: str,
        system_instruction: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Generate content and parse response as JSON."""
        result = await self.generate_content(
            model=model,
            contents=prompt,
            system_instruction=system_instruction,
            response_mime_type="application/json",
            **kwargs,
        )
        
        candidates = result.get("candidates", [])
        if not candidates:
            raise GeminiError("Gemini returned no candidates")
        
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            raise GeminiError("Gemini returned empty content")
        
        text = parts[0].get("text", "")
        
        # Try to parse JSON from response (might be wrapped in markdown)
        import json
        try:
            if text.startswith("```"):
                lines = text.split("\n")
                json_lines = []
                in_json = False
                for line in lines:
                    if "```json" in line or line.strip() == "```":
                        in_json = True
                        continue
                    if in_json and line.strip() == "```":
                        break
                    if in_json:
                        json_lines.append(line)
                text = "\n".join(json_lines)
            
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse Gemini JSON response: {text[:200]}")
            raise GeminiError("Failed to parse Gemini JSON response")
    
    async def analyze_image(
        self,
        image_data: bytes,
        prompt: str,
        model: str | None = None,
    ) -> dict[str, Any]:
        """Analyze an image using Gemini Vision."""
        model = model or self._vision_model
        client = await self._get_client()
        
        # Convert image to base64
        import base64
        image_b64 = base64.b64encode(image_data).decode("utf-8")
        
        contents = [{
            "parts": [
                {"text": prompt},
                {
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": image_b64,
                    },
                },
            ],
        }]
        
        url = self._build_url(f"models/{model}:generateContent")
        
        try:
            response = await client.post(
                url,
                params={"key": self._api_key},
                json={
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 1024,
                    },
                },
            )
            
            if response.status_code != 200:
                raise GeminiError(f"Gemini Vision API error: {response.status_code}")
            
            return response.json()
            
        except httpx.TimeoutException:
            raise GeminiError("Gemini Vision API request timed out")
    
    async def get_model_info(self, model: str | None = None) -> dict[str, Any]:
        """Get information about a Gemini model."""
        model = model or self._default_model
        client = await self._get_client()
        
        url = self._build_url(f"/models/{model}")
        
        response = await client.get(
            url,
            params={"key": self._api_key},
        )
        
        if response.status_code != 200:
            raise GeminiError(f"Failed to get model info: {response.status_code}")
        
        return response.json()


class GeminiUnavailableError(GeminiError):
    """Service unreachable or server error."""
    pass


# Singleton
_gemini_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    """Get the Gemini client singleton."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client


# ── Constants & Factory Aliases ──────────────────────────────────────────────

GEMINI_FLASH_MODEL = "gemini-3.6-flash"
GEMINI_FLASH_LITE_MODEL = "gemini-3.5-flash-lite"
GEMINI_MULTIMODAL_MODEL = "gemini-3.6-flash"

create_gemini_client = get_gemini_client
create_flash_client = get_gemini_client
create_multimodal_client = get_gemini_client
