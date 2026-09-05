"""Authentication and user management routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ClerkTokenVerifyRequest,
    ClerkTokenVerifyResponse,
    CurrentUserResponse,
    LoginRequest,
    SignupRequest,
    TokenPayload,
)
from app.services.auth import AuthService, UnsupportedProviderError

router = APIRouter(prefix="/auth", tags=["auth"])

security = HTTPBearer(auto_error=False)


@router.post("/signup", response_model=CurrentUserResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Register a new user with email/password or social provider."""
    auth_service = AuthService(db)
    
    if request.provider and request.provider != "email":
        try:
            user = await auth_service.signup_social(
                provider=request.provider,
                provider_id=request.provider_id,
                email=request.email,
                name=request.name,
            )
        except UnsupportedProviderError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported auth provider: {request.provider}",
            )
    else:
        if not request.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required for email signup",
            )
        user = await auth_service.signup_email(
            email=request.email,
            password=request.password,
            name=request.name,
        )
    
    return user


@router.post("/login", response_model=TokenPayload)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPayload:
    """Login with email/password and receive JWT token."""
    auth_service = AuthService(db)
    
    try:
        tokens = await auth_service.login_email(
            email=request.email,
            password=request.password,
        )
        return tokens
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )


@router.post("/clerk/verify", response_model=ClerkTokenVerifyResponse)
async def verify_clerk_token(
    request: ClerkTokenVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ClerkTokenVerifyResponse:
    """Verify a Clerk JWT token and return the associated user."""
    auth_service = AuthService(db)
    
    try:
        user = await auth_service.verify_clerk_token(request.token)
        return ClerkTokenVerifyResponse(
            user_id=user.id,
            email=user.email,
            role=user.role,
            name=user.name,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get the currently authenticated user."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token provided",
        )
    
    auth_service = AuthService(db)
    user = await auth_service.get_user_from_token(credentials.credentials)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    """Logout current session. Client should discard token."""
    # stateless JWT — no server-side session to invalidate
    return None


@router.get("/users/{user_id}", response_model=CurrentUserResponse)
async def get_user(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get a user by ID (for admin/HR use)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return user
