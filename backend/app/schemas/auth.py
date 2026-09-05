"""Schemas for authentication and user operations."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    name: str
    provider: Optional[str] = None  # "email", "google", "github", etc.
    provider_id: Optional[str] = None
    phone: Optional[str] = None
    role: str = "student"  # "student" or "hr_admin"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPayload(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user_id: str
    email: str
    role: str


class ClerkTokenVerifyRequest(BaseModel):
    token: str


class ClerkTokenVerifyResponse(BaseModel):
    user_id: str
    email: str
    role: str
    name: str


class CurrentUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    target_domain: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[str] = None
    resume_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    leetcode_url: Optional[str] = None
    organization_name: Optional[str] = None
    created_at: datetime


class AuthCallbackRequest(BaseModel):
    code: str
    state: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
