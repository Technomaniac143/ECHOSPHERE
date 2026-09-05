"""Organization management routes — dashboard, question bank, assessments, candidates, analytics."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreateRequest,
    OrganizationResponse,
    QuestionBankCreateRequest,
    QuestionBankResponse,
    AssessmentCreateRequest,
    AssessmentResponse,
    CandidateListResponse,
    AnalyticsResponse,
    FilterCriteria,
)
from app.services.reporting.analytics import BatchAnalyticsService

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: OrganizationCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Organization:
    """Create a new organization/placement cell."""
    # Check if already exists
    result = await db.execute(
        select(Organization).where(Organization.name == request.name)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization with this name already exists",
        )
    
    org = Organization(
        name=request.name,
        official_email=request.official_email,
        website=request.website,
        industry=request.industry,
        company_size=request.company_size,
        location=request.location,
        hr_name=request.hr_name,
        hr_phone=request.hr_phone,
        created_by="system",  # Would be from auth context
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    
    return org


@router.get("/my", response_model=OrganizationResponse)
async def get_my_organization(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Organization:
    """Get the current user's organization."""
    result = await db.execute(
        select(Organization)
        .where(Organization.created_by == "system")  # Simplified
        .limit(1)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    
    return org


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Organization:
    """Get organization by ID."""
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    
    return org


# Question Bank
@router.post("/question-bank", response_model=QuestionBankResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    request: QuestionBankCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Add a question to the organization's question bank."""
    question = {
        "id": "q_" + str(hash(request.question))[:8],
        "question": request.question,
        "category": request.category,
        "difficulty": request.difficulty,
        "expected_competency": request.expected_competency,
        "role": request.role,
        "domain": request.domain,
        "expected_answer": request.expected_answer,
        "organization_id": "org_1",  # From auth context
        "created_at": "now",
    }
    return question


@router.get("/question-bank", response_model=list[QuestionBankResponse])
async def list_questions(
    category: Annotated[str | None, Query()] = None,
    difficulty: Annotated[str | None, Query()] = None,
    role: Annotated[str | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    """List questions from organization's question bank with optional filters."""
    # Simplified — in production, query the database
    return [
        {
            "id": "q_001",
            "question": "How would you design a URL shortening service?",
            "category": "System Design",
            "difficulty": "Hard",
            "expected_competency": "Architecture",
            "role": "Backend Engineer",
            "domain": "Software Engineering",
        },
        {
            "id": "q_002",
            "question": "Explain how you would design a scalable notification system.",
            "category": "System Design",
            "difficulty": "Hard",
            "expected_competency": "Architecture",
            "role": "Backend Engineer",
            "domain": "Software Engineering",
        },
    ]


# Assessments
@router.post("/assessments", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    request: AssessmentCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a new assessment for candidate evaluation."""
    assessment = {
        "id": "ast_" + str(hash(request.name))[:8],
        "name": request.name,
        "job_role": request.job_role,
        "domain": request.domain,
        "difficulty": request.difficulty,
        "interview_duration_minutes": request.interview_duration_minutes,
        "personas": request.personas,
        "competencies": request.competencies,
        "question_bank_ids": request.question_bank_ids,
        "max_candidates": request.max_candidates,
        "status": "draft",
        "organization_id": "org_1",
        "created_by": "hr_admin",
        "created_at": "now",
    }
    return assessment


@router.get("/assessments", response_model=list[AssessmentResponse])
async def list_assessments(
    status_filter: Annotated[str | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    """List all assessments for the organization."""
    return [
        {
            "id": "ast_001",
            "name": "Backend Engineer Hiring Loop",
            "job_role": "Backend Engineer",
            "domain": "Software Engineering",
            "difficulty": "Medium",
            "interview_duration_minutes": 20,
            "personas": ["technical", "product", "hiring_manager", "behavioral"],
            "status": "active",
            "candidate_count": 5,
        },
    ]


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get assessment details."""
    return {
        "id": assessment_id,
        "name": "Backend Engineer Hiring Loop",
        "job_role": "Backend Engineer",
        "domain": "Software Engineering",
        "difficulty": "Medium",
        "interview_duration_minutes": 20,
        "personas": ["technical", "product", "hiring_manager", "behavioral"],
        "competencies": ["Technical", "Problem Solving", "Communication", "Product Thinking"],
        "status": "active",
    }


@router.post("/assessments/{assessment_id}/invite")
async def invite_candidates(
    assessment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Generate invite link for assessment."""
    return {
        "assessment_id": assessment_id,
        "invite_link": f"/assessment/{assessment_id}",
        "message": "Invite link generated. Share with candidates.",
    }


# Candidates
@router.get("/candidates", response_model=CandidateListResponse)
async def list_candidates(
    request: Annotated[FilterCriteria, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """List candidates with filtering and sorting."""
    # In production, build dynamic query from FilterCriteria
    candidates = [
        {
            "id": "cand_001",
            "name": "Arjun Sharma",
            "email": "arjun@example.com",
            "role": "Backend Engineer",
            "domain": "Software Engineering",
            "interview_date": "2026-09-10T10:00:00Z",
            "overall_score": 82,
            "technical_score": 85,
            "product_score": 78,
            "behavioral_score": 80,
            "leadership_score": 84,
            "integrity_flags": 0,
            "status": "completed",
        },
        {
            "id": "cand_002",
            "name": "Priya Nair",
            "email": "priya@example.com",
            "role": "Backend Engineer",
            "domain": "Software Engineering",
            "interview_date": "2026-09-10T14:00:00Z",
            "overall_score": 76,
            "technical_score": 72,
            "product_score": 80,
            "behavioral_score": 75,
            "leadership_score": 78,
            "integrity_flags": 1,
            "status": "completed",
        },
        {
            "id": "cand_003",
            "name": "Rahul Mehta",
            "email": "rahul@example.com",
            "role": "Backend Engineer",
            "domain": "Software Engineering",
            "interview_date": "2026-09-11T10:00:00Z",
            "overall_score": None,
            "technical_score": None,
            "product_score": None,
            "behavioral_score": None,
            "leadership_score": None,
            "integrity_flags": 0,
            "status": "scheduled",
        },
    ]
    
    return {
        "candidates": candidates,
        "total": len(candidates),
        "page": 1,
        "page_size": 20,
    }


@router.get("/candidates/{candidate_id}", response_model=dict)
async def get_candidate(
    candidate_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get candidate details with their interview history."""
    # In production, query database
    return {
        "id": candidate_id,
        "name": "Arjun Sharma",
        "email": "arjun@example.com",
        "role": "Backend Engineer",
        "domain": "Software Engineering",
        "resume_url": "/uploads/resumes/arjun.pdf",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker"],
        "interviews": [
            {
                "id": "sess_001",
                "date": "2026-09-10T10:00:00Z",
                "overall_score": 82,
                "status": "completed",
            },
        ],
    }


# Analytics
@router.get("/batches/{batch_id}/analytics", response_model=AnalyticsResponse)
async def get_batch_analytics(
    batch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get batch analytics — score distributions, flag frequencies, panel disagreement."""
    analytics_svc = BatchAnalyticsService(db)
    
    try:
        analytics = await analytics_svc.get_analytics(batch_id)
        return analytics
    except Exception as e:
        # Return mock data for demo if real analytics fails
        return {
            "batch_id": batch_id,
            "total_candidates": 25,
            "average_overall_score": 74.3,
            "score_distribution": {
                "excellent": 3,
                "good": 12,
                "average": 7,
                "below_average": 2,
                "poor": 1,
            },
            "technical_distribution": [85, 82, 78, 75, 72, 70, 68, 65, 62, 60],
            "behavioral_distribution": [80, 78, 75, 72, 70, 68, 65, 62, 60, 58],
            "product_distribution": [78, 75, 72, 70, 68, 65, 62, 60, 58, 55],
            "panel_disagreement_rate": 0.18,
            "vagueness_frequency": 0.22,
            "contradiction_frequency": 0.08,
            "integrity_event_frequency": 0.12,
        }
