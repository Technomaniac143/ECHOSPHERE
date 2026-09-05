"""Email service with provider abstraction."""
import asyncio
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import httpx

from app.config import settings


class EmailProviderError(Exception):
    """Raised when email delivery fails."""
    pass


@dataclass
class EmailMessage:
    """Email message to send."""
    to: str | list[str]
    subject: str
    body: str
    html: str | None = None
    from_name: str | None = None
    
    def __post_init__(self):
        if isinstance(self.to, str):
            self.to = [self.to]


class BaseEmailProvider(ABC):
    """Abstract base for email providers."""
    
    @abstractmethod
    async def send(self, message: EmailMessage) -> dict[str, Any]:
        """Send an email message. Returns delivery info."""
        ...
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is healthy."""
        ...


class ConsoleEmailProvider(BaseEmailProvider):
    """Development provider that logs emails instead of sending."""
    
    async def send(self, message: EmailMessage) -> dict[str, Any]:
        print(f"\n{'='*60}")
        print(f"[EMAIL - CONSOLE] To: {message.to}")
        print(f"Subject: {message.subject}")
        print(f"From: {message.from_name or 'EchoSphere'}")
        print(f"\nBody:\n{message.body}")
        if message.html:
            print(f"\nHTML:\n{message.html}")
        print(f"{'='*60}\n")
        return {"status": "logged", "provider": "console"}
    
    async def health_check(self) -> bool:
        return True


class ResendEmailProvider(BaseEmailProvider):
    """Resend.com email provider."""
    
    def __init__(self):
        self.api_key = settings.email_api_key
        self.base_url = "https://api.resend.com"
    
    async def send(self, message: EmailMessage) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                urljoin(self.base_url, "/emails"),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"EchoSphere <onboarding@{settings.email_from_domain or 'echosphere.app'}>",
                    "to": message.to,
                    "subject": message.subject,
                    "html": message.html or message.body,
                },
                timeout=10.0,
            )
            
            if response.status_code not in (200, 201):
                raise EmailProviderError(
                    f"Resend API error {response.status_code}: {response.text}"
                )
            
            data = response.json()
            return {
                "status": "sent",
                "provider": "resend",
                "email_id": data.get("id"),
            }
    
    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    urljoin(self.base_url, "/emails"),
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0,
                )
                return resp.status_code == 200
        except Exception:
            return False


class SendGridEmailProvider(BaseEmailProvider):
    """SendGrid email provider."""
    
    def __init__(self):
        self.api_key = settings.email_api_key
        self.base_url = "https://api.sendgrid.com/v3"
    
    async def send(self, message: EmailMessage) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                urljoin(self.base_url, "/mail/send"),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [
                        {"to": [{"email": t} for t in message.to]}
                    ],
                    "from": {
                        "email": "noreply@echosphere.app",
                        "name": message.from_name or "EchoSphere",
                    },
                    "subject": message.subject,
                    "content": [
                        {
                            "type": "text/html" if message.html else "text/plain",
                            "value": message.html or message.body,
                        }
                    ],
                },
                timeout=10.0,
            )
            
            if response.status_code != 202:
                raise EmailProviderError(
                    f"SendGrid API error {response.status_code}: {response.text}"
                )
            
            return {"status": "sent", "provider": "sendgrid"}


class EmailService:
    """Email service with provider selection based on configuration."""
    
    _providers: dict[str, BaseEmailProvider] = {}
    
    def __init__(self):
        provider_name = (settings.email_provider or "console").lower()
        
        if provider_name == "resend":
            self.provider = ResendEmailProvider()
        elif provider_name == "sendgrid":
            self.provider = SendGridEmailProvider()
        else:
            self.provider = ConsoleEmailProvider()
    
    async def send(self, message: EmailMessage) -> dict[str, Any]:
        """Send an email using the configured provider."""
        try:
            result = await self.provider.send(message)
            return result
        except EmailProviderError:
            # Fall back to console on failure
            console = ConsoleEmailProvider()
            print(f"\n[EMAIL FALLBACK] Provider '{settings.email_provider}' failed, logging to console.")
            return await console.send(message)
    
    async def health_check(self) -> bool:
        return await self.provider.health_check()


# Pre-built email templates
WELCOME_EMAIL_TEMPLATE = """\
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #4f46e5; font-size: 28px; margin-bottom: 8px;">Welcome to EchoSphere</h1>
      <p style="color: #666; font-size: 14px;">Where Every Answer Shapes the Next Question</p>
    </div>
    
    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Hi {name},</h2>
      <p style="color: #475569;">
        EchoSphere is an AI-powered adaptive voice interview platform that simulates realistic 
        interview experiences with a coordinated panel of AI interviewers.
      </p>
    </div>
    
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 24px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <h3 style="color: #166534; font-size: 16px; margin-top: 0;">How the Mock Interview Works</h3>
      <ul style="color: #475569; padding-left: 20px; margin-bottom: 0;">
        <li><strong>Duration:</strong> Approximately 20 minutes</li>
        <li><strong>Format:</strong> Real-time voice conversation with AI interviewers</li>
        <li><strong>Panel:</strong> Technical, Product, Hiring Manager, and Behavioral personas</li>
        <li><strong>Adaptive:</strong> Questions adapt based on your answers in real-time</li>
        <li><strong>Feedback:</strong> You'll receive an evidence-backed report after the interview</li>
      </ul>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 24px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <h3 style="color: #92400e; font-size: 16px; margin-top: 0;">AI Disclosure</h3>
      <p style="color: #78350f;">
        <strong>Important:</strong> You will be interacting with AI interviewers, not real people. 
        This is disclosed before the interview begins. Your responses are analyzed to generate 
        your interview assessment, but this is a practice session and does not constitute a real 
        job interview.
      </p>
    </div>
    
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 24px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <h3 style="color: #1e40af; font-size: 16px; margin-top: 0;">Browser Requirements</h3>
      <ul style="color: #3b82f6; padding-left: 20px; margin-bottom: 0;">
        <li>Use a Chromium-based browser (Chrome, Edge, Brave) or Firefox</li>
        <li>Camera access is required</li>
        <li>Microphone access is required</li>
        <li>Use a quiet, well-lit environment</li>
        <li>A stable internet connection is recommended</li>
      </ul>
    </div>
    
    <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px 24px; border-radius: 0 8px 8px 0;">
      <h3 style="color: #0c4a6e; font-size: 16px; margin-top: 0;">Interview Preparation Tips</h3>
      <ul style="color: #475569; padding-left: 20px; margin-bottom: 0;">
        <li>Review the job role and company you're practicing for</li>
        <li>Think about your past projects and the technical decisions you made</li>
        <li>Practice explaining your reasoning out loud</li>
        <li>Be ready to discuss trade-offs and why you made certain choices</li>
        <li>Start the interview when you're in a quiet environment and ready to focus</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px;">
        EchoSphere uses AI interviewers to simulate realistic interview experiences.
        This is a practice tool, not a real job interview.
      </p>
    </div>
  </div>
</body>
</html>
"""


async def send_welcome_email(email_service: EmailService, name: str, email: str) -> dict[str, Any]:
    """Send a welcome email to a newly registered candidate."""
    message = EmailMessage(
        to=email,
        subject="Welcome to EchoSphere — Start Practicing Today",
        body=f"Hi {name},\n\nWelcome to EchoSphere! Start practicing your interview skills with our AI panel.",
        html=WELCOME_EMAIL_TEMPLATE.format(name=name),
        from_name="EchoSphere",
    )
    return await email_service.send(message)


INTERVIEW_REMINDER_EMAIL_TEMPLATE = """\
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #4f46e5; font-size: 24px; margin-bottom: 16px;">Interview Reminder</h1>
    
    <p style="color: #475569; font-size: 16px;">
      Hi {name},
    </p>
    
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <p style="color: #92400e; font-size: 15px; margin: 0;">
        <strong>Your mock interview is ready!</strong>
      </p>
      <p style="color: #78350f; font-size: 14px; margin-top: 12px;">
        Role: {role} at {company}<br>
        Domain: {domain}<br>
        Duration: ~{duration} minutes
      </p>
    </div>
    
    <p style="color: #475569;">
      You can start your practice interview whenever you're ready. Make sure you're in a quiet place 
      with good lighting and a working microphone.
    </p>
    
    <p style="color: #64748b; font-size: 13px; margin-top: 32px;">
      This is an AI-powered practice session. You'll be interacting with AI interviewers.
    </p>
  </div>
</body>
</html>
"""


async def send_interview_reminder(
    email_service: EmailService,
    name: str,
    email: str,
    role: str,
    company: str,
    domain: str,
    duration: int,
) -> dict[str, Any]:
    """Send an interview reminder email."""
    message = EmailMessage(
        to=email,
        subject=f"Your EchoSphere Interview is Ready — {role} at {company}",
        body=f"Hi {name},\n\nYour mock interview for {role} at {company} is ready.",
        html=INTERVIEW_REMINDER_EMAIL_TEMPLATE.format(
            name=name, role=role, company=company, domain=domain, duration=duration
        ),
        from_name="EchoSphere",
    )
    return await email_service.send(message)
