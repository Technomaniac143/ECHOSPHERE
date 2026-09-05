# EchoSphere Agent Context

## Project Overview
Agora Hackathon 2026 — Multi-Agent AI Voice Interview Platform
Team: Ctrl Freaks

## Core Architecture
- Frontend: Next.js + React + TypeScript + Tailwind + shadcn/ui + Framer Motion + Chart.js
- Backend: FastAPI (Python) + LangGraph (Turn Arbiter) + custom MCP whiteboard server
- Voice: Agora RTC + Conversational AI Engine (Gemini Live preset), ONE agent per session
- DB: PostgreSQL + pgvector via Supabase
- Auth: Clerk (student / hr_admin roles)
- Off-path reasoning: Gemini Flash (free tier) for setup, integrity, vagueness/contradiction

## Critical Rules
1. ONE active voice agent — personas hand off via instruction injection, NOT parallel agents
2. Every mutation writes to whiteboard_events for audit trail
3. Every score needs evidence linked to transcript_turn_id + whiteboard_event_id
4. Never expose API keys to frontend
5. Difficulty adjusts per-competency, not globally
6. All integrity flags are descriptive + timestamped, never auto-penalizing
7. AI disclosure (spoken) BEFORE any evaluative question
8. No fixed question sequences — questions generated live from whiteboard state
9. If credentials missing: build correct abstraction + clearly-marked dev mock mode, NEVER pretend mock is real

## Build Phases (in order)
Phase 1: Foundation (Next.js, FastAPI, PostgreSQL, Clerk, routing, auth)
Phase 2: Candidate flow (landing, signup, dashboard, profile, resume, skills, interview setup)
Phase 3: Organization flow (signup, dashboard, question bank, assessments, candidates, filters)
Phase 4: Agora (RTC, tokens, channels, camera, mic, connection quality)
Phase 5: Voice AI (ConvoAI, Gemini, ASR/LLM/TTS, AI disclosure)
Phase 6: Interview engine (whiteboard, MCP, LangGraph, Turn Arbiter, persona switching, dynamic questions, difficulty, interruption)
Phase 7: Analysis (vagueness, contradiction, competency scoring, evidence extraction)
Phase 8: Report (final report, charts, timeline, evidence links, panel disagreement, roadmap)
Phase 9: Assessment integrity (screen share, tab detection, camera checks, recording, HR spectate)
Phase 10: Polish (animations, loading states, error states, responsive, accessibility, testing, README)

## Persona Definitions
- Technical: DSA, Programming, Architecture, System Design, Databases, APIs, Debugging, Technical depth, Tradeoffs
- Product Manager: Customer impact, Business value, Product thinking, Prioritization, Metrics, Tradeoffs, User experience
- Hiring Manager: Ownership, Leadership, Decision making, Execution, Communication, Responsibility, Conflict resolution
- Behavioral: Teamwork, Adaptability, Communication, Failure, Learning, Conflict, Motivation, Professional behavior
- Customer (role-play): Customer complaints, Incident handling, Requirements, Communication, Prioritization

## Turn Arbiter Decision Hierarchy
1. Unresolved open thread requiring another persona? → handoff to that persona
2. Current persona has unexplored seed topics? → continue current persona
3. Otherwise → next persona in panel order

## State Machine
LOBBY → CALIBRATION → PREPARATION → DISCLOSURE → INTRODUCTION → TECHNICAL → PRODUCT → HIRING → BEHAVIORAL → SCENARIO → FINAL_QUESTIONS → ENDING → PROCESSING → COMPLETED/ABANDONED

## Turn Arbiter LangGraph States
idle → candidate_speaking → evaluating → persona_selected → handoff_issued → agent_speaking → (loop)

## Database Core Tables (from TRD)
users (id, role ENUM('student','hr_admin'), email, name, created_at)
organizations (id, name)
org_members (org_id, user_id)
panels (id, org_id NULLABLE, name, persona_list JSONB, created_by, created_at)
sessions (id, mode ENUM('practice','assessment'), panel_id, candidate_id, target_role, target_company NULLABLE, agora_channel_name, agora_agent_id, status ENUM('lobby','in_progress','completed','abandoned'), started_at, ended_at)
batches (id, org_id, panel_id, name, created_at)
batch_sessions (batch_id, session_id)
whiteboard_events (id, session_id, ts, event_type, payload JSONB, source_persona NULLABLE)
whiteboard_state (session_id PK, claims JSONB, competency_ledger JSONB, open_threads JSONB, contradiction_flags JSONB, difficulty_state JSONB, updated_at)
transcript_turns (id, session_id, ts_start, ts_end, speaker ENUM('candidate','agent'), persona NULLABLE, text, audio_ref NULLABLE)
reports (id, session_id, competency_scores JSONB, evidence_links JSONB, panel_disagreement JSONB NULLABLE, generated_at)
roadmaps (student_id PK, competency_ledger JSONB, updated_at)

## MCP Whiteboard Tools
read_context(session_id) → full whiteboard state
add_claim(session_id, claim_text, competency_tags[]) → claim_id
update_competency(session_id, competency, delta_or_value, evidence_claim_id) → ack
open_thread(session_id, description, assigned_persona_hint) → thread_id
resolve_thread(session_id, thread_id, resolution_claim_id) → ack
flag_contradiction(session_id, claim_id_a, claim_id_b, note) → flag_id
flag_vagueness(session_id, claim_id, note) → flag_id
get_difficulty(session_id, competency) → current level
set_difficulty(session_id, competency, level) → ack

## API Endpoints
POST /api/sessions
POST /api/sessions/{id}/start
GET /api/sessions/{id}
POST /api/sessions/{id}/end
POST /api/setup/parse
GET /api/candidate/profile
PUT /api/candidate/profile
POST /api/candidate/resume
POST /api/candidate/certificates
GET /api/interviews
GET /api/interviews/{id}
GET /api/reports/{session_id}
POST /api/organizations
GET /api/organizations/{id}
POST /api/organizations/question-bank
GET /api/organizations/question-bank
POST /api/organizations/assessments
GET /api/organizations/assessments
GET /api/organizations/candidates
GET /api/organizations/candidates/{id}
GET /api/batches/{id}/analytics

WebSocket: live transcript, whiteboard updates, interviewer persona, difficulty, integrity events, HR spectate state

## Environment Variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
AGORA_APP_ID
AGORA_APP_CERTIFICATE
AGORA_CONVOAI_API_KEY
GEMINI_API_KEY
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_API_URL
EMAIL_PROVIDER
EMAIL_API_KEY

## Scoring Weights (configurable)
Technical 25%, Problem Solving 15%, Communication 10%, Product Thinking 15%, Leadership 10%, Behavioral 15%, Adaptability 10%

## Difficulty Levels
Beginner, Easy, Medium, Hard, Expert

## 화이트보드 상태 JSON shape
{
  "candidate": {},
  "claims": [],
  "competency_ledger": {},
  "open_threads": [],
  "contradictions": [],
  "vague_answers": [],
  "difficulty_state": {},
  "strengths": [],
  "weaknesses": [],
  "evidence": [],
  "questions_asked": [],
  "current_persona": "technical"
}

## FR Priority
P0 (demo-required): FR-1,2,3,5,6,7,8,10,11,16,18,19,21,22,24,26,27,28,37,36
P1 (if time): FR-4,9,12,13,14,15,17,20,23,25,29,31,33,35
P2 (stretch): FR-34

## Key UI Routes
/ (landing)
/auth/candidate
/auth/organization
/dashboard/candidate
/dashboard/organization
/interview/setup
/interview/information
/interview/lobby
/interview/session/[sessionId]
/reports/[sessionId]
/organization/candidates
/organization/assessments
/organization/analytics
/assessment/[code] (candidate join via link)

## Reference Docs (in this directory)
- EchoSphere_TRD_v1.0.md — technical contracts, schemas, configs
- EchoSphere_PRD_v1.0.md — requirements + priority
- EchoSphere_Master_Build_Prompt.md — full build spec (3500 lines)
