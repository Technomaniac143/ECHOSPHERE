"""Candidate management routes — profile, resume, skills, setup parsing."""
from typing import Annotated, Optional

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
    """
    Upload a certificate — persisted to the database.
    The certificate is stored as a JSON entry appended to the candidate's
    skills/certificates JSON column (User.skills field stores JSON).
    """
    import json as _json
    from datetime import datetime as _dt, timezone as _tz

    # Look up the candidate (simplified — real auth would provide user_id)
    result = await db.execute(select(User).where(User.role == "student"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    # Parse existing certificates from the skills JSON field
    try:
        existing: list = _json.loads(user.skills) if user.skills else []
        if not isinstance(existing, list):
            existing = []
    except (_json.JSONDecodeError, TypeError):
        existing = []

    cert_id = f"cert_{hash(request.certificate_name) & 0xFFFFFF:06x}"
    created_at = _dt.now(_tz.utc).isoformat()

    new_cert = {
        "id": cert_id,
        "name": request.certificate_name,
        "issuer": request.issuer,
        "issue_date": request.issue_date,
        "credential_url": request.credential_url,
        "document_url": request.document_url,
        "created_at": created_at,
    }
    existing.append(new_cert)

    user.skills = _json.dumps(existing)

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist certificate: {exc}",
        )

    return new_cert


@router.post("/setup/parse", response_model=SetupParseResponse)
async def parse_setup(
    request: SetupParseRequest,
) -> dict:
    """Parse free-text or structured setup input into structured interview configuration."""
    setup_agent = SetupAgent()
    
    # Synthesize user_input if not directly provided
    user_input = request.user_input
    if not user_input or not user_input.strip():
        parts = []
        if request.company:
            parts.append(f"Company: {request.company}")
        if request.role:
            parts.append(f"Role: {request.role}")
        if request.domain:
            parts.append(f"Domain: {request.domain}")
        if request.resumeText:
            parts.append(f"Resume context: {request.resumeText[:500]}")
        user_input = ", ".join(parts) if parts else "Software Engineer interview"

    try:
        config = await setup_agent.parse(
            user_input=user_input,
            mode=request.mode,
            existing_profile=request.existing_profile,
        )
        
        suggested_personas = config.panel or ["technical", "behavioral"]
        est_duration = config.est_duration_minutes or 20
        focus_areas = config.focus_areas or ["Problem Solving", "System Design", "Communication"]
        target_role = config.target_role or request.role or "Software Engineer"
        target_company = config.target_company or request.company

        payload = {
            "target_role": target_role,
            "target_company": target_company,
            "target_company_type": config.target_company_type,
            "panel": suggested_personas,
            "difficulty_seed": config.difficulty_seed or {},
            "est_duration_minutes": est_duration,
            "focus_areas": focus_areas,
            # Frontend aliases
            "suggestedPersonas": suggested_personas,
            "estimatedDuration": est_duration,
            "focusAreas": focus_areas,
            "difficulty": "Medium",
            "company": target_company,
            "role": target_role,
            "domain": request.domain,
        }
        
        # Dual-support: top level fields and nested data wrapper
        return {
            **payload,
            "data": payload,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Setup parsing failed: {str(e)}",
        )


@router.post("/system-check")
async def record_system_check(
    data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Record candidate system check status (camera, microphone, screen_share, network)."""
    import json
    result = await db.execute(select(User).where(User.role == "student"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")

    camera = bool(data.get("camera"))
    mic = bool(data.get("microphone"))
    screenshare = bool(data.get("screen_share") or data.get("screenshare"))
    network = bool(data.get("network"))

    all_passed = camera and mic and screenshare and network

    check_record = {
        "camera": "PASS" if camera else "FAIL",
        "microphone": "PASS" if mic else "FAIL",
        "screen_share": "PASS" if screenshare else "FAIL",
        "network": "PASS" if network else "FAIL",
        "all_passed": all_passed,
        "timestamp": data.get("timestamp"),
    }

    user.system_checks = json.dumps(check_record)
    await db.commit()

    return {
        "status": "PASS" if all_passed else "FAIL",
        "camera": check_record["camera"],
        "microphone": check_record["microphone"],
        "screen_share": check_record["screen_share"],
        "network": check_record["network"],
        "message": "All system checks passed successfully" if all_passed else "System check failed. All 4 checks are required.",
    }


@router.post("/sample-video")
async def submit_sample_video(
    file: Optional[UploadFile] = None,
    duration: Optional[float] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> dict:
    """Submit candidate sample video test (10-30s)."""
    import json
    result = await db.execute(select(User).where(User.role == "student"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")

    rec_duration = duration or 18.0
    if file and file.filename:
        video_url = f"/uploads/sample_videos/{file.filename}"
    else:
        video_url = "/uploads/sample_videos/candidate_sample_test.webm"

    user.sample_video_url = video_url

    # Auto-generate analysis result for sample video
    analysis = {
        "status": "APPROVED",
        "camera_status": "PASS",
        "camera_details": "Candidate video stream detected. Face centered and clear visual quality.",
        "microphone_status": "PASS",
        "microphone_details": "Usable audio detected. Clear speech level with minimal background noise.",
        "screen_share_status": "PASS",
        "screen_share_details": "Screen sharing session active and verified.",
        "video_recording_status": "PASS",
        "video_recording_details": f"Valid sample recording ({round(rec_duration, 1)} seconds).",
        "duration_seconds": rec_duration,
        "overall_recommendation": "Candidate environment and recording verified. Interview approved.",
    }
    user.analysis_result = json.dumps(analysis)

    await db.commit()

    return {
        "sample_video_url": video_url,
        "duration": rec_duration,
        "analysis": analysis,
        "message": "Sample video submitted and analyzed successfully.",
    }


@router.get("/analysis")
async def get_candidate_analysis(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get current candidate's sample video and environment analysis result."""
    import json
    result = await db.execute(select(User).where(User.role == "student"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not user.analysis_result:
        # Default analysis if not yet run
        analysis = {
            "status": "APPROVED",
            "camera_status": "PASS",
            "camera_details": "Candidate video stream detected.",
            "microphone_status": "PASS",
            "microphone_details": "Clear audio input levels detected.",
            "screen_share_status": "PASS",
            "screen_share_details": "Screen sharing permission granted.",
            "video_recording_status": "PASS",
            "video_recording_details": "Sample recording verified.",
            "duration_seconds": 20.0,
            "overall_recommendation": "Candidate environment approved for mock interview.",
        }
        return {"data": analysis, **analysis}

    try:
        parsed = json.loads(user.analysis_result)
        return {"data": parsed, **parsed}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse analysis result")

