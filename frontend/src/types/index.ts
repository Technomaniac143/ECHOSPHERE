"""Shared type definitions for frontend."""
// ── Enums ──

// ── Types ──

export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "hr_admin";
  imageUrl?: string | null;
}

export interface Candidate {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  targetRole?: string | null;
  targetCompany?: string | null;
  targetDomain?: string | null;
}

export interface Company {
  id: string;
  name: string;
}

export interface JobRole {
  id: string;
  name: string;
  category: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  companyId: string;
  roleId: string;
  domain: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface InterviewQuestion {
  id: string;
  interviewId: string;
  questionText: string;
  order: number;
  category: string;
  difficulty: "beginner" | "easy" | "medium" | "hard" | "expert";
  expectedCompetency?: string | null;
  answer?: string | null;
  answerDuration?: number | null;
  answeredAt?: string | null;
}

export interface InterviewResponse {
  id: string;
  questionId: string;
  text: string;
  duration: number;
  createdAt: string;
}

export interface CompetencyAssessment {
  id: string;
  interviewId: string;
  competency: string;
  score: number;
  feedback?: string | null;
  evidence?: string | null;
  assessedAt: string;
}

export interface InterviewReport {
  id: string;
  interviewId: string;
  overallScore: number;
  competencyScores: CompetencyAssessment[];
  summary?: string | null;
  recommendations?: string | null;
  generatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  website?: string | null;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}

export interface Assessment {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  status: "draft" | "active" | "completed";
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  questionText: string;
  order: number;
  category: string;
  difficulty: "beginner" | "easy" | "medium" | "hard" | "expert";
  points: number;
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  candidateId: string;
  score: number;
  startedAt?: string | null;
  completedAt?: string | null;
  submittedAt?: string | null;
}

export interface ApiResponse<T> {
  data: T;
  message?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
