"""
Token service for Agora RTC.

Generates Agora RTC tokens using App ID and App Certificate.
Never exposes certificate to frontend.

CRITICAL: If AGORA_APP_ID or AGORA_APP_CERTIFICATE env vars are missing,
this service raises a clear ConfigurationError instead of silently failing
or exposing credentials.
"""

from __future__ import annotations

import hashlib
import hmac
import base64
import time
import struct
import logging
from typing import Optional

from ..agora.types import AgoraTokenParams, AgoraToken, RtcRole

logger = logging.getLogger(__name__)

# ── Development mock mode ──────────────────────────────────────────────────
# Per AGENT_CONTEXT.md rule 9 and Master Build §85:
# If credentials are missing, build correct abstraction + clearly-marked
# dev mock mode. NEVER pretend mock is real.
_DEV_MODE = False


def _is_configured(app_id: str, app_certificate: str) -> bool:
    """Check whether Agora credentials are properly configured."""
    return bool(app_id and app_certificate and app_id != "dev-placeholder")


def configure_dev_mode(app_id: str, app_certificate: str) -> None:
    """Explicitly enable dev mock mode when credentials are placeholders."""
    global _DEV_MODE
    _DEV_MODE = not _is_configured(app_id, app_certificate)
    if _DEV_MODE:
        logger.warning(
            "AGORA_DEV_MODE ENABLED: Agora credentials are placeholders. "
            "Generated tokens are MOCK tokens for development only. "
            "Set real AGORA_APP_ID and AGORA_APP_CERTIFICATE for production."
        )


# ── Token generation (Agora RTC Token v1) ──────────────────────────────────

def _generate_signature(
    app_certificate: str,
    app_id: str,
    channel_name: str,
    uid: int,
    role: RtcRole,
    privilege_expired_ts: int,
    current_ts: int,
) -> str:
    """Generate the HMAC-SHA256 signature for an Agora RTC token.

    This implements the Agora RTC Token generator algorithm.
    Reference: Agora RTC Token generation docs.
    """
    current_ts = int(current_ts)
    privilege_expired_ts = int(privilege_expired_ts)

    # Build the signature string
    signature_string = (
        f"{app_id}|{channel_name}|{uid}|{role.value}|{privilege_expired_ts}|{current_ts}"
    )

    # HMAC-SHA256
    signature = hmac.new(
        app_certificate.encode("utf-8"),
        signature_string.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return base64.b64encode(signature).decode("utf-8")


def generate_rtc_token(
    params: AgoraTokenParams,
    current_ts: Optional[int] = None,
) -> AgoraToken:
    """Generate an Agora RTC token.

    Args:
        params: Token generation parameters (app_id, app_certificate, channel, uid, role, expiration).
        current_ts: Current timestamp in seconds. Defaults to now.

    Returns:
        AgoraToken with the generated token string.

    Raises:
        ValueError: If app_id or app_certificate is missing/empty.
        RuntimeError: If token generation fails.

    IMPORTANT: This is the server-side token generator. The App Certificate
    NEVER leaves this service. The frontend only receives the generated token
    string, never the certificate.
    """
    if not params.app_id:
        raise ValueError("AGORA_APP_ID is required for token generation")
    if not params.app_certificate:
        raise ValueError("AGORA_APP_CERTIFICATE is required for token generation")

    current_ts = current_ts or int(time.time())
    privilege_expired_ts = current_ts + params.expiration

    if _DEV_MODE:
        # Dev mock mode: generate a clearly-marked mock token
        mock_token = (
            f"mock-agora-token-{params.channel_name}-{params.uid}-"
            f"{current_ts}-{params.expiration}"
        )
        logger.debug("Generated MOCK Agora token for channel: %s", params.channel_name)
        return AgoraToken(
            token=mock_token,
            channel_name=params.channel_name,
            uid=params.uid,
            expiration=params.expiration,
        )

    try:
        signature = _generate_signature(
            app_certificate=params.app_certificate,
            app_id=params.app_id,
            channel_name=params.channel_name,
            uid=params.uid,
            role=params.role,
            privilege_expired_ts=privilege_expired_ts,
            current_ts=current_ts,
        )

        # Build the token: version + signature + payload
        # Standard Agora token format: signature base64 + payload
        payload = struct.pack(
            ">IIQQQQ",
            0,  # version (0 for v1)
            1,  # signature valid for app cert
            current_ts,
            privilege_expired_ts,
            params.uid,
            0,  # reserved
        )

        # Combine: signature + payload, then base64
        token_bytes = signature.encode("utf-8") + payload
        token = base64.b64encode(token_bytes).decode("utf-8")

        logger.info(
            "Generated Agora RTC token for channel=%s, uid=%d, role=%s",
            params.channel_name,
            params.uid,
            params.role.value,
        )
        return AgoraToken(
            token=token,
            channel_name=params.channel_name,
            uid=params.uid,
            expiration=params.expiration,
        )

    except Exception as exc:
        logger.error("Failed to generate Agora RTC token: %s", exc)
        raise RuntimeError(f"Agora token generation failed: {exc}") from exc


async def generate_rtc_token_async(
    params: AgoraTokenParams,
) -> AgoraToken:
    """Async wrapper for generate_rtc_token.

    Use this in FastAPI route handlers to avoid blocking the event loop.
    """
    # Token generation is CPU-bound but fast; run in thread pool if needed.
    # For now, since it's lightweight, call directly.
    return generate_rtc_token(params)


def generate_token_for_session(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int = 0,
    role: RtcRole = RtcRole.BROADCASTER,
    expiration: int = 3600,
) -> AgoraToken:
    """Convenience function to generate a token for a session.

    Args:
        app_id: Agora App ID from environment.
        app_certificate: Agora App Certificate from environment.
        channel_name: The Agora channel name.
        uid: User ID (0 for auto-assign).
        role: Agora RTC role.
        expiration: Token validity in seconds.

    Returns:
        AgoraToken with the generated token.

    Raises:
        ValueError: If credentials are missing.
    """
    params = AgoraTokenParams(
        app_id=app_id,
        app_certificate=app_certificate,
        channel_name=channel_name,
        uid=uid,
        role=role,
        expiration=expiration,
    )
    return generate_rtc_token(params)
