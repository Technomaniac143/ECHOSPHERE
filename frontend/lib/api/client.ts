"""API client for EchoSphere frontend."""
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || `API error: ${res.status}`);
  }

  return res.json();
}

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Auth ──
export const authApi = {
  signup: (data: { email: string; password?: string; name: string; provider?: string }) =>
    apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  verifyClerkToken: (token: string) =>
    apiFetch("/auth/clerk/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  getCurrentUser: (token: string) =>
    apiFetch("/auth/me", { headers: getAuthHeaders(token) }),
};

// ── Candidate ──
export const candidateApi = {
  getProfile: (token: string) =>
    apiFetch("/candidate/profile", { headers: getAuthHeaders(token) }),

  updateProfile: (token: string, data: Record<string, unknown>) =>
    apiFetch("/candidate/profile", {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  uploadResume: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/candidate/resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error("Resume upload failed");
    return res.json();
  },

  updateSkills: (token: string, skills: string) =>
    apiFetch("/candidate/skills", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ skills }),
    }),

  parseSetup: (data: { user_input: string; mode?: string }) =>
    apiFetch("/candidate/setup/parse", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Sessions / Interviews ──
export const sessionsApi = {
  create: (data: Record<string, unknown>) =>
    apiFetch("/sessions", { method: "POST", body: JSON.stringify(data) }),

  start: (data: { session_id: string; greeting_text?: string }) =>
    apiFetch("/sessions/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (sessionId: string) => apiFetch(`/sessions/${sessionId}`),

  getState: (sessionId: string) =>
    apiFetch(`/sessions/${sessionId}/state`),

  end: (sessionId: string, reason?: string) =>
    apiFetch(`/sessions/${sessionId}/end`, {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, reason }),
    }),

  listActive: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiFetch(`/sessions/active${qs}`);
  },
};

// ── Reports ──
export const reportsApi = {
  get: (sessionId: string) => apiFetch(`/reports/${sessionId}`),
  getEvidence: (sessionId: string, competency?: string) =>
    apiFetch(`/reports/${sessionId}/evidence${competency ? `?competency=${competency}` : ""}`),
  getTimeline: (sessionId: string) => apiFetch(`/reports/${sessionId}/timeline`),
  getDisagreement: (sessionId: string) => apiFetch(`/reports/${sessionId}/disagreement`),
  getRoadmap: (sessionId: string) => apiFetch(`/reports/${sessionId}/roadmap`),
};

// ── Organizations ──
export const orgApi = {
  create: (data: Record<string, unknown>) =>
    apiFetch("/organizations", { method: "POST", body: JSON.stringify(data) }),

  getMy: () => apiFetch("/organizations/my"),

  listQuestions: (filters?: Record<string, string>) => {
    const qs = filters ? `?${new URLSearchParams(filters).toString()}` : "";
    return apiFetch(`/organizations/question-bank${qs}`);
  },

  createQuestion: (data: Record<string, unknown>) =>
    apiFetch("/organizations/question-bank", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createAssessment: (data: Record<string, unknown>) =>
    apiFetch("/organizations/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAssessments: (status?: string) =>
    apiFetch(`/organizations/assessments${status ? `?status=${status}` : ""}`),

  getAssessment: (id: string) => apiFetch(`/organizations/assessments/${id}`),

  inviteCandidates: (assessmentId: string) =>
    apiFetch(`/organizations/assessments/${assessmentId}/invite`, {
      method: "POST",
    }),

  listCandidates: (filters?: Record<string, string | number>) => {
    const qs = filters ? `?${new URLSearchParams(
      Object.entries(filters).map(([k, v]) => [k, String(v)]),
    ).toString()}` : "";
    return apiFetch(`/organizations/candidates${qs}`);
  },

  getCandidate: (id: string) => apiFetch(`/organizations/candidates/${id}`),

  getAnalytics: (batchId: string) => apiFetch(`/batches/${batchId}/analytics`),
};

// ── Interview history ──
export const interviewsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiFetch(`/interviews${qs}`);
  },

  get: (sessionId: string) => apiFetch(`/interviews/${sessionId}`),
};
