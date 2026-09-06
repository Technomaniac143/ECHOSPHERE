"""WebSocket schemas."""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    id: Optional[str] = None
    sender: str
    text: str
    timestamp: Optional[str] = None

class InterviewStateUpdate(BaseModel):
    session_id: str
    status: str
    current_persona: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class PersonaChange(BaseModel):
    previous_persona: Optional[str] = None
    new_persona: str
    reason: Optional[str] = None

class TranscriptUpdate(BaseModel):
    speaker: str
    text: str
    timestamp: Optional[str] = None

class WhiteboardUpdate(BaseModel):
    action: str
    payload: Dict[str, Any]
