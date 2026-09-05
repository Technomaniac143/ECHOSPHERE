"""Candidate management routes — profile, resume, skills, setup parsing."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.candidate import (
    CandidateProfileRequest,
    CandidateProfileResponse,
    CertificateCreateRequest,
    CertificateResponse,
    ResumeUploadResponse,
    SetupParseRequest,
    SetupParseResponse,
    SkillsUpdateRequest,
)
from app.services.gemini.setup_agent import SetupAgent
from app.services.reporting.scoring import calculate_competency_dashboard

router = APIRouter(prefix="/candidate", tags=["candidate"])


@router.get("/profile", response_model=CandidateProfileResponse)
async def get_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get current candidate's profile."""
    # In practice, get user from auth context
    # For now, we look up by a default approach
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found",
        )
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "target_role": user.target_role,
        "target_company": user.target_company,
        "target_domain": user.target_domain,
        "experience_level": user.experience_level,
        "skills": user.skills,
        "resume_url": user.resume_url,
        "portfolio_url": user.portfolio_url,
        "github_url": user.github_url,
        "leetcode_url": user.leetcode_url,
        "created_at": user.created_at,
    }


@router.put("/profile", response_model=CandidateProfileResponse)
async def update_profile(
    request: CandidateProfileRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Update candidate profile."""
    # Similar lookup, then update
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )
    
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "target_role": user.target_role,
        "target_company": user.target_company,
        "target_domain": user.target_domain,
        "experience_level": user.experience_level,
        "skills": user.skills,
        "resume_url": user.resume_url,
        "portfolio_url": user.portfolio_url,
        "github_url": user.github_url,
        "leetcode_url": user.leetcode_url,
        "created_at": user.created_at,
    }


@router.post("/resume", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Upload candidate resume (PDF/DOCX)."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )
    
    # Validate file type
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are allowed",
        )
    
    # In production, upload to Supabase Storage or S3
    # For now, store reference
    resume_url = f"/uploads/resumes/{file.filename}"
    
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )
    
    user.resume_url = resume_url
    await db.commit()
    
    return {
        "resume_url": resume_url,
        "filename": file.filename,
        "message": "Resume uploaded successfully",
    }


@router.post("/skills", response_model=CandidateProfileResponse)
async def update_skills(
    request: SkillsUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Update candidate skills."""
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )
    
    user.skills = request.skills
    await db.commit()
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "skills": user.skills,
    }


@router.post("/certificates", response_model=CertificateResponse)
async def upload_certificate(
    request: CertificateCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Upload a certificate."""
    cert = {
        "id": "cert_" + str(hash(request.certificate_name))[:8],
        "name": request.certificate_name,
        "issuer": request.issuer,
        "issue_date": request.issue_date,
        "credential_url": request.credential_url,
        "document_url": request.document_url,
        "created_at": "now",
    }
    
    return cert


@router.post("/setup/parse", response_model=SetupParseResponse)
async def parse_setup(
    request: SetupParseRequest,
) -> dict:
    """Parse free-text setup input into structured interview configuration."""
    setup_agent = SetupAgent()
    
    try:
        config = await setup_agent.parse(
            user_input=request.user_input,
            mode=request.mode,
            existing_profile=request.existing_profile,
        )
        return config
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Setup parsing failed: {str(e)}",
        )
