"""Session and interview schemas."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class SessionBase(BaseModel):
    mode: str = "practice"  # practice | assessment
    panel_id: Optional[str] = None
    target_role: str
    target_company: Optional[str] = None
    target_domain: Optional[str] = None
    

class SessionCreateRequest(SessionBase):
    candidate_id: Optional[str] = None
    org_id: Optional[str] = None
    persona_list: list[str] = Field(default_factory=lambda: ["technical", "product", "hiring_manager", "behavioral"])
    difficulty_seed: Optional[dict] = None
    interview_duration_minutes: int = 20
    assessment_id: Optional[str] = None


class SessionCreateResponse(SessionBase):
    id: str
    status: str
    candidate_id: str
    agora_channel_name: Optional[str] = None
    agora_agent_id: Optional[str] = None
    agora_token: Optional[str] = None
    persona_list: list[str]
    difficulty_seed: Optional[dict] = None
    interview_duration_minutes: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    sessions: list[SessionCreateResponse]
    total: int
    page: int = 1
    page_size: int = 20


class SessionStateResponse(BaseModel):
    session_id: str
    status: str
    current_persona: Optional[str] = None
    whiteboard_state: dict = {}
    remaining_time_seconds: int = 0
    last_update: datetime


class SessionStartRequest(BaseModel):
    session_id: str
    candidate_voiceprint_id: Optional[str] = None
    initial_persona_system_prompt: Optional[str] = None
    greeting_text: Optional[str] = None
    agora_app_id: Optional[str] = None


class SessionEndRequest(BaseModel):
    session_id: str
    reason: Optional[str] = None  # completed | abandoned


class SessionUpdate(BaseModel):
    id: str
    status: str
    ended_at: Optional[datetime] = None
    message: Optional[str] = None
