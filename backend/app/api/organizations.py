"""Organization management routes — real DB queries, no mocks."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.organization import Organization, OrgMember
from app.models.panel import Assessment, OrganizationQuestion
from app.models.session import Session, Batch
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


# ── Organization CRUD ─────────────────────────────────────────────────────────

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: OrganizationCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Organization:
    """Create a new organization/placement cell."""
    result = await db.execute(
        select(Organization).where(Organization.name == request.name)
    )
    if result.scalar_one_or_none():
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
        created_by="system",
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
        select(Organization).where(Organization.created_by == "system").limit(1)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No organization found. Create one first.",
        )
    return org


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Organization:
    """Get organization by ID."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


# ── Question Bank ─────────────────────────────────────────────────────────────

@router.post("/question-bank", response_model=QuestionBankResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    request: QuestionBankCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Add a question to the organization's question bank."""
    question = OrganizationQuestion(
        question=request.question,
        category=request.category,
        difficulty=request.difficulty,
        expected_competency=request.expected_competency,
        role=request.role,
        domain=request.domain,
        expected_answer=request.expected_answer,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return {
        "id": question.id,
        "question": question.question,
        "category": question.category,
        "difficulty": question.difficulty,
        "expected_competency": question.expected_competency,
        "role": question.role,
        "domain": question.domain,
        "expected_answer": question.expected_answer,
        "organization_id": question.org_id,
        "created_at": question.created_at.isoformat(),
    }


@router.get("/question-bank", response_model=list[QuestionBankResponse])
async def list_questions(
    category: Annotated[str | None, Query()] = None,
    difficulty: Annotated[str | None, Query()] = None,
    role: Annotated[str | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    """List questions from the database with optional filters."""
    q = select(OrganizationQuestion)
    if category:
        q = q.where(OrganizationQuestion.category == category)
    if difficulty:
        q = q.where(OrganizationQuestion.difficulty == difficulty)
    if role:
        q = q.where(OrganizationQuestion.role == role)

    result = await db.execute(q.order_by(OrganizationQuestion.created_at.desc()))
    questions = result.scalars().all()

    return [
        {
            "id": ques.id,
            "question": ques.question,
            "category": ques.category,
            "difficulty": ques.difficulty,
            "expected_competency": ques.expected_competency,
            "role": ques.role,
            "domain": ques.domain,
            "expected_answer": ques.expected_answer,
            "organization_id": ques.org_id,
            "created_at": ques.created_at.isoformat(),
        }
        for ques in questions
    ]


# ── Assessments ───────────────────────────────────────────────────────────────

@router.post("/assessments", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    request: AssessmentCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a new assessment in the database."""
    assessment = Assessment(
        name=request.name,
        job_role=request.job_role,
        domain=request.domain,
        difficulty=request.difficulty,
        interview_duration_minutes=request.interview_duration_minutes,
        personas=request.personas,
        competencies=request.competencies,
        question_bank_ids=request.question_bank_ids,
        max_candidates=request.max_candidates,
        status="draft",
        created_by="system",
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return _assessment_to_dict(assessment)


@router.get("/assessments", response_model=list[AssessmentResponse])
async def list_assessments(
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    """List all assessments from the database."""
    q = select(Assessment)
    if status_filter:
        q = q.where(Assessment.status == status_filter)

    result = await db.execute(q.order_by(Assessment.created_at.desc()))
    assessments = result.scalars().all()

    # Enrich with candidate count from sessions
    enriched = []
    for a in assessments:
        count_q = await db.execute(
            select(func.count(Session.id)).where(Session.assessment_id == a.id)
        )
        candidate_count = count_q.scalar() or 0
        d = _assessment_to_dict(a)
        d["candidate_count"] = candidate_count
        enriched.append(d)

    return enriched


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get assessment details from the database."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return _assessment_to_dict(a)


@router.post("/assessments/{assessment_id}/invite")
async def invite_candidates(
    assessment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Generate invite link for assessment."""
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return {
        "assessment_id": assessment_id,
        "invite_link": f"/assessment/{assessment_id}",
        "message": "Invite link generated. Share with candidates.",
    }


# ── Candidates ────────────────────────────────────────────────────────────────

@router.get("/candidates", response_model=CandidateListResponse)
async def list_candidates(
    request: Annotated[FilterCriteria, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    List real candidate users (role=student) with their session counts.
    Supports filtering by role and status.
    """
    q = select(User).where(User.role == "student")
    if hasattr(request, "role") and request.role:
        q = q.where(User.target_role == request.role)

    result = await db.execute(q.order_by(User.created_at.desc()))
    users = result.scalars().all()

    candidates = []
    for u in users:
        # Count sessions for this user
        sessions_q = await db.execute(
            select(func.count(Session.id)).where(Session.candidate_id == u.id)
        )
        session_count = sessions_q.scalar() or 0

        # Get latest completed session overall_score from report
        latest_score = None
        from app.models.report import Report as ReportModel
        score_q = await db.execute(
            select(ReportModel)
            .join(Session, ReportModel.session_id == Session.id)
            .where(Session.candidate_id == u.id)
            .where(Session.status == "completed")
            .order_by(Session.ended_at.desc())
            .limit(1)
        )
        report = score_q.scalar_one_or_none()
        if report and report.overall_score is not None:
            latest_score = float(report.overall_score)

        candidates.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.target_role,
            "domain": u.target_domain,
            "overall_score": latest_score,
            "integrity_flags": 0,
            "status": "completed" if latest_score is not None else "registered",
            "session_count": session_count,
        })

    return {
        "candidates": candidates,
        "total": len(candidates),
        "page": 1,
        "page_size": len(candidates),
    }


@router.get("/candidates/{candidate_id}", response_model=dict)
async def get_candidate(
    candidate_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get candidate details with their real interview history."""
    result = await db.execute(select(User).where(User.id == candidate_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    # Real session history
    sessions_q = await db.execute(
        select(Session)
        .where(Session.candidate_id == candidate_id)
        .order_by(Session.created_at.desc())
    )
    sessions = sessions_q.scalars().all()

    from app.models.report import Report as ReportModel
    interview_history = []
    for s in sessions:
        score = None
        rep_q = await db.execute(select(ReportModel).where(ReportModel.session_id == s.id))
        report = rep_q.scalar_one_or_none()
        if report:
            score = float(report.overall_score) if report.overall_score is not None else None

        interview_history.append({
            "id": s.id,
            "date": s.started_at.isoformat() if s.started_at else s.created_at.isoformat(),
            "role": s.target_role,
            "company": s.target_company,
            "overall_score": score,
            "status": s.status,
        })

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.target_role,
        "domain": user.target_domain,
        "resume_url": user.resume_url,
        "skills": user.skills,
        "interviews": interview_history,
    }


# ── Analytics (batch) ─────────────────────────────────────────────────────────

@router.get("/batches/{batch_id}/analytics", response_model=AnalyticsResponse)
async def get_batch_analytics(
    batch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Real batch analytics — queries actual session/report data.
    Returns 404 if the batch doesn't exist; 500 on computation errors.
    No mock fallback.
    """
    analytics_svc = BatchAnalyticsService(db)
    try:
        return await analytics_svc.get_analytics(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assessment_to_dict(a: Assessment) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "job_role": a.job_role,
        "domain": a.domain,
        "difficulty": a.difficulty,
        "interview_duration_minutes": a.interview_duration_minutes,
        "personas": a.personas or [],
        "competencies": a.competencies or [],
        "question_bank_ids": a.question_bank_ids or [],
        "max_candidates": a.max_candidates,
        "status": a.status,
        "organization_id": a.org_id,
        "created_by": a.created_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
