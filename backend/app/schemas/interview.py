"""Alias module for interview schemas to support 'app.schemas.interview' imports."""
from app.schemas.interview_schemas import *

# Alias for backward compatibility / setup agent
SetupParseResponse = InterviewSetupResponse
