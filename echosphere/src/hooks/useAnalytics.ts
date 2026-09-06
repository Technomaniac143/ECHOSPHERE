"use client";

/**
 * useAnalytics — fetches real competency data from the backend and
 * optionally subscribes to the SSE live stream for real-time updates.
 *
 * No fallback data. If the backend is unreachable or returns an error,
 * `error` is set and `data` remains null.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000")
    : "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetencyScore {
  label: string;
  score: number;
  sessions: number;
  trend: "improving" | "declining" | "stable";
}

export interface SessionHistoryEntry {
  session_id: string;
  role: string | null;
  company: string | null;
  date: string | null;
  overall_score: number | null;
  competency_scores: Record<string, number>;
}

export interface CandidateAnalytics {
  candidate_id: string;
  total_sessions: number;
  competency_scores: CompetencyScore[];
  session_history: SessionHistoryEntry[];
  computed_at: string;
}

export interface OverviewAnalytics {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  abandoned_sessions: number;
  total_candidates: number;
  fetched_at: string;
}

export interface LiveSnapshot {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  recent_activity: Array<{
    session_id: string;
    role: string | null;
    company: string | null;
    ended_at: string | null;
  }>;
  ts: string;
}

// ─── Hook: candidate competency analytics ─────────────────────────────────────

export function useCandidateAnalytics(candidateId: string | null) {
  const [data, setData] = useState<CandidateAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/analytics/candidate/${encodeURIComponent(candidateId)}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

// ─── Hook: overview aggregate counts ─────────────────────────────────────────

export function useOverviewAnalytics() {
  const [data, setData] = useState<OverviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/analytics/overview`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
          throw new Error(body.detail ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setData(await res.json());
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load overview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

// ─── Hook: live SSE stream ────────────────────────────────────────────────────

export function useLiveAnalytics() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // EventSource is client-only
    if (typeof window === "undefined") return;

    const es = new EventSource(`${API_BASE}/api/analytics/live`, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data: LiveSnapshot = JSON.parse(event.data);
        setSnapshot(data);
      } catch {
        // malformed event — ignore
      }
    };

    es.addEventListener("error", (event) => {
      // Server sent an application-level error event
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        setError(data.error ?? "Stream error");
      } catch {
        setError("Stream connection error");
      }
      setConnected(false);
    });

    es.onerror = () => {
      setConnected(false);
      setError("Lost connection to live analytics stream");
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return { snapshot, connected, error };
}
