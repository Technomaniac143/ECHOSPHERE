"""
EchoSphere Email Service.

Provider-agnostic email delivery with:
- Console provider (development / dev mock mode)
- Resend.com provider (production)
- SendGrid provider (production)

Per Master Build §5:
- Use an email provider abstraction so the provider can easily be configured
- Send welcome/general-information email after registration
- Explain: what EchoSphere is, how mock interview works, AI disclosure,
  approximate duration, browser requirements, microphone/camera requirements,
  interview preparation tips

DEV MODE: Console provider logs emails instead of sending.
"""

from .service import (  # noqa: F401, F403
    EmailService,
    EmailMessage,
    EmailProviderError,
    BaseEmailProvider,
    ConsoleEmailProvider,
    ResendEmailProvider,
    SendGridEmailProvider,
    send_welcome_email,
    send_interview_reminder,
    WELCOME_EMAIL_TEMPLATE,
    INTERVIEW_REMINDER_EMAIL_TEMPLATE,
)
