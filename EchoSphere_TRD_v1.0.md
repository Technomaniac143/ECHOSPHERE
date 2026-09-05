# Technical Requirements Document (TRD) — EchoSphere
**Adaptive Multi-Agent AI Voice Interview Platform**

| | |
|---|---|
| **Team** | Ctrl Freaks |
| **Event** | Agora Hackathon 2026 — Track: Coordinated AI Interview Panel |
| **Version** | 1.0 |
| **Relationship to other docs** | Ideology v0.1 = *why*, Technical Blueprint v0.2 = *architecture rationale*, PRD v1.0 = *what/priority*. This TRD = *exact interfaces, schemas, and configs an engineer builds against.* |

---

## 1. Purpose & Conventions

This document specifies concrete technical contracts: component boundaries, API/tool schemas, data models, and configuration values. Every section maps back to one or more FR-IDs from PRD v1.0 for traceability. Field names below are proposals for build-start, not frozen — change them in the codebase and this doc together.

## 2. System Component Map

```
┌───────────────┐      ┌───────────────┐
│ Practice Web   │      │ Assessment Web │      (Next.js, shared component
│ App (student)  │      │ App (HR)       │       library, two route trees)
└───────┬────────┘      └───────┬────────┘
        │  HTTPS/WSS             │ HTTPS/WSS
        ▼                        ▼
┌─────────────────────────────────────────┐
│        EchoSphere Backend API             │  FastAPI (Python)
│  - Session service                        │
│  - Turn Arbiter (LangGraph)               │
│  - Setup Agent (Gemini Flash)             │
│  - Integrity service                      │
│  - Analytics service                      │
└───────┬─────────────┬─────────────┬──────┘
        │              │             │
        ▼              ▼             ▼
┌───────────────┐ ┌───────────┐ ┌──────────────┐
│ Agora Cloud    │ │ Whiteboard │ │ Postgres      │
│ (RTC + ConvoAI │ │ MCP Server │ │ + pgvector    │
│  Engine +      │ │ (Python)   │ │ (Supabase)    │
│  Cloud Record) │ └───────────┘ └──────────────┘
└───────────────┘
        │
        ▼
┌───────────────┐
│ Gemini API     │ (Live, for ConvoAI preset; Flash, for setup/
│                │  integrity/vagueness reasoning — separate calls)
└───────────────┘
```

## 3. Technology Stack (Build-Start Defaults)

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js (React) | Single codebase, two route trees: `/practice/*`, `/assess/*` |
| Charts (batch analytics) | Chart.js | Per existing stack decision |
| Realtime transport | Agora Web SDK (RTC) | Audio, video, screen-share tracks |
| Voice AI orchestration | Agora Conversational AI Engine | ASR+LLM+TTS managed pipeline, one agent instance per session |
| Voice/reasoning model | Google Gemini Live (ConvoAI preset) | Primary; fallback to a standard ASR+LLM+TTS preset if Live preset is unstable |
| Off-path reasoning model | Gemini Flash / Flash-Lite (free tier) | Setup agent, vagueness/contradiction checks, camera-integrity vision checks |
| Backend framework | FastAPI (Python) | REST + WebSocket |
| Agent orchestration | LangGraph | Turn Arbiter state machine |
| Shared context service | Custom MCP server (Python, `mcp` SDK) | Exposes whiteboard as callable tools (§6) |
| Database | PostgreSQL + pgvector | Hosted via Supabase |
| Auth | Clerk | Separate roles: `student`, `hr_admin` |
| Recording | Agora Cloud Recording | Writes to team-owned storage bucket |
| Frontend hosting | Vercel | |
| Backend hosting | Render (or AWS if Render limits are hit) | |

## 4. Data Model

### 4.1 Core Tables

```sql
-- Identity & org
users (id, role ENUM('student','hr_admin'), email, name, created_at)
organizations (id, name)          -- HR/placement cell tenants
org_members (org_id, user_id)

-- Panel configuration
panels (id, org_id NULLABLE, name, persona_list JSONB, created_by, created_at)
  -- persona_list: [{ "role": "technical", "objective": "...", "voice": "..." }, ...]

-- Sessions (practice or assessment)
sessions (
  id, mode ENUM('practice','assessment'), panel_id, candidate_id,
  target_role TEXT, target_company TEXT NULLABLE,
  agora_channel_name TEXT, agora_agent_id TEXT,
  status ENUM('lobby','in_progress','completed','abandoned'),
  started_at, ended_at
)

-- Batches (assessment only)
batches (id, org_id, panel_id, name, created_at)
batch_sessions (batch_id, session_id)

-- Whiteboard state (append-only event log + materialized current state)
whiteboard_events (
  id, session_id, ts, event_type ENUM(
    'claim','competency_update','open_thread_opened','open_thread_resolved',
    'contradiction_flag','vagueness_flag','difficulty_change',
    'integrity_flag','persona_handoff'
  ),
  payload JSONB, source_persona TEXT NULLABLE
)
whiteboard_state (session_id PK, claims JSONB, competency_ledger JSONB,
                   open_threads JSONB, contradiction_flags JSONB,
                   difficulty_state JSONB, updated_at)

-- Transcript
transcript_turns (id, session_id, ts_start, ts_end, speaker ENUM('candidate','agent'),
                   persona TEXT NULLABLE, text, audio_ref TEXT NULLABLE)

-- Reports
reports (id, session_id, competency_scores JSONB, evidence_links JSONB,
         panel_disagreement JSONB NULLABLE, generated_at)

-- Roadmap (practice side, persists across sessions per student)
roadmaps (student_id PK, competency_ledger JSONB, updated_at)
```

**Traceability**: `whiteboard_events` + `transcript_turns` together satisfy FR-16 (every report line must link to a timestamp) — a report's `evidence_links` field stores `{transcript_turn_id, whiteboard_event_id}` pairs, never freehand text.

## 5. Agora Conversational AI Engine Configuration

### 5.1 Agent Start Request (per session, conceptual shape)

```json
POST /v2/projects/{appid}/conversational-ai-agent/join
{
  "name": "echosphere-session-{session_id}",
  "properties": {
    "channel": "{agora_channel_name}",
    "token": "{agora_rtc_token}",
    "agent_rtc_uid": "echosphere-agent",
    "asr": { "vendor": "gemini_live" },
    "llm": {
      "vendor": "gemini_live",
      "api_key": "{GEMINI_API_KEY}",
      "system_messages": ["{initial_persona_system_prompt}"],
      "mcp_servers": ["{WHITEBOARD_MCP_SERVER_URL}"],
      "greeting_configs": {
        "text": "{spoken_disclosure_and_ground_rules}",
        "interruptable": false
      }
    },
    "tts": { "vendor": "gemini_live" },
    "interrupt": {
      "mode": "speech_and_keyword",
      "keywords": ["hey panel"]
    },
    "vad": { "attention_lock_voiceprint": "{enrolled_voiceprint_id}" }
  }
}
```
- `greeting_configs.interruptable: false` — satisfies FR-37/FR-28 (disclosure must complete before any candidate interruption diverts it).
- `interrupt.mode: speech_and_keyword` — satisfies FR-8/FR-9.
- `mcp_servers` — satisfies FR-6, points at the Whiteboard MCP Server (§6).
- Config is a **starting proposal**; confirm exact field names against Agora's current Conversational AI Engine API reference before implementation, since this API has shipped multiple revisions (v2.4–v2.7) with field changes.

### 5.2 Persona Hand-Off (mid-session)

```json
POST /v2/projects/{appid}/conversational-ai-agent/{agent_id}/interrupt-message
{
  "text": "You are now the Product Interviewer. Whiteboard open thread: customer_impact_unaddressed. Speak this transition first: 'Let's bring in our product lead on that.'"
}
```
- Backend's Turn Arbiter issues this call whenever hand-off logic (§7.2) fires. This is the mechanism behind FR-2/FR-3.

## 6. Whiteboard MCP Server — Tool Schema

Minimal viable tool set (resolves the PRD's open question):

| Tool | Input | Output | Satisfies |
|---|---|---|---|
| `read_context` | `session_id` | Full current whiteboard state (claims, ledger, open threads, difficulty) | FR-5, FR-7 |
| `add_claim` | `session_id, claim_text, competency_tags[]` | `claim_id` | FR-5 |
| `update_competency` | `session_id, competency, delta_or_value, evidence_claim_id` | ack | FR-5, FR-16 |
| `open_thread` | `session_id, description, assigned_persona_hint` | `thread_id` | FR-7 |
| `resolve_thread` | `session_id, thread_id, resolution_claim_id` | ack | FR-7 |
| `flag_contradiction` | `session_id, claim_id_a, claim_id_b, note` | `flag_id` | FR-15 |
| `flag_vagueness` | `session_id, claim_id, note` | `flag_id` | FR-14 |
| `get_difficulty` | `session_id, competency` | current level | FR-12 |
| `set_difficulty` | `session_id, competency, level` | ack | FR-12 |

Every tool call is also written to `whiteboard_events` (§4.1) for full auditability — the MCP server is a thin interface over that table, not a separate source of truth.

## 7. Backend Services

### 7.1 Session Service
- `POST /sessions` — create a session from a panel config + candidate + mode; provisions Agora channel + token.
- `POST /sessions/{id}/start` — triggers ConvoAI agent join (§5.1) once lobby checks pass.
- `GET /sessions/{id}/state` — polled or WS-pushed whiteboard state, consumed by candidate UI progress indicators and HR spectate view alike.
- `POST /sessions/{id}/end` — finalize, trigger report generation.

### 7.2 Turn Arbiter (LangGraph state machine)
States: `idle → candidate_speaking → evaluating → persona_selected → handoff_issued → agent_speaking → (loop)`.
Selection logic on each `evaluating` tick:
1. Any open thread older than N turns and unassigned to current persona? → hand off to its `assigned_persona_hint`.
2. Otherwise, does current persona's objective have unexplored seed topics? → continue with current persona.
3. Otherwise → hand off to the next persona in `panel.persona_list` order.

### 7.3 Setup Agent
- `POST /setup/parse` — takes free-text ("backend role at a fintech, weak on system design") + mode, returns a structured proposal:
```json
{
  "target_role": "Backend Engineer",
  "target_company_type": "fintech",
  "panel": ["technical","behavioral"],
  "difficulty_seed": { "system_design": "low" },
  "est_duration_minutes": 20
}
```
Implemented as a single Gemini Flash call with a structured-output prompt; consumed by both Practice and Assessment setup flows (FR-19, FR-22).

### 7.4 Integrity Service
- Subscribes to Agora RTC events (`visibilitychange`/`blur` forwarded from client, screen-share track presence) and a scheduled job that grabs a camera frame every 15–20s per active assessment session, sends it to Gemini Flash multimodal with a fixed prompt ("single person visible, facing camera, no second device?"), and writes results to `whiteboard_events` as `integrity_flag` (FR-31–FR-36).

### 7.5 Analytics Service
- Batch rollups query `whiteboard_state`/`whiteboard_events` across `batch_sessions`, producing the aggregates in FR-25 (score distributions, flag frequency, panel-disagreement rate). Exposed via `GET /batches/{id}/analytics`.

## 8. Client-Side Requirements

| Component | Requirement | FR ref |
|---|---|---|
| Lobby | Request camera/mic/(screen) permissions with plain-language copy; render local track preview pre-publish | FR-26, FR-27 |
| Lobby | Display Agora connection-quality signal as Good/Fair/Poor | FR-27 |
| Lobby | Play spoken disclosure via ConvoAI greeting (non-interruptible); render captions simultaneously for accessibility | FR-28 |
| Interview UI | No manual "record"/"submit" controls — mic is live-streamed continuously once session starts | FR-8, FR-10 |
| Interview UI | Visual indicator of which persona currently holds the floor (name + small avatar/color) | FR-2 |
| HR Spectate | Read-only Agora subscribe (no publish), live whiteboard state panel alongside video | FR-24 |
| Report view | Every score/flag renders as a clickable chip linking to the transcript timestamp (`evidence_links`) | FR-16 |

## 9. Non-Functional Technical Requirements

| Category | Spec |
|---|---|
| Turn-taking latency | Candidate speech → agent begins responding: target under ~1.5s end-to-end (Agora ConvoAI Engine baseline; validate empirically during build) |
| Interruption responsiveness | Agent TTS playback stops within one audio frame of barge-in detection |
| Integrity check cadence | Camera frame check every 15–20s during assessment mode only; never during practice mode |
| Free-tier budget | ≤300 ConvoAI minutes/month, ≤10,000 RTC minutes/month, Gemini calls kept on billing-disabled project (see PRD §10, Blueprint §7) |
| Data isolation | A session's recordings/transcripts are queryable only by the owning candidate and, for assessment sessions, the creating org's `hr_admin` members |
| Auditability | No score or flag may be written to `reports` without a corresponding `whiteboard_events` row and `transcript_turns` reference |

## 10. Environments & Secrets

| Env var | Purpose |
|---|---|
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | RTC token generation |
| `AGORA_CONVOAI_API_KEY` | Conversational AI Engine REST calls |
| `GEMINI_API_KEY` | Setup agent, integrity checks, vagueness/contradiction reasoning, and ConvoAI Gemini Live preset |
| `DATABASE_URL` | Supabase Postgres connection |
| `CLERK_SECRET_KEY` | Auth |

Two isolated environments for the hackathon: `dev` (shared free-tier keys, used during build) and `demo` (same keys, usage watched closely against §9 budget in the hours before presenting).

## 11. Testing Requirements

- **Unit**: Turn Arbiter selection logic (§7.2) against fixture whiteboard states.
- **Integration**: MCP tool calls round-trip correctly to `whiteboard_events`/`whiteboard_state`.
- **Manual/scripted demo run-through**: at least one full session exercising persona hand-off, one interruption, one vagueness probe, and report generation, run before the live demo to catch Agora config drift.
- **Load**: not a hackathon priority — single concurrent session is the demo target; note as a gap, not a requirement, for this build.

## 12. Open Items Carried From PRD

- Confirm exact current field names for the ConvoAI Engine agent-start and interrupt-message APIs against Agora's live docs before implementation — §5 configs above are structurally correct but may need field-name updates given the API's release cadence.
- Fallback ASR/LLM/TTS preset (non-Gemini-Live) to keep on standby per the PRD's risk table.
- Whether `whiteboard_events` needs a retention/archival policy beyond the hackathon window (not needed for demo; flag for anyone continuing the project).

---

*Companion documents: Ideology v0.1 (why), Technical Blueprint v0.2 (architecture rationale), PRD v1.0 (requirements + priority). This TRD is the build contract — update schemas/configs here as implementation reveals corrections.*
