# Product Requirements Document — EchoSphere
**Adaptive Multi-Agent AI Voice Interview Platform**

| | |
|---|---|
| **Team** | Ctrl Freaks |
| **Event** | Agora Hackathon 2026 — Track: Coordinated AI Interview Panel |
| **Version** | 1.0 |
| **Status** | Draft, for internal build alignment |
| **Companion docs** | *EchoSphere Ideology v0.1* (design philosophy), *EchoSphere Technical Blueprint v0.2* (architecture) — this PRD converts both into scoped, prioritized requirements |

---

## 1. Executive Summary

EchoSphere is a real-time, voice-first, multi-agent AI interview platform. Instead of one AI interviewer running a fixed question list, a coordinated panel — technical, product, hiring-manager, behavioral, and customer/role-play personas — shares a single evolving candidate model, hands off turns to each other, adapts question difficulty live, and produces a final assessment where every judgment links back to a transcript timestamp. The same engine powers two products: a **Practice** experience for students preparing for a specific role, and an **Assessment** experience for HR/placement teams running proctored, batch hiring loops.

## 2. Problem Statement

Existing AI interview tools fall into two camps: async, single-question video assessments (record an answer, move on — no adaptivity, no back-and-forth) or single-persona conversational agents (adaptive, but one voice, one objective). Neither reproduces what makes a real hiring loop informative: **different stakeholders pushing on the same answer from different angles**, and reacting to what the candidate already said. A candidate can give a technically correct answer that a tech lead accepts and a PM would immediately challenge on business impact — that divergence is real signal that a single-interviewer system structurally cannot produce.

## 3. Goals

- **G1.** Demonstrate a genuinely multi-agent panel (not one persona in different costumes) sharing live context and disagreeing when warranted.
- **G2.** Make the voice interaction feel like a real conversation — interruptible, adaptive, no dead air waiting for a "submit" click.
- **G3.** Ship one engine that serves both a low-stakes practice product and a proctored assessment product, differing only by a mode flag.
- **G4.** Every score in the final report must be traceable to a specific transcript moment.
- **G5.** Run the entire hackathon build and demo inside free-tier infrastructure (Agora + Gemini).

### Non-Goals (for this build)
- Not building a resume-parsing or ATS-integration pipeline (candidates enter with a role/target already known).
- Not building an unbeatable anti-cheat system — the integrity layer is deterrence and transparency, not guaranteed detection (see §8).
- Not building a third "employer vs. internal placement cell" surface — HR and Placement Cell are one role for this build (see §6).

## 4. Target Users & Personas

| Persona | Side | Need |
|---|---|---|
| **Student / Job Seeker** | Practice | Realistic rehearsal for a specific role/company, a running skill map instead of one-off scored attempts, low stakes |
| **HR / Placement Cell Coordinator** | Assessment | Run a proctored interview loop across a candidate batch, watch live, get an evidence-backed, comparable report per candidate and an aggregate view of the cohort |
| **Candidate (being assessed)** | Assessment | Clear disclosure of what they're interacting with, fair and consistent treatment, a chance to demonstrate reasoning, not just recite facts |

## 5. Scope

### In Scope — Hackathon MVP
- Real-time voice panel interview, single Agora Conversational AI Engine agent with persona hand-off (§9.1)
- Shared candidate context ("whiteboard") driving question generation, difficulty, and hand-offs (§9.2)
- Practice side: role/target intake, adaptive mock interview, evidence-linked report, persistent skill roadmap (§9.3)
- Assessment side: test creation, candidate invite, full integrity mode, live spectate, evidence-linked report, batch analytics (§9.4)
- Pre-join lobby with live calibration and conversational (non-form) setup (§9.5)
- Integrity signals: screen-share capture, tab/window-switch detection, periodic camera presence check, voice-lock second-speaker detection, full session recording (§9.6)
- AI disclosure, spoken and explicit, before any evaluative question is asked (§9.7)

### Deferred — Post-Hackathon / Stretch
- Separate employer-facing portal distinct from internal placement cell
- Resume/portfolio ingestion for cross-referencing contradiction checks
- Mobile-native apps (mobile web is in scope; native wrapper is not)
- Multi-language interview support
- Fine-grained rubric-weighting UI beyond conversational setup

## 6. User Flows

### 6.1 Student / Practice
```
Conversational setup ("I want to practice backend @ fintech, weak on system design")
 → one-tap confirm of inferred panel + scope
 → Pre-join Lobby (permissions, live calibration turn, spoken disclosure)
 → Practice Interview (adaptive panel, relaxed integrity)
 → Evidence-linked Report
 → Roadmap updated (competency ledger persists across sessions)
```

### 6.2 HR / Placement Cell / Assessment
```
Conversational test setup ("Senior backend loop, heavy system design, one behavioral round")
 → HR confirms/adjusts inferred panel + rubric weighting
 → Invite candidates (link or bulk)
 → Candidate: Pre-join Lobby (full integrity mode) → Assessment Interview
 → HR: Live Spectate any in-progress session
 → Per-candidate Evidence-linked Report
 → Batch Analytics across the cohort
```

## 7. Success Metrics (Hackathon Demo)

| Metric | Target |
|---|---|
| Live demo: panel hands off between ≥3 distinct personas in one session | Working end-to-end |
| Candidate can interrupt an agent mid-sentence and be understood | Demonstrable on stage |
| Final report: 100% of scored claims link to a transcript timestamp | No un-sourced judgments |
| At least one demo run shows explicit panel disagreement in the final report | Visible in output |
| Integrity flag (e.g., tab switch) appears on HR spectate view in real time | <5s latency from event to display |
| Total infra spend for build + demo | $0 (within free tiers, §7 of Technical Blueprint) |

## 8. Assumptions & Dependencies

- Team has valid Gemini API keys with billing disabled (preserves free tier — see Technical Blueprint §7).
- Agora Conversational AI Engine's Gemini Live preset is available and stable enough to build against during the hackathon window.
- Candidates interview from a Chromium- or Firefox-based desktop/mobile browser with camera, mic, and (assessment mode) screen-share permissions grantable.
- "Proctoring" is explicitly scoped as deterrence + transparency; this is disclosed to candidates, not marketed as foolproof (see Technical Blueprint §4).

## 9. Functional Requirements

Priority key: **P0** = required for hackathon demo, **P1** = strongly desired if time allows, **P2** = stretch/post-hackathon.

### 9.1 Interview Panel & Persona Engine
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | System supports at least 4 interviewer personas: Technical, Product, Hiring Manager, Behavioral, with Customer as a role-play variant | P0 |
| FR-2 | Only one live voice agent is active at a time; persona hand-off is implemented via mid-conversation instruction injection, not parallel agents | P0 |
| FR-3 | A Turn Arbiter component decides which persona's objective is least satisfied and triggers hand-off, including a spoken transition line | P0 |
| FR-4 | Panel composition (which personas appear, in what order/weight) is configurable per session via the conversational setup agent | P1 |

### 9.2 Shared Candidate Context ("Whiteboard")
| ID | Requirement | Priority |
|---|---|---|
| FR-5 | All agent personas read and write to one shared context object per session (claims register, competency ledger, open threads, contradiction flags, difficulty state) | P0 |
| FR-6 | Whiteboard is exposed as an MCP server so the active agent's LLM can call read/write tools directly during conversation | P0 |
| FR-7 | An "open thread" raised by one persona (e.g., unresolved customer-impact question) is visible to and actionable by the next persona that takes the floor | P0 |

### 9.3 Real-Time Voice, Interruption & Turn-Taking
| ID | Requirement | Priority |
|---|---|---|
| FR-8 | Candidate speech barges in on agent TTS playback within one audio frame of detection (speech-based interruption) | P0 |
| FR-9 | A spoken wake-phrase ("Hey Panel") triggers keyword-based interruption for out-of-band commands (repeat question, pause, restart answer) without a UI control | P1 |
| FR-10 | Exactly one voice is audible at any time; no overlapping agent personas | P0 |

### 9.4 Dynamic Questioning & Difficulty
| ID | Requirement | Priority |
|---|---|---|
| FR-11 | Next question is generated live from the seed topic bank, current whiteboard state, and difficulty state — not read verbatim from a fixed script | P0 |
| FR-12 | Difficulty adjusts per-competency (not globally): correct/deep answers raise difficulty on that competency; weak answers trigger a scaffolding probe before difficulty drops | P1 |
| FR-13 | At least one role-play/scenario segment (e.g., Customer persona simulating an angry user) is supported per session | P1 |

### 9.5 Vagueness & Contradiction Detection
| ID | Requirement | Priority |
|---|---|---|
| FR-14 | Answers heavy on outcome language but thin on specifics trigger an automatic, targeted clarifying probe | P1 |
| FR-15 | New claims are diffed against the session's claims register; detected contradictions trigger a direct, evidence-citing follow-up rather than a silent flag | P1 |

### 9.6 Evidence-Linked Feedback & Final Assessment
| ID | Requirement | Priority |
|---|---|---|
| FR-16 | Every line in the final report is generated as judgment + linked quote/paraphrase + transcript timestamp | P0 |
| FR-17 | Final report includes an explicit panel-disagreement section when personas' assessments diverge | P1 |
| FR-18 | Report is structured per-competency with role-specific recommendations, not a single blended score | P0 |

### 9.7 Practice Side
| ID | Requirement | Priority |
|---|---|---|
| FR-19 | Candidate can specify a target role/company via conversational setup and receive an inferred panel + scope for one-tap confirmation | P0 |
| FR-20 | Competency ledger persists across practice sessions for the same student, forming a running "roadmap" rather than resetting each time | P1 |
| FR-21 | Practice mode runs with relaxed integrity (no lockdown, no violation scoring) | P0 |

### 9.8 Assessment Side (HR / Placement Cell)
| ID | Requirement | Priority |
|---|---|---|
| FR-22 | HR can create a test via conversational setup (role, panel composition, rubric weighting) with one-tap adjustment | P0 |
| FR-23 | HR can invite candidates via shareable link or bulk upload | P1 |
| FR-24 | HR can join any in-progress candidate session as a silent spectator (audio, video, screen-share, and live whiteboard state) | P0 |
| FR-25 | Batch Analytics aggregates competency scores, vagueness/contradiction flag frequency, and panel-disagreement patterns across a cohort | P1 |

### 9.9 Pre-Join Lobby
| ID | Requirement | Priority |
|---|---|---|
| FR-26 | Lobby requests camera/mic (and, in assessment mode, screen-share) permissions with plain-language explanations | P0 |
| FR-27 | Live self-preview and Agora network-quality probe are shown before the candidate commits to joining | P0 |
| FR-28 | AI disclosure and ground rules are delivered as one spoken moment by the lead panel agent, not a static text screen | P0 |
| FR-29 | The first real exchange with the panel doubles as a live mic/lighting/framing calibration check (graded via Gemini multimodal input in the background); the agent only interrupts if something is actually wrong | P1 |
| FR-30 | The only required click in the lobby is a one-tap confirmation of the spoken setup summary | P1 |

### 9.10 Integrity Layer (Assessment Mode Only)
| ID | Requirement | Priority |
|---|---|---|
| FR-31 | Candidate's screen is captured as a second Agora track alongside camera and mic | P1 |
| FR-32 | Tab/window switches and fullscreen exits are detected and timestamped on the whiteboard | P0 |
| FR-33 | Periodic camera frames are checked (single person, facing camera, no obvious second device) via Gemini multimodal input | P1 |
| FR-34 | A second distinct voice is flagged via Agora voice-lock/attention-lock deviation from the enrolled candidate voiceprint | P2 |
| FR-35 | Full session (audio, video, screen) is recorded via Agora Cloud Recording, backing every integrity flag with reviewable footage | P1 |
| FR-36 | All integrity flags are descriptive and timestamped, never an automatic score penalty or disqualification | P0 |

### 9.11 Disclosure & Consent
| ID | Requirement | Priority |
|---|---|---|
| FR-37 | Every session begins with a spoken statement that all panelists are AI, before any evaluative question is asked | P0 |
| FR-38 | Candidate can ask "am I talking to a real person?" at any point and receive an accurate, restated answer | P1 |

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Latency** | Agent response to candidate speech should feel conversational (target: sub-second turn detection, per Agora's ConvoAI Engine baseline) |
| **Cost** | Entire hackathon build and demo must run within Agora's free RTC (10,000 min/mo) and Conversational AI Engine (300 min/mo) tiers, plus Gemini's free tier with billing disabled |
| **Transparency** | No integrity flag or competency score may appear in a report without a linked transcript timestamp |
| **Privacy** | Session recordings and transcripts are accessible only to the candidate and the HR account that created the assessment; practice-side data is private to the student |
| **Browser support** | Chromium- and Firefox-based browsers, desktop and mobile web |

## 11. System Architecture Summary

*(Full detail in Technical Blueprint v0.2 — summarized here for traceability to requirements above.)*

- **Voice/transport layer**: Agora RTC + Conversational AI Engine, one agent per session, Gemini Live as the MLLM preset.
- **Persona hand-off**: Turn Arbiter (backend) injects custom text instructions into the live agent to swap system prompt, voice, and objective per persona.
- **Shared state**: Candidate whiteboard exposed as an MCP server, called directly by the active agent's LLM.
- **Integrity & analysis**: Gemini Flash (free tier) handles periodic camera checks, vagueness/contradiction reasoning, and the conversational setup agent — kept separate from the billed ConvoAI voice minutes.
- **Recording & spectate**: Agora Cloud Recording plus silent-subscriber pattern for HR live spectate.

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gemini Live preset in Agora's ConvoAI Engine is unstable or has undocumented edge cases during the hackathon window | Fall back to a standard ASR+LLM+TTS preset within the same ConvoAI Engine; architecture (§9.1–9.2) doesn't depend on Gemini Live specifically |
| Persona hand-off via instruction injection feels jarring rather than natural | Script explicit spoken transition lines ("Let me bring in our product lead on that") so the hand-off is narrated, not silent |
| Free-tier ConvoAI minutes (300/mo) are consumed faster than expected during testing | Single-agent-per-session design (FR-2) keeps usage ~4x lower than a parallel multi-agent design; monitor usage via Agora console during build |
| Integrity checks produce false positives (e.g., normal head movement flagged) | All flags are descriptive and human-reviewed (FR-36), never auto-penalizing |
| LangGraph/MCP wiring isn't stable by demo day | Agora Agent Studio (no-code) as a fallback single-persona demo path (per Technical Blueprint §8) |

## 13. Out of Scope (Explicit)

- Resume parsing / ATS integrations
- Guaranteed cheating prevention (see §8, §9.10 framing)
- Native mobile apps
- Multi-language support
- Separate employer vs. internal placement-cell portals

## 14. Open Questions

- Exact MCP tool schema for the whiteboard — minimal viable set of callable tools
- Rubric-weighting: does conversational setup need a fallback form for the last mile of precision?
- Cadence of camera-integrity checks during role-play/scenario segments vs. regular Q&A
- How fullscreen enforcement should degrade on mobile browsers

---

*Companion documents: EchoSphere Ideology v0.1 (why), EchoSphere Technical Blueprint v0.2 (how). This PRD is the what/priority layer connecting the two — update it as scope decisions change.*
