"""Pydantic schemas for candidate operations."""
from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr


# --- Profile ---
class CandidateProfileBase(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    target_domain: Optional[str] = None
    experience_level: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    leetcode_url: Optional[str] = None
    skills: Optional[str] = None  # JSON string
    education: Optional[str] = None  # JSON string
    certifications: Optional[str] = None  # JSON string
    system_checks: Optional[str] = None  # JSON string
    sample_video_url: Optional[str] = None
    analysis_result: Optional[str] = None  # JSON string


class CandidateProfileRequest(CandidateProfileBase):
    pass


class CandidateProfileResponse(CandidateProfileBase):
    id: str
    role: str = "student"
    created_at: datetime
    resume_url: Optional[str] = None


# --- System Check & Analysis Schemas ---
class SystemCheckRequest(BaseModel):
    camera: bool
    microphone: bool
    screen_share: bool
    network: bool
    network_latency_ms: Optional[int] = None


class SystemCheckResponse(BaseModel):
    status: str  # "PASS" | "FAIL"
    camera: str  # "PASS" | "FAIL"
    microphone: str  # "PASS" | "FAIL"
    screen_share: str  # "PASS" | "FAIL"
    network: str  # "PASS" | "FAIL"
    message: str


class SampleVideoSubmitRequest(BaseModel):
    duration_seconds: float
    question: str = "What is your favourite colour?"
    video_base64: Optional[str] = None


class AnalysisResultResponse(BaseModel):
    status: str  # "APPROVED" | "REJECTED"
    camera_status: str
    camera_details: str
    microphone_status: str
    microphone_details: str
    screen_share_status: str
    screen_share_details: str
    video_recording_status: str
    video_recording_details: str
    duration_seconds: float
    overall_recommendation: str


# --- Resume ---
class ResumeUploadResponse(BaseModel):
    resume_url: str
    filename: str
    message: str


# --- Skills ---
class SkillsUpdateRequest(BaseModel):
    skills: str  # JSON string array


# --- Certificates ---
class CertificateCreateRequest(BaseModel):
    certificate_name: str
    issuer: str
    issue_date: str
    credential_url: Optional[str] = None
    document_url: Optional[str] = None


class CertificateResponse(BaseModel):
    id: str
    certificate_name: str
    issuer: str
    issue_date: str
    credential_url: Optional[str] = None
    document_url: Optional[str] = None
    created_at: str


# --- Setup / Interview Configuration ---
class SetupParseRequest(BaseModel):
    user_input: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    domain: Optional[str] = None
    resumeText: Optional[str] = None
    mode: str = "practice"  # "practice" or "assessment"
    existing_profile: Optional[dict] = None


class SetupParseResponse(BaseModel):
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    target_company_type: Optional[str] = None
    panel: list[str] = Field(default_factory=list)
    difficulty_seed: dict = Field(default_factory=dict)
    est_duration_minutes: int = 20
    focus_areas: list[str] = Field(default_factory=list)
    # Frontend aliases
    suggestedPersonas: Optional[list[str]] = None
    estimatedDuration: Optional[int] = None
    focusAreas: Optional[list[str]] = None
    difficulty: Optional[str] = "Medium"
    company: Optional[str] = None
    role: Optional[str] = None
    domain: Optional[str] = None
    data: Optional[dict[str, Any]] = None



class InterviewSetupConfirmRequest(BaseModel):
    company: str
    role: str
    domain: str
    personas: list[str]
    difficulty: str = "medium"
    estimated_duration: int = 20
    focus_areas: list[str]


# --- Competency Dashboard ---
class CompetencyDashboardEntry(BaseModel):
    competency: str
    score: Optional[float] = None
    progress: Optional[float] = None
    trend: Optional[str] = None  # "improving", "stable", "declining", "needs_work"
    sessions_count: Optional[int] = None


class CandidateStatsResponse(BaseModel):
    average_score: Optional[float] = None
    strongest_competency: Optional[str] = None
    weakest_competency: Optional[str] = None
    upcoming_interviews: int = 0
    completed_interviews: int = 0
    roadmap_progress: dict
    competency_breakdown: list[CompetencyDashboardEntry]


# --- Interview History ---
class InterviewHistoryEntry(BaseModel):
    id: str
    mode: str
    target_role: str
    target_company: Optional[str] = None
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    duration_minutes: Optional[int] = None


class InterviewHistoryResponse(BaseModel):
    interviews: list[InterviewHistoryEntry]
    total: int
    page: int = 1
    page_size: int = 20
