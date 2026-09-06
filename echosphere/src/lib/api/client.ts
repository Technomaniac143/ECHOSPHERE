import type { ApiError } from "@/types";

const API_URL = (() => {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return window.__NEXT_PUBLIC_API_URL__ ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
})();

// Allow per-request override for demo/dev proxying
export function apiBaseUrl(overrides?: { base?: string }) {
  return overrides?.base ?? API_URL;
}

export class ApiClientError extends Error {
  constructor(public message: string, public statusCode?: number, public detail?: unknown) {
    super(message);
  }
}

export function apiBase(): string {
  return API_URL;
}

function isJson(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.includes("application/json") || ct.includes("application/vnd.api+json");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  { base }: { base?: string } = {},
): Promise<T> {
  const url = `${apiBaseUrl({ base })}${path}`;

  const headersInit: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.headers) {
    Object.entries(options.headers).forEach(([k, v]) => {
      if (v != null && v !== "") {
        headersInit[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }
    });
  }

  // Automatically stringify JSON bodies and set content-type.
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headersInit["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    ...options,
    headers: headersInit,
    credentials: "include",
  });

  if (!res.ok) {
    let detail: unknown = undefined;
    try {
      if (isJson(res.headers.get("content-type"))) {
        detail = await res.json();
      } else {
        detail = await res.text().catch(() => undefined);
      }
    } catch {
      detail = undefined;
    }

    const message =
      typeof detail === "object" && detail !== null && "message" in detail
        ? String((detail as ApiError).message)
        : `Request failed with status ${res.status}`;

    throw new ApiClientError(message, res.status, detail);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (isJson(res.headers.get("content-type"))) {
    return (await res.json()) as T;
  }

  return (await res.text()) as unknown as T;
}

// ---------- Generic CRUD helpers ----------

export const api = {
  get<T>(path: string, init?: RequestInit, opts?: { base?: string }) {
    return request<T>(path, { ...init, method: "GET" }, opts);
  },

  post<T>(path: string, body?: unknown, init?: RequestInit, opts?: { base?: string }) {
    return request<T>(path, { ...init, method: "POST", body: body ? JSON.parse(JSON.stringify(body)) : undefined }, opts);
  },

  put<T>(path: string, body?: unknown, init?: RequestInit, opts?: { base?: string }) {
    return request<T>(path, { ...init, method: "PUT", body: body ? JSON.parse(JSON.stringify(body)) : undefined }, opts);
  },

  patch<T>(path: string, body?: unknown, init?: RequestInit, opts?: { base?: string }) {
    return request<T>(path, { ...init, method: "PATCH", body: body ? JSON.parse(JSON.stringify(body)) : undefined }, opts);
  },

  delete<T>(path: string, init?: RequestInit, opts?: { base?: string }) {
    return request<T>(path, { ...init, method: "DELETE" }, opts);
  },
};

// ---------- Domain-specific wrappers ----------

export const candidateApi = {
  profile: () => api.get<{ data: import("@/types").CandidateProfile }>("/api/candidate/profile"),
  updateProfile: (body: Partial<import("@/types").CandidateProfile>) =>
    api.put<{ data: import("@/types").CandidateProfile }>("/api/candidate/profile", body),
  resume: (form: FormData) =>
    fetch(`${apiBase()}/api/candidate/resume`, { method: "POST", body: form, credentials: "include" }),
  certificates: (form: FormData) =>
    fetch(`${apiBase()}/api/candidate/certificates`, { method: "POST", body: form, credentials: "include" }),
  systemCheck: (body: { camera: boolean; microphone: boolean; screen_share: boolean; network: boolean }) =>
    api.post<{ status: string; camera: string; microphone: string; screen_share: string; network: string; message: string }>("/api/candidate/system-check", body),
  sampleVideo: (form: FormData) =>
    fetch(`${apiBase()}/api/candidate/sample-video`, { method: "POST", body: form, credentials: "include" }),
  analysis: () =>
    api.get<{ data: Record<string, any> }>("/api/candidate/analysis"),
};

export const interviewApi = {
  list: async (params?: { status?: string; limit?: number; offset?: number; candidate_id?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    if (params?.candidate_id) search.set("candidate_id", params.candidate_id);
    const qs = search.toString();
    try {
      const res = await api.get<any>(`/api/interviews${qs ? `?${qs}` : ""}`);
      if (Array.isArray(res)) {
        return { data: res as import("@/types").Session[], total: res.length };
      }
      if (res && Array.isArray(res.data)) {
        return res as { data: import("@/types").Session[]; total?: number };
      }
      if (res && Array.isArray(res.interviews)) {
        return { data: res.interviews as import("@/types").Session[], total: res.total ?? res.interviews.length };
      }
      return { data: [] as import("@/types").Session[], total: 0 };
    } catch (err) {
      console.warn("Could not load interviews:", err);
      return { data: [] as import("@/types").Session[], total: 0 };
    }
  },
  get: (id: string) => api.get<{ data: import("@/types").Session }>(`/api/interviews/${id}`),
  reports: (sessionId: string) => api.get<{ data: import("@/types").Report }>(`/api/reports/${sessionId}`),
};

export const sessionApi = {
  create: (body: {
    mode: "practice" | "assessment";
    company?: string;
    role?: string;
    domain?: string;
    personas?: import("@/types").PersonaKey[];
    difficulty?: import("@/types").DifficultyLevel;
    targetRole?: string;
    targetCompany?: string;
  }) => api.post<{ data: import("@/types").Session }>("/api/sessions", body),

  start: (id: string) => api.post<{ data: import("@/types").Session; agoraToken?: string; agoraChannel?: string }>(
    `/api/sessions/${id}/start`,
  ),

  get: (id: string) => api.get<{ data: import("@/types").Session }>(`/api/sessions/${id}`),

  end: (id: string) => api.post<{ data: import("@/types").Session }>(`/api/sessions/${id}/end`),

  // WS- backed live state is handled by useInterview hook; this is the REST fallback.
  whiteboard: (sessionId: string) =>
    api.get<{ data: import("@/types").WhiteboardState }>(`/api/sessions/${sessionId}/whiteboard`),
};

export const setupApi = {
  parse: (body: { resumeText?: string; company?: string; role?: string; domain?: string }) =>
    api.post<{ data: import("@/types").InterviewSetup }>("/api/setup/parse", body),
};

export const organizationApi = {
  create: (body: Partial<import("@/types").Organization>) =>
    api.post<{ data: import("@/types").Organization }>("/api/organizations", body),
  get: (id: string) => api.get<{ data: import("@/types").Organization }>(`/api/organizations/${id}`),
  questions: () => api.get<{ data: import("@/types").Organization[] }>("/api/organizations/question-bank"),
  addQuestion: (body: unknown) =>
    api.post<{ data: { id: string } }>("/api/organizations/question-bank", body),
  assessments: () => api.get<{ data: import("@/types").Assessment[] }>("/api/organizations/assessments"),
  createAssessment: (body: Partial<import("@/types").Assessment>) =>
    api.post<{ data: import("@/types").Assessment }>("/api/organizations/assessments", body),
  candidates: (params?: { role?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.role) search.set("role", params.role);
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return api.get<{ data: import("@/types").OrgCandidate[]; total?: number }>(
      `/api/organizations/candidates${qs ? `?${qs}` : ""}`,
    );
  },
  candidate: (id: string) => api.get<{ data: import("@/types").OrgCandidate }>(`/api/organizations/candidates/${id}`),
  analytics: (batchId?: string) =>
    api.get<{ data: Record<string, unknown> }>(`/api/analytics/batches/${batchId ?? "latest"}/analytics`),
};

// ---------- Typed error handling ----------

export async function withApiError<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      err instanceof Error ? err.message : "An unexpected error occurred",
      undefined,
      err,
    );
  }
}

export { ApiClientError as _ApiClientError };
