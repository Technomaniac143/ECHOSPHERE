// Shared type definitions for frontend.
// These types mirror the backend contracts (TRD v1.0 / Master Build Prompt).
// The real API may evolve them, but these are the shapes the frontend assumes.

// ── Auth / Users ──

export type UserRole = "student" | "hr_admin";

export interface User {
  id: string;
  role: UserRole;
  email: string;
  name: string | null;
  imageUrl?: string | null;
  createdAt: string;
}

// ── Candidate Profile ──

export interface CandidateProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  targetCompany?: string | null;
  targetRole?: string | null;
  targetDomain?: string | null;
  experienceLevel?: string | null;
  portfolioUrl?: string | null;
  githubUrl?: string | null;
  leetcodeUrl?: string | null;
  university?: string | null;
  degree?: string | null;
  department?: string | null;
  graduationYear?: number | null;
  cgpa?: number | null;
  relevantCoursework?: string | null;
  skills?: SkillTag[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillTag {
  id?: string;
  name: string;
  category: string;
}

export interface Certificate {
  id?: string;
  name: string;
  issuer?: string | null;
  issuedAt?: string | null;
  issueDate?: string | null;
  fileUrl?: string | null;
  credentialUrl?: string | null;
}

// ── Organization ──

export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  tier: string;
  officialEmail?: string | null;
  industry?: string | null;
  website?: string | null;
  location?: string | null;
  companySize?: string | null;
  hrName?: string | null;
  hrPhone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgCandidate {
  id: string;
  name: string;
  email: string;
  status: "pending" | "in_progress" | "completed" | "scheduled";
  overallScore?: number | null;
  technicalScore?: number | null;
  behavioralScore?: number | null;
  communicationScore?: number | null;
  interviewDate?: string | null;
  role?: string | null;
  company?: string | null;
  domain?: string | null;
  sessionId?: string | null;
  createdAt: string;
}

export interface Assessment {
  id: string;
  name: string;
  role: string;
  domain: string;
  difficulty: string;
  personas: string[];
  durationMinutes: number;
  expiringAt?: string | null;
  joinCode?: string | null;
  competencies?: string[];
  createdAt: string;
}

// ── Interview Setup ──

export const POPULAR_COMPANIES = [
  "Google", "Microsoft", "Amazon", "Apple", "Meta", "Netflix",
  "Uber", "Airbnb", "Stripe", "Shopify", "Atlassian", "Salesforce",
  "Oracle", "Adobe", "IBM", "Intuit", "Twilio", "Datadog",
  "Snowflake", "Palantir", "CrowdStrike", "Okta", "Cloudflare",
  "Coinbase", "Robinhood", "Ripple", "Nubank", "Grab", "GoTo",
  "Other (describe below)",
] as const;

export const POPULAR_ROLES = [
  "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
  "Frontend Engineer", "Backend Engineer", "Full Stack Engineer",
  "Data Engineer", "Machine Learning Engineer", "DevOps Engineer",
  "Product Manager", "Engineering Manager", "Tech Lead",
  "iOS Engineer", "Android Engineer",
  "Other (describe below)",
] as const;

export const POPULAR_DOMAINS = [
  "Web Development", "Mobile Development", "Data Engineering",
  "Machine Learning / AI", "DevOps / Infrastructure",
  "Product Management", "Systems Design", "Security",
  "Other (describe below)",
] as const;

export const DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// ── Persona Definitions ──

export const PERSONAS = {
  behavioral: {
    key: "behavioral",
    name: "Sarah Chen",
    role: "HR Lead",
    label: "Behavioral",
    color: "#8b5cf6",
    avatar: "SC",
    style: "warm, empathetic, structured",
    signatureQuestion: "Tell me about a time you disagreed with a team member.",
    prompt: "You are Sarah Chen, an experienced HR Lead interviewing a candidate.\nYou speak in a warm, empathetic but structured way. Ask one question at a time.\nAfter the candidate answers, briefly acknowledge, then move to the next question.\nFocus on behavioral competencies: teamwork, conflict, leadership, adaptability.\nKeep answers concise (under 4 sentences). Stay in character throughout.",
  },
  technical: {
    key: "technical",
    name: "Marcus Rivera",
    role: "Tech Lead",
    label: "Technical",
    color: "#3b82f6",
    avatar: "MR",
    style: "rigorous, Socratic, depth-focused",
    signatureQuestion: "Walk me through how you'd design a URL shortening service.",
    prompt: "You are Marcus Rivera, a Tech Lead conducting a technical interview.\nYou are rigorous but fair. Ask one question at a time. Dive deep into the candidate's answers.\nProbe edge cases, trade-offs, and alternatives. If the candidate is vague, ask a clarifying question.\nKeep the conversation flowing naturally. Stay in character.",
  },
  domain: {
    key: "domain",
    name: "Dr. Aisha Patel",
    role: "Domain Expert",
    label: "Domain Expert",
    color: "#10b981",
    avatar: "AP",
    style: "analytical, scenario-based, practical",
    signatureQuestion: "How would you handle a data pipeline that's consistently lagging?",
    prompt: "You are Dr. Aisha Patel, a domain expert conducting a domain-specific interview.\nAsk scenario-based questions that test practical knowledge. One question at a time.\nPush for concrete examples and trade-off reasoning.\nStay in character throughout.",
  },
  leadership: {
    key: "leadership",
    name: "James Okafor",
    role: "Engineering Director",
    label: "Leadership",
    color: "#f59e0b",
    avatar: "JO",
    style: "strategic, opinionated, mentorship-oriented",
    signatureQuestion: "Describe a time you had to make a technical decision with incomplete information.",
    prompt: "You are James Okafor, an Engineering Director conducting a leadership interview.\nFocus on strategic thinking, decision-making under uncertainty, mentorship, and cross-team impact.\nOne question at a time. Push for depth. Stay in character.",
  },
  culture: {
    key: "culture",
    name: "Lin Wei",
    role: "People & Culture Partner",
    label: "Culture",
    color: "#ec4899",
    avatar: "LW",
    style: "curious, values-driven, conversational",
    signatureQuestion: "What kind of work environment helps you do your best work?",
    prompt: "You are Lin Wei, a People & Culture Partner conducting a culture-fit interview.\nAsk values-driven questions. Be curious and conversational. One question at a time.\nAvoid yes/no questions. Stay in character throughout.",
  },
  product: {
    key: "product",
    name: "Maya Patel",
    role: "Product Manager",
    label: "Product",
    color: "#8b5cf6",
    avatar: "MP",
    style: "curious, data-driven, customer-focused",
    signatureQuestion: "How would you prioritize features for a product with a tight deadline?",
    prompt: "You are Maya Patel, a Product Manager conducting a product interview.\nAsk about product thinking, prioritization, customer impact, and trade-off reasoning.\nOne question at a time. Push for depth. Stay in character.",
  },
  hiring_manager: {
    key: "hiring_manager",
    name: "Daniel Torres",
    role: "Hiring Manager",
    label: "Hiring Manager",
    color: "#f59e0b",
    avatar: "DT",
    style: "pragmatic, results-oriented, team-focused",
    signatureQuestion: "Tell me about a time you had to deliver under a tight deadline.",
    prompt: "You are Daniel Torres, a Hiring Manager conducting an interview.\nFocus on ownership, delivery, team collaboration, and practical problem-solving.\nOne question at a time. Push for concrete examples. Stay in character.",
  },
} as const;

export type PersonaKey = keyof typeof PERSONAS;

export interface PersonaMeta {
  key: string;
  name: string;
  role: string;
  label: string;
  color: string;
  avatar: string;
  style: string;
  signatureQuestion: string;
  prompt: string;
}

// ── Interview Setup / Session ──

export interface InterviewSetup {
  company: string;
  customCompany?: string;
  role: string;
  customRole?: string;
  domain: string;
  customDomain?: string;
  difficulty: DifficultyLevel;
  personas: PersonaKey[];
  instructions?: string;
  sessionId?: string;
  // Populated by AI setup agent after parsing user intent
  suggestedPersonas?: string[];
  estimatedDuration?: number;
  focusAreas?: string[];
  mode?: "practice" | "assessment";
}

export type SessionStatus = "setup" | "lobby" | "in_progress" | "completed" | "ended";

export type InterviewPhase = "setup" | "information" | "lobby" | "calibration" | "session" | "processing" | "ending" | "completed" | "report";

export interface Session {
  id: string;
  userId: string;
  company: string;
  role: string;
  domain: string;
  difficulty: string;
  mode: "practice" | "assessment";
  status: SessionStatus;
  portalCode?: string | null;
  config?: Record<string, unknown>;
  agoraChannelName?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Whiteboard ──

export interface WhiteboardState {
  sessionId: string;
  currentPersona: PersonaKey;
  difficultyState: Record<string, { level: string; reason?: string }>;
  strengths: string[];
  weaknesses: string[];
  openThreads: Array<{
    id: string;
    description: string;
    assignedPersonaHint?: string;
  }>;
  claims: Array<{
    id: string;
    personaKey: PersonaKey;
    text: string;
    timestamp: string;
  }>;
  unresolvedThreads: number;
  lastUpdated: string;
}

// ── Report ──

export interface CompetencyScore {
  competency: string;
  score: number;
  maxScore: number;
  evidence: string[];
  strengths?: string[];
  weaknesses?: string[];
  rater?: string;
}

export interface PanelAssessment {
  personaKey: string;
  personaName: string;
  scores: CompetencyScore[];
  summary: string;
  disagreements: string[];
}

export interface ScoreBreakdown {
  technical: number;
  behavioral: number;
  communication: number;
  overall: number;
}

export interface Report {
  id: string;
  sessionId: string;
  candidateName: string;
  company: string;
  role: string;
  domain: string;
  difficulty: string;
  scores: ScoreBreakdown;
  competencyScores: CompetencyScore[];
  panel: PanelAssessment[];
  panelDisagreement: PanelDisagreementItem[];
  strengths: string[];
  weaknesses: string[];
  roadmap: string[];
  recommendations?: string[];
  transcriptUrl?: string | null;
  evidence: ReportEvidence[];
  timeline: ReportTimelineEvent[];
  createdAt: string;
}

export interface ReportEvidence {
  id: string;
  competency: string;
  quote: string;
  text?: string;
  timestamp?: number | null;
  turnIndex?: number | null;
}

export interface ReportTimelineEvent {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface PanelDisagreementItem {
  persona: string;
  personaLabel?: string;
  competency: string;
  score?: number;
  summary: string;
  strengths?: string[];
  concerns?: string[];
}

// ── API Envelopes ──

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  message: string;
  status?: number;
  detail?: unknown;
}

// ── User-facing ──

export interface UserProfile {
  user: User;
  profile?: CandidateProfile | null;
}

// ── Charts ──

export interface ScoreRange {
  range: string;
  count: number;
  pct: number;
}

export interface ActivityItem {
  id: string;
  type: "interview_completed" | "interview_started" | "interview_scheduled";
  candidate: string;
  role?: string;
  timestamp: string;
  score?: number | null;
}
