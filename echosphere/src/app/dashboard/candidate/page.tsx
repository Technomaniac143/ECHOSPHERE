"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { candidateApi, interviewApi, ApiClientError } from "@/lib/api/client";
import { useCandidateAnalytics, useLiveAnalytics } from "@/hooks/useAnalytics";
import type { CandidateProfile, Session } from "@/types";
import {
  StatCard,
  InterviewCard,
  RoadmapProgress,
  ProfileSection,
  SkillsSection,
} from "@/components/dashboard/DashboardCards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadarChart } from "@/components/charts/Charts";
import {
  User,
  Briefcase,
  Award,
  Edit2,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  Link as LinkIcon,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

// ── Error state component ──────────────────────────────────────────────────────

function ErrorBanner({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-destructive">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ── Live status indicator ─────────────────────────────────────────────────────

function LiveIndicator({ connected }: { connected: boolean | null }) {
  // null = still checking (don't flash Offline on load)
  if (connected === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground border border-border">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
        Connecting...
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected
          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          : "bg-muted text-muted-foreground border border-border"
      }`}
    >
      {connected ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {connected ? "Live" : "Offline"}
    </span>
  );
}

// ── Competency labels ──────────────────────────────────────────────────────────

const COMPETENCIES = [
  "Technical",
  "Problem Solving",
  "Communication",
  "Product Thinking",
  "Leadership",
  "Behavioral",
  "Adaptability",
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CandidateDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [interviews, setInterviews] = useState<Session[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);

  // Real competency analytics from backend
  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
  } = useCandidateAnalytics(user?.id ?? null);

  // Real-time live stream
  const { snapshot: liveSnapshot, connected: liveConnected } = useLiveAnalytics();

  // ── Data fetching — errors surfaced, not swallowed ────────────────────────

  const fetchProfile = async () => {
    setProfileError(null);
    try {
      const res = await candidateApi.profile();
      setProfile(res.data);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        // Profile simply doesn't exist yet — not an error state
        setProfile(null);
      } else {
        setProfileError(
          err instanceof ApiClientError
            ? `Profile load failed: ${err.message}`
            : "Unexpected error loading profile"
        );
      }
    }
  };

  const fetchInterviews = async () => {
    setInterviewsError(null);
    try {
      const res = await interviewApi.list({ limit: 10 });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setInterviews(items);
    } catch {
      // If no interviews or error, leave blank without showing error
      setInterviews([]);
      setInterviewsError(null);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      Promise.all([fetchProfile(), fetchInterviews()]).finally(() =>
        setPageLoading(false)
      );
    }
  }, [authLoading]);

  // ── Profile completion ────────────────────────────────────────────────────

  const completionFields = [
    { key: "fullName" as const, label: "Name", value: profile?.fullName ?? "" },
    { key: "email" as const, label: "Email", value: profile?.email ?? "" },
    { key: "phone" as const, label: "Phone", value: profile?.phone ?? "" },
    { key: "location" as const, label: "Location", value: profile?.location ?? "" },
    { key: "targetCompany" as const, label: "Target Company", value: profile?.targetCompany ?? "" },
    { key: "targetRole" as const, label: "Target Role", value: profile?.targetRole ?? "" },
    { key: "targetDomain" as const, label: "Domain", value: profile?.targetDomain ?? "" },
    { key: "experienceLevel" as const, label: "Experience", value: profile?.experienceLevel ?? "" },
    { key: "portfolioUrl" as const, label: "Portfolio", value: profile?.portfolioUrl ?? "" },
    { key: "githubUrl" as const, label: "GitHub", value: profile?.githubUrl ?? "" },
    { key: "leetcodeUrl" as const, label: "LeetCode", value: profile?.leetcodeUrl ?? "" },
  ];
  const completed = completionFields.filter((f) => f.value).length;
  const completionPct = Math.round((completed / completionFields.length) * 100);

  // ── Derived stats — from real data only ──────────────────────────────────

  const upcoming = interviews.filter(
    (s) => s.status === "lobby" || s.status === "in_progress"
  ).length;

  const completedCount = interviews.filter((s) => s.status === "completed").length;

  // Average score comes from real reports via analytics — not Math.random()
  const scoredSessions = analyticsData?.session_history?.filter((s) => s.overall_score !== null) ?? [];
  const avgScore = scoredSessions.length > 0
    ? scoredSessions.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / scoredSessions.length
    : null;

  // Competency scores from real backend — null means "no data yet"
  const competencyScores = analyticsData?.competency_scores ?? null;

  const strongest = competencyScores && competencyScores.length > 0
    ? competencyScores.reduce((a, b) => (a.score > b.score ? a : b))
    : null;
  const weakest = competencyScores && competencyScores.length > 0
    ? competencyScores.reduce((a, b) => (a.score < b.score ? a : b))
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Welcome back, {profile?.fullName ?? user?.name ?? "Candidate"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {user?.email ?? "candidate@echosphere.dev"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator connected={liveConnected} />
            <Link
              href="/dashboard/candidate/profile"
              className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {pageLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            Loading dashboard…
          </div>
        ) : (
          <>
            {/* Backend error banners */}
            {profileError && (
              <ErrorBanner title="Profile Error" message={profileError} />
            )}
            {interviewsError && (
              <ErrorBanner title="Interview History Error" message={interviewsError} />
            )}

            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
              <Link href="/interview/setup">
                <Button variant="premium" size="lg" className="gap-2 shadow-lg shadow-violet-500/20">
                  <Calendar className="h-5 w-5" />
                  Start New Mock Interview
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard/candidate/profile">
                <Button variant="outline" size="lg" className="gap-2">
                  <User className="h-5 w-5" />
                  View Profile
                </Button>
              </Link>
              <Link href="/dashboard/candidate/reports">
                <Button variant="outline" size="lg" className="gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Reports
                </Button>
              </Link>
              <Link href="/dashboard/candidate/roadmap">
                <Button variant="outline" size="lg" className="gap-2">
                  <Briefcase className="h-5 w-5" />
                  Roadmap
                </Button>
              </Link>
            </div>

            {/* Live stream stats (shown when connected) */}
            {liveSnapshot && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="pt-4 pb-3">
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Active now </span>
                      <span className="font-semibold text-emerald-600">
                        {liveSnapshot.active_sessions}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed today </span>
                      <span className="font-semibold text-foreground">
                        {liveSnapshot.completed_sessions}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total sessions </span>
                      <span className="font-semibold text-foreground">
                        {liveSnapshot.total_sessions}
                      </span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground/60">
                      updated {new Date(liveSnapshot.ts).toLocaleTimeString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Upcoming"
                value={upcoming}
                subtext="Sessions ready to start"
                accent="sky"
                icon={<Calendar className="h-5 w-5" />}
              />
              <StatCard
                label="Completed"
                value={completedCount}
                subtext="Mock & assessment sessions"
                accent="emerald"
                icon={<CheckCircle className="h-5 w-5" />}
              />
              <StatCard
                label="Average Score"
                value={
                  avgScore !== null
                    ? `${Math.round(avgScore)}/100`
                    : completedCount > 0
                    ? "Processing…"
                    : "—"
                }
                subtext="Across completed interviews"
                accent="violet"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                label="Profile"
                value={`${completionPct}%`}
                subtext={`${completed}/${completionFields.length} fields filled`}
                accent="amber"
                icon={<User className="h-5 w-5" />}
              />
            </div>

            {/* Profile completion */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-violet-600" />
                  Profile Completion
                </CardTitle>
                <CardDescription>
                  Complete your profile to unlock personalized interview preparation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {completed} of {completionFields.length} sections filled
                    </span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {completionPct}%
                    </span>
                  </div>
                  <Progress value={completionPct} className="h-2.5" />
                </div>
                {profile && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {completionFields.slice(0, 6).map((f) => (
                      <ProfileSection
                        key={f.key}
                        label={f.label}
                        value={f.value}
                        href="/dashboard/candidate/profile"
                        icon={<User className="h-4 w-4" />}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Competency radar + roadmap */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Radar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-violet-600" />
                    Competency Overview
                  </CardTitle>
                  <CardDescription>
                    Your performance across interview dimensions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground">
                      <Clock className="h-5 w-5 animate-spin mr-2" />
                      Loading analytics…
                    </div>
                  ) : analyticsError ? (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-destructive">Analytics unavailable</p>
                        <p className="text-muted-foreground mt-0.5">{analyticsError}</p>
                        <p className="text-muted-foreground/70 mt-1 text-xs">
                          Complete at least one interview for competency data.
                        </p>
                      </div>
                    </div>
                  ) : competencyScores && competencyScores.length > 0 ? (
                    <>
                      <div className="flex items-center justify-center">
                        <RadarChart data={competencyScores} size={240} />
                      </div>
                      {strongest && weakest && (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              Strongest
                            </Badge>
                            <span className="font-medium text-foreground">{strongest.label}</span>
                            <span className="text-muted-foreground font-mono">
                              {strongest.score}/100
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="bg-rose-100 text-rose-700 border-rose-200">
                              Needs work
                            </Badge>
                            <span className="font-medium text-foreground">{weakest.label}</span>
                            <span className="text-muted-foreground font-mono">
                              {weakest.score}/100
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      <Award className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No competency data yet.</p>
                      <p className="text-xs mt-1 opacity-70">
                        Start and complete an interview to see your scores.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Roadmap */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-violet-600" />
                    Roadmap Progress
                  </CardTitle>
                  <CardDescription>
                    Track your preparation across key competencies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {competencyScores ? (
                    <>
                      <RoadmapProgress
                        competencies={COMPETENCIES.map((name) => {
                          const found = competencyScores.find((c) => c.label === name);
                          const score = found?.score ?? 0;
                          return {
                            name,
                            progress: score,
                            color:
                              score >= 70
                                ? "from-emerald-500 to-teal-500"
                                : score >= 50
                                ? "from-violet-500 to-indigo-500"
                                : "from-amber-500 to-orange-500",
                          };
                        })}
                      />
                      <div className="mt-4 pt-4 border-t border-border">
                        <Link
                          href="/dashboard/candidate/roadmap"
                          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
                        >
                          View full roadmap <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>Complete an interview to see your roadmap.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Interview history */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-violet-600" />
                  Interview History
                </CardTitle>
                <CardDescription>Your recent mock interviews and assessments</CardDescription>
              </CardHeader>
              <CardContent>
                {interviewsError ? (
                  <ErrorBanner title="Could not load interviews" message={interviewsError} />
                ) : interviews.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No interviews yet. Start your first mock interview!</p>
                    <Link href="/interview/setup" className="mt-2 inline-block">
                      <Button variant="outline" size="sm" className="gap-1">
                        Start Interview <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {interviews.map((session) => {
                      // Use real score from analytics session_history or session payload
                      const realScore =
                        analyticsData?.session_history.find(
                          (h) => h.session_id === session.id
                        )?.overall_score ?? (session as any).overall_score ?? (session as any).overallScore ?? undefined;

                      const sessionCompany =
                        session.setup?.company ||
                        session.company ||
                        session.targetCompany ||
                        (session as any).target_company ||
                        "Mock Interview";

                      const sessionRole =
                        session.setup?.role ||
                        session.role ||
                        session.targetRole ||
                        (session as any).target_role ||
                        "General Interview";

                      const rawDate =
                        session.startedAt ||
                        (session as any).started_at ||
                        session.createdAt ||
                        (session as any).created_at;

                      const sessionDate = rawDate
                        ? new Date(rawDate).toLocaleDateString()
                        : undefined;

                      const actionTarget =
                        session.status === "completed"
                          ? `/reports/${session.id}`
                          : `/interview/setup?resume=${session.id}`;

                      return (
                        <InterviewCard
                          key={session.id}
                          title={sessionCompany}
                          subtitle={sessionRole}
                          company={sessionCompany !== "Mock Interview" ? sessionCompany : undefined}
                          role={sessionRole !== "General Interview" ? sessionRole : undefined}
                          date={sessionDate}
                          status={
                            session.status as
                              | "scheduled"
                              | "completed"
                              | "in_progress"
                              | "abandoned"
                          }
                          score={
                            session.status === "completed" && realScore !== undefined
                              ? Math.round(realScore)
                              : undefined
                          }
                          onAction={() => router.push(actionTarget)}
                          actionLabel={
                            session.status === "completed"
                              ? "View Report"
                              : session.status === "in_progress"
                              ? "Resume"
                              : "Details"
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills snapshot — from real profile */}
            {profile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-violet-600" />
                    Skills &amp; Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.skills && profile.skills.length > 0 ? (
                    <SkillsSection
                      skills={profile.skills.map((s: any) =>
                        typeof s === "string"
                          ? { name: s, category: "technical" }
                          : { name: s.name, category: s.category || "technical" }
                      )}
                      category="Technical Skills"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No skills added yet.{" "}
                      <Link
                        href="/dashboard/candidate/profile"
                        className="text-violet-600 hover:underline"
                      >
                        Add skills to your profile.
                      </Link>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-4">
                    {profile.portfolioUrl && (
                      <a
                        href={profile.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-violet-600 transition-colors"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Portfolio
                      </a>
                    )}
                    {profile.githubUrl && (
                      <a
                        href={profile.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-violet-600 transition-colors"
                      >
                        GitHub
                      </a>
                    )}
                    {profile.leetcodeUrl && (
                      <a
                        href={profile.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-violet-600 transition-colors"
                      >
                        LeetCode
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
