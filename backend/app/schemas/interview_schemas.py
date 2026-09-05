"""Schemas for interview operations."""
from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class InterviewCreateRequest(BaseModel):
    """Request to create a new interview session."""
    mode: str = "practice"  # "practice" or "assessment"
    panel_id: Optional[str] = None
    candidate_id: Optional[str] = None
    target_role: str
    target_company: Optional[str] = None
    target_domain: Optional[str] = None
    persona_list: list[str] = Field(default_factory=lambda: ["technical", "product", "hiring_manager", "behavioral"])
    difficulty_seed: Optional[dict] = None
    interview_duration_minutes: int = 20
    org_id: Optional[str] = None
    assessment_id: Optional[str] = None


class InterviewUpdateRequest(BaseModel):
    """Request to update an interview (e.g., change difficulty, add notes)."""
    notes: Optional[str] = None
    difficulty_overrides: Optional[dict] = None


class InterviewResponse(BaseModel):
    """Full interview session response."""
    id: str
    mode: str
    status: str
    panel_id: Optional[str] = None
    candidate_id: str
    target_role: str
    target_company: Optional[str] = None
    target_domain: Optional[str] = None
    persona_list: list[str]
    difficulty_seed: Optional[dict] = None
    interview_duration_minutes: int
    agora_channel_name: Optional[str] = None
    agora_agent_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Computed fields
    remaining_time_seconds: Optional[int] = None
    current_persona: Optional[str] = None
    whiteboard_state: Optional[dict] = None
    transcript: Optional[list] = None  # truncated/summarized


class InterviewListResponse(BaseModel):
    """Paginated list of interviews."""
    interviews: list[InterviewResponse]
    total: int
    page: int = 1
    page_size: int = 20


class InterviewStateResponse(BaseModel):
    """Real-time interview state for WebSocket/streaming."""
    session_id: str
    status: str
    current_persona: Optional[str] = None
    current_question: Optional[str] = None
    whiteboard_state: dict
    difficulty_state: dict
    remaining_time_seconds: int
    integrity_flags: list[dict] = []
    last_update: datetime


class QuestionGenerationRequest(BaseModel):
    """Request to generate a dynamic question."""
    session_id: str
    current_persona: str
    whiteboard_state: dict
    difficulty_state: dict
    previous_questions: list[str] = []
    candidate_context: dict


class QuestionResponse(BaseModel):
    """Generated question response."""
    question: str
    competency: str
    difficulty: str
    follow_up_prompt: Optional[str] = None
    persona: str
    reasoning: Optional[str] = None  # why this question was chosen


class AnswerEvaluationRequest(BaseModel):
    """Request to evaluate a candidate's answer."""
    session_id: str
    persona: str
    question: str
    answer: str
    whiteboard_state: dict
    transcript_turn_id: str
    ts_start: datetime
    ts_end: datetime


class AnswerEvaluationResponse(BaseModel):
    """Result of answer evaluation."""
    competency_scores: dict[str, float]  # competency -> score (0-1)
    claims: list[dict]  # extracted claims from the answer
    strengths: list[str]
    weaknesses: list[str]
    contradictions: list[dict]  # detected contradictions
    vagueness_flags: list[dict]  # detected vague statements
    open_threads: list[dict]  # threads to follow up on
    evidence: list[dict]  # evidence snippets with timestamps
    suggested_difficulty_changes: dict[str, str]  # competency -> new difficulty
    next_persona_hint: Optional[str] = None  # suggested next persona


class InterviewSetupRequest(BaseModel):
    """Request from setup agent parsing."""
    user_input: str
    mode: str = "practice"
    existing_profile: Optional[dict] = None


class InterviewSetupResponse(BaseModel):
    """Parsed interview setup configuration."""
    target_role: str
    target_company: Optional[str] = None
    target_company_type: Optional[str] = None
    panel: list[str]
    difficulty_seed: dict
    est_duration_minutes: int
    focus_areas: list[str]
    suggested_questions: list[str] = []
    confirmation_message: str


class InterviewConfirmationRequest(BaseModel):
    """User confirmation of interview setup."""
    company: str
    role: str
    domain: str
    personas: list[str]
    difficulty: str = "medium"
    estimated_duration: int = 20
    focus_areas: list[str]
    agreed_to_terms: bool = True
    agreed_to_ai_disclosure: bool = True


class InterviewStartRequest(BaseModel):
    """Request to start an interview session."""
    session_id: str
    candidate_voiceprint_id: Optional[str] = None
    initial_persona_system_prompt: Optional[str] = None
    greeting_text: Optional[str] = None
    agora_app_id: Optional[str] = None


class InterviewEndRequest(BaseModel):
    """Request to end an interview."""
    session_id: str
    reason: Optional[str] = None  # "completed", "abandoned", "timeout", "user_request"
