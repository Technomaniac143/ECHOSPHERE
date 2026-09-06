"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { interviewApi, ApiClientError } from "@/lib/api/client";
import { useCandidateAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import type { Session } from "@/types";
import { InterviewCard } from "@/components/dashboard/DashboardCards";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function CandidateReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: analyticsData } = useCandidateAnalytics(user?.id ?? null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await interviewApi.list({ status: "completed", limit: 50 });
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        setSessions(items);
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchReports();
    } else {
      // In case auth is loading or null, wait or default to empty if not logged in.
      // We will just wait. The auth hook handles redirecting if unauthenticated.
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/candidate")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-600" />
              Interview Reports
            </h1>
            <p className="text-xs text-muted-foreground">View detailed analytics from your past sessions</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Error loading reports</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-20 text-muted-foreground">
              <Clock className="h-6 w-6 animate-spin mr-2" />
              Loading your reports...
            </div>
          ) : sessions.length === 0 ? (
            <div className="col-span-full text-center py-16 border rounded-xl bg-card border-dashed">
              <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No reports yet</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Complete a mock interview to generate your first detailed performance report and competency analysis.
              </p>
              <Button asChild className="mt-6">
                <Link href="/interview/setup">Start an Interview</Link>
              </Button>
            </div>
          ) : (
            sessions.map((session) => {
              // Find score in analytics if available
              const historyEntry = analyticsData?.session_history.find(s => s.session_id === session.id);
              const score = historyEntry?.overall_score ?? null;

              return (
                <InterviewCard
                  key={session.id}
                  title={`${session.domain ?? "Technical"} Interview`}
                  company={session.company ?? session.targetCompany}
                  role={session.role ?? session.targetRole}
                  date={new Date(session.createdAt).toLocaleDateString()}
                  status="completed"
                  score={score}
                  onAction={() => router.push(`/reports/${session.id}`)}
                />
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
