"""Pydantic schemas for organization operations."""
from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


# --- Organization ---
class OrganizationBase(BaseModel):
    name: str
    official_email: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    location: Optional[str] = None
    hr_name: Optional[str] = None
    hr_phone: Optional[str] = None


class OrganizationCreateRequest(OrganizationBase):
    pass


class OrganizationResponse(OrganizationBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    member_count: Optional[int] = None
    candidate_count: Optional[int] = None
    interview_count: Optional[int] = None


# --- Question Bank ---
class QuestionBankBase(BaseModel):
    question: str
    category: str
    difficulty: str = "medium"
    expected_competency: Optional[str] = None
    role: Optional[str] = None
    domain: Optional[str] = None
    expected_answer: Optional[str] = None


class QuestionBankCreateRequest(QuestionBankBase):
    pass


class QuestionBankResponse(QuestionBankBase):
    id: str
    organization_id: str
    assessment_id: Optional[str] = None
    created_at: str


# --- Assessment ---
class AssessmentBase(BaseModel):
    name: str
    job_role: str
    domain: str
    difficulty: str = "medium"
    interview_duration_minutes: int = 20
    personas: list[str] = Field(default_factory=lambda: ["technical", "product", "hiring_manager", "behavioral"])
    competencies: list[str] = Field(default_factory=list)
    question_bank_ids: list[str] = Field(default_factory=list)
    max_candidates: Optional[int] = 50


class AssessmentCreateRequest(AssessmentBase):
    pass


class AssessmentResponse(AssessmentBase):
    id: str
    status: str
    invite_link_code: Optional[str] = None
    organization_id: Optional[str] = None
    panel_id: Optional[str] = None
    created_by: str
    created_at: str
    candidate_count: Optional[int] = None


# --- Candidates ---
class FilterCriteria(BaseModel):
    overall_score_min: Optional[float] = None
    overall_score_max: Optional[float] = None
    technical_score_min: Optional[float] = None
    product_score_min: Optional[float] = None
    behavioral_score_min: Optional[float] = None
    hiring_score_min: Optional[float] = None
    status: Optional[str] = None
    role: Optional[str] = None
    domain: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    difficulty: Optional[str] = None
    integrity_flags_min: Optional[int] = None
    sort_by: Optional[str] = "overall_score"
    sort_order: Optional[str] = "desc"
    page: Optional[int] = 1
    page_size: Optional[int] = 20


class CandidateBrief(BaseModel):
    id: str
    name: str
    email: str
    role: Optional[str] = None
    domain: Optional[str] = None
    interview_date: Optional[str] = None
    overall_score: Optional[float] = None
    technical_score: Optional[float] = None
    product_score: Optional[float] = None
    behavioral_score: Optional[float] = None
    leadership_score: Optional[float] = None
    integrity_flags: int = 0
    status: str = "registered"
    session_count: Optional[int] = 0



class CandidateListResponse(BaseModel):
    candidates: list[CandidateBrief]
    total: int
    page: int
    page_size: int


# --- Analytics ---
class ScoreDistribution(BaseModel):
    excellent: int = 0  # 85+
    good: int = 0  # 70-84
    average: int = 0  # 55-69
    below_average: int = 0  # 40-54
    poor: int = 0  # <40


class AnalyticsResponse(BaseModel):
    batch_id: str
    total_candidates: int = 0
    completed_candidates: int = 0
    average_overall_score: Optional[float] = None
    score_distribution: ScoreDistribution
    technical_distribution: list[float] = Field(default_factory=list)
    behavioral_distribution: list[float] = Field(default_factory=list)
    product_distribution: list[float] = Field(default_factory=list)
    panel_disagreement_rate: float = 0.0
    vagueness_frequency: float = 0.0
    contradiction_frequency: float = 0.0
    integrity_event_frequency: float = 0.0
    top_candidates: list[CandidateBrief] = Field(default_factory=list)
    average_technical_score: Optional[float] = None
    average_behavioral_score: Optional[float] = None
    average_product_score: Optional[float] = None
