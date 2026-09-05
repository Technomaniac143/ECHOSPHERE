"""EchoSphere MCP Whiteboard Server — thin interface over Postgres whiteboard tables.

Exposes 9 tools (read_context, add_claim, update_competency, open_thread,
resolve_thread, flag_contradiction, flag_vagueness, get_difficulty,
set_difficulty) via the MCP SDK. Every mutation writes an audit row to
``whiteboard_events`` so the event log is the source of truth.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa
from fastapi import HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.database import async_session_factory
from app.models.whiteboard import (
    EventTypeName,
    SessionStatus,
    WhiteboardEvent,
    WhiteboardState,
    enumerate_difficulty_levels,
)


# ---------------------------------------------------------------------------
# Tool request schemas (Pydantic)
# ---------------------------------------------------------------------------

class ReadContextRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)


class AddClaimRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    claim_text: str = Field(..., min_length=1, max_length=4000)
    competency_tags: list[str] = Field(default_factory=list)


class UpdateCompetencyRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    competency: str = Field(..., min_length=1, max_length=128)
    delta_or_value: float | None = Field(default=None)
    evidence_claim_id: str | None = Field(default=None)


class OpenThreadRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    description: str = Field(..., min_length=1, max_length=4000)
    assigned_persona_hint: str | None = Field(default=None)


class ResolveThreadRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    thread_id: str = Field(..., min_length=1, max_length=36)
    resolution_claim_id: str | None = Field(default=None)


class FlagContradictionRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    claim_id_a: str = Field(..., min_length=1, max_length=36)
    claim_id_b: str = Field(..., min_length=1, max_length=36)
    note: str = Field(..., min_length=1, max_length=2000)


class FlagVaguenessRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    claim_id: str = Field(..., min_length=1, max_length=36)
    note: str = Field(..., min_length=1, max_length=2000)


class GetDifficultyRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    competency: str = Field(..., min_length=1, max_length=128)


class SetDifficultyRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=36)
    competency: str = Field(..., min_length=1, max_length=128)
    level: str = Field(..., min_length=1, max_length=32)


# ---------------------------------------------------------------------------
# Tool functions (async, take a request Pydantic model, return JSON-serializable)
# ---------------------------------------------------------------------------


async def tool_read_context(request: ReadContextRequest) -> dict[str, Any]:
    """Read the full current whiteboard state for a session."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)
        return ws.to_dict()

    return await _run_in_session(_run)


async def tool_add_claim(request: AddClaimRequest) -> dict[str, Any]:
    """Add a claim to the whiteboard and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        claim_id = str(uuid.uuid4())
        payload: dict[str, Any] = {
            "claim_id": claim_id,
            "claim_text": request.claim_text,
            "competency_tags": request.competency_tags,
        }
        claim_entry: dict[str, Any] = {
            "id": claim_id,
            "text": request.claim_text,
            "competency_tags": request.competency_tags,
            "ts": _now().isoformat(),
        }

        ws.claims.append(claim_entry)
        ws.updated_at = _now()

        _write_event(
            db,
            request.session_id,
            EventTypeName.claim.value,
            payload,
        )

        return {"claim_id": claim_id}

    return await _run_in_session(_run)


async def tool_update_competency(request: UpdateCompetencyRequest) -> dict[str, Any]:
    """Update a competency score (absolute value or delta) and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        ledger = ws.competency_ledger
        if not isinstance(ledger, dict):
            ledger = {}

        current = ledger.get(request.competency, 0.0)
        if not isinstance(current, (int, float)):
            current = 0.0

        delta_or_value = request.delta_or_value
        if delta_or_value is None:
            raise HTTPException(status_code=400, detail="delta_or_value is required")

        new_value: float
        if request.evidence_claim_id:
            new_value = float(delta_or_value)
        else:
            new_value = float(current) + float(delta_or_value)

        ledger[request.competency] = new_value
        ws.competency_ledger = ledger
        ws.updated_at = _now()

        payload: dict[str, Any] = {
            "competency": request.competency,
            "old_value": current,
            "new_value": new_value,
            "evidence_claim_id": request.evidence_claim_id,
        }
        event_id = _write_event(
            db,
            request.session_id,
            EventTypeName.competency_update.value,
            payload,
        )

        return {"ok": True, "event_id": event_id}

    return await _run_in_session(_run)


async def tool_open_thread(request: OpenThreadRequest) -> dict[str, Any]:
    """Open a new thread on the whiteboard and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        thread_id = str(uuid.uuid4())
        thread_entry: dict[str, Any] = {
            "id": thread_id,
            "description": request.description,
            "assigned_persona_hint": request.assigned_persona_hint,
            "status": "open",
            "ts": _now().isoformat(),
        }
        ws.open_threads.append(thread_entry)
        ws.updated_at = _now()

        payload: dict[str, Any] = {
            "thread_id": thread_id,
            "description": request.description,
            "assigned_persona_hint": request.assigned_persona_hint,
        }
        event_id = _write_event(
            db,
            request.session_id,
            EventTypeName.open_thread_opened.value,
            payload,
        )

        return {"thread_id": thread_id, "event_id": event_id}

    return await _run_in_session(_run)


async def tool_resolve_thread(request: ResolveThreadRequest) -> dict[str, Any]:
    """Resolve an open thread and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        found = False
        for thread in ws.open_threads:
            if thread.get("id") == request.thread_id or thread.get("thread_id") == request.thread_id:
                thread["status"] = "resolved"
                thread["resolved_at"] = _now().isoformat()
                if request.resolution_claim_id:
                    thread["resolution_claim_id"] = request.resolution_claim_id
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Thread {request.thread_id} not found")

        ws.updated_at = _now()

        payload: dict[str, Any] = {
            "thread_id": request.thread_id,
            "resolution_claim_id": request.resolution_claim_id,
        }
        event_id = _write_event(
            db,
            request.session_id,
            EventTypeName.open_thread_resolved.value,
            payload,
        )

        return {"ok": True, "event_id": event_id}

    return await _run_in_session(_run)


async def tool_flag_contradiction(request: FlagContradictionRequest) -> dict[str, Any]:
    """Flag a contradiction between two claims and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        flag_id = str(uuid.uuid4())
        flag_entry: dict[str, Any] = {
            "id": flag_id,
            "claim_id_a": request.claim_id_a,
            "claim_id_b": request.claim_id_b,
            "note": request.note,
            "ts": _now().isoformat(),
            "status": "flagged",
        }
        ws.contradiction_flags.append(flag_entry)
        ws.updated_at = _now()

        payload: dict[str, Any] = {
            "claim_id_a": request.claim_id_a,
            "claim_id_b": request.claim_id_b,
            "note": request.note,
        }
        event_id = _write_event(
            db,
            request.session_id,
            EventTypeName.contradiction_flag.value,
            payload,
        )

        return {"flag_id": flag_id, "event_id": event_id}

    return await _run_in_session(_run)


async def tool_flag_vagueness(request: FlagVaguenessRequest) -> dict[str, Any]:
    """Flag a vagueness on a claim and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        flag_id = str(uuid.uuid4())
        flag_entry: dict[str, Any] = {
            "id": flag_id,
            "claim_id": request.claim_id,
            "note": request.note,
            "ts": _now().isoformat(),
            "status": "flagged",
        }
        ws.vagueness_flags.append(flag_entry)
        ws.updated_at = _now()

        payload: dict[str, Any] = {
            "claim_id": request.claim_id,
            "note": request.note,
        }
        event_id = _write_event(
            db,
            request.session_id,
            EventTypeName.vagueness_flag.value,
            payload,
        )

        return {"flag_id": flag_id, "event_id": event_id}

    return await _run_in_session(_run)


async def tool_get_difficulty(request: GetDifficultyRequest) -> dict[str, Any]:
    """Get the current difficulty level for a competency."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        difficulty = ws.difficulty_state
        if not isinstance(difficulty, dict):
            difficulty = {}

        level = difficulty.get(request.competency, "medium")
        return {"competency": request.competency, "level": str(level), "session_id": request.session_id}

    return await _run_in_session(_run)


async def tool_set_difficulty(request: SetDifficultyRequest) -> dict[str, Any]:
    """Set the difficulty level for a competency and record the event."""

    async def _run(db: Any) -> dict[str, Any]:
        _ensure_session(request.session_id, db)
        ws = _ensure_whiteboard_state(request.session_id, db)

        valid_levels = set(enumerate_difficulty_levels())
        level_lower = request.level.strip().lower()
        if level_lower not in valid_levels:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid difficulty level {request.level!r}. Valid: {sorted(valid_levels)}",
            )

        difficulty = ws.difficulty_state
        if not isinstance(difficulty, dict):
            difficulty = {}

        old_level = difficulty.get(request.competency, "medium")
        difficulty[request.competency] = level_lower
        ws.difficulty_state = difficulty
        ws.updated_at = _now()

        payload: dict[str, Any] = {
            "competency": request.competency,
            "old_level": old_level,
            "new_level": level_lower,
        }
        event_id = _write_event(
            db,
            request.session_id,
            EventTypeName.difficulty_change.value,
            payload,
        )

        return {"ok": True, "event_id": event_id}

    return await _run_in_session(_run)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_session(session_id: str, db: Any) -> bool:
    """Return True if a session with this id exists and is active."""
    from app.models.session import Session

    stmt = sa.select(Session).where(Session.id == session_id)
    result = db.execute(stmt)
    session: Session | None = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if session.status not in (SessionStatus.in_progress, SessionStatus.lobby):
        raise HTTPException(
            status_code=409,
            detail=f"Session {session_id} is not active (status={session.status.value})",
        )
    return True


def _ensure_whiteboard_state(session_id: str, db: Any) -> WhiteboardState:
    """Get or create the materialized whiteboard state row."""
    stmt = sa.select(WhiteboardState).where(WhiteboardState.session_id == session_id)
    result = db.execute(stmt)
    ws: WhiteboardState | None = result.scalar_one_or_none()
    if ws is None:
        ws = WhiteboardState(session_id=session_id)
        db.add(ws)
    return ws


def _write_event(
    db: Any,
    session_id: str,
    event_type: str,
    payload: dict[str, Any] | None,
    source_persona: str | None = None,
) -> str:
    event = WhiteboardEvent(
        id=str(uuid.uuid4()),
        session_id=session_id,
        ts=_now(),
        event_type=event_type,
        payload=payload,
        source_persona=source_persona,
    )
    db.add(event)
    return event.id


async def _run_in_session(fn):
    async with async_session_factory() as db:
        try:
            result = await fn(db)
            await db.commit()
            return result
        except HTTPException:
            await db.rollback()
            raise
        except Exception as exc:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


# ---------------------------------------------------------------------------
# MCP server + SSE transport wiring (via MCPServer)
# ---------------------------------------------------------------------------

def _build_mcp_server() -> Any:
    import mcp.server.mcpserver as ms

    mcp_server = ms.MCPServer(
        name="echosphere-whiteboard",
        description="EchoSphere whiteboard MCP server — 9 tools over Postgres.",
        version="1.0.0",
    )
    mcp_server.add_tool(tool_read_context, name="read_context")
    mcp_server.add_tool(tool_add_claim, name="add_claim")
    mcp_server.add_tool(tool_update_competency, name="update_competency")
    mcp_server.add_tool(tool_open_thread, name="open_thread")
    mcp_server.add_tool(tool_resolve_thread, name="resolve_thread")
    mcp_server.add_tool(tool_flag_contradiction, name="flag_contradiction")
    mcp_server.add_tool(tool_flag_vagueness, name="flag_vagueness")
    mcp_server.add_tool(tool_get_difficulty, name="get_difficulty")
    mcp_server.add_tool(tool_set_difficulty, name="set_difficulty")
    return mcp_server


async def serve_mcp_whiteboard() -> None:
    """Long-running MCP whiteboard server (SSE transport)."""
    import uvicorn

    mcp_server = _build_mcp_server()

    # SSE transport
    await mcp_server.run_sse_async(
        host=settings.mcp_whiteboard_listen_host,
        port=settings.mcp_whiteboard_listen_port,
        sse_path="/sse",
        message_path="/messages/",
    )
    # Note: run_sse_async does not return; the above is the entry point.


async def run_mcp_whiteboard() -> None:
    await serve_mcp_whiteboard()
