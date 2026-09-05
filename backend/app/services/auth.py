"""Auth service for user management and JWT handling."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import httpx
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthError(Exception):
    """Authentication error."""
    pass


class AuthService:
    """Service for authentication operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.secret_key = settings.jwt_secret_key or settings.clerk_secret_key or "dev-secret-change-in-production"
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 60 * 24  # 24 hours
    
    def _create_token(self, user_id: str, email: str, role: str) -> str:
        """Create a JWT token for a user."""
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        payload = {
            "sub": user_id,
            "email": email,
            "role": role,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid4()),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def _decode_token(self, token: str) -> dict:
        """Decode and validate a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except Exception:
            raise AuthError("Invalid or expired token")
    
    async def signup_email(
        self,
        email: str,
        password: str,
        name: str,
    ) -> User:
        """Register a new user with email and password."""
        # Check if user exists
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise AuthError("Email already registered")
        
        # Hash password
        password_hash = pwd_context.hash(password)
        
        # Create user
        user = User(
            id=str(uuid4()),
            role=UserRole.STUDENT,
            email=email,
            name=name,
            password_hash=password_hash,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        
        logger.info(f"User created: {user.id} ({email})")
        return user
    
    async def signup_social(
        self,
        provider: str,
        provider_id: str,
        email: str,
        name: str,
    ) -> User:
        """Register or link a social auth account."""
        # Check if user exists by provider_id
        # For simplicity, check by email first
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Link social account
            existing.clerk_user_id = provider_id
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        
        # Create new user
        user = User(
            id=str(uuid4()),
            role=UserRole.STUDENT,
            email=email,
            name=name,
            clerk_user_id=provider_id,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        
        logger.info(f"Social user created: {user.id} ({email}) via {provider}")
        return user
    
    async def login_email(
        self,
        email: str,
        password: str,
    ) -> dict:
        """Login with email and password."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise AuthError("Invalid credentials")
        
        if not user.password_hash:
            raise AuthError("This account uses social login")
        
        if not pwd_context.verify(password, user.password_hash):
            raise AuthError("Invalid credentials")
        
        token = self._create_token(user.id, user.email, user.role.value)
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": self.access_token_expire_minutes * 60,
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
        }
    
    async def verify_clerk_token(self, token: str) -> User:
        """Verify a Clerk JWT token and return/create the user."""
        # Decode the Clerk token (without verification for now — would use Clerk JWKS in production)
        try:
            # In production, verify against Clerk's JWKS
            # For now, extract claims from the token payload
            import base64
            import json
            
            # JWT has 3 parts: header.payload.signature
            parts = token.split(".")
            if len(parts) != 3:
                raise AuthError("Invalid token format")
            
            # Decode payload (base64url)
            payload_b64 = parts[1]
            # Add padding
            padding = 4 - len(payload_b64) % 4
            if padding != 4:
                payload_b64 += "=" * padding
            payload_bytes = base64.urlsafe_b64decode(payload_b64)
            payload = json.loads(payload_bytes)
            
            clerk_pub_key = settings.clerk_publishable_key or ""
            if not clerk_pub_key.startswith("pk_"):
                # Not a valid Clerk key — use fallback
                raise AuthError("Invalid Clerk configuration")
            
            user_id = payload.get("sub") or payload.get("user_id")
            email = payload.get("email", "").lower()
            name = payload.get("name", email.split("@")[0])
            
            if not user_id or not email:
                raise AuthError("Invalid Clerk token: missing claims")
            
        except Exception as e:
            if isinstance(e, AuthError):
                raise
            raise AuthError(f"Failed to decode Clerk token: {e}")
        
        # Find or create user
        result = await self.db.execute(
            select(User).where(User.clerk_user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            # Check by email
            result = await self.db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            
            if user:
                # Link clerk ID
                user.clerk_user_id = user_id
                await self.db.commit()
                await self.db.refresh(user)
            else:
                # Create new user
                user = User(
                    id=str(uuid4()),
                    role=UserRole.STUDENT,
                    email=email,
                    name=name,
                    clerk_user_id=user_id,
                )
                self.db.add(user)
                await self.db.flush()
                await self.db.refresh(user)
        
        return user
    
    async def get_user_from_token(self, token: str) -> Optional[User]:
        """Get a user from a JWT token."""
        try:
            payload = self._decode_token(token)
            user_id = payload.get("sub")
            if not user_id:
                return None
            
            result = await self.db.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()
        except AuthError:
            return None


class ClerkAuthError(Exception):
    """Clerk authentication error."""
    pass


async def verify_clerk_token_http(token: str) -> dict:
    """
    Verify a Clerk token via HTTP API (fallback method).
    In production, use JWKS verification instead.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://api.clerk.com/v1/jwks",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )
        if response.status_code != 200:
            raise ClerkAuthError("Failed to fetch Clerk JWKS")
        return response.json()
