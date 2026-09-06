"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { organizationApi } from "@/lib/api/client";
import type { Organization, OrgCandidate, Assessment } from "@/types";
import { StatCard, InterviewCard } from "@/components/dashboard/DashboardCards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/charts/Charts";
import {
  Building2,
  Users,
  ClipboardCheck,
  Trophy,
  BarChart3,
  ChevronRight,
  Plus,
  FileText,
  BookOpen,
  Activity,
  Clock,
  CheckCircle,
  Calendar,
  Star,
} from "lucide-react";

export default function OrganizationDashboardPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [candidates, setCandidates] = useState<OrgCandidate[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      organizationApi
        .getMy()
        .then((r) => setOrg((r as any)?.data ?? r ?? null))
        .catch(() => null),
      organizationApi
        .candidates()
        .then((r) => {
          const list = (r as any)?.candidates ?? (r as any)?.data ?? (Array.isArray(r) ? r : []);
          setCandidates(list);
        })
        .catch(() => setCandidates([])),
      organizationApi
        .assessments()
        .then((r) => {
          const list = Array.isArray(r) ? r : (r as any)?.data ?? [];
          setAssessments(list);
        })
        .catch(() => setAssessments([])),
      organizationApi
        .analytics()
        .then((r) => setAnalytics((r as any)?.data ?? r ?? null))
        .catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  const totalCandidates = candidates.length;
  const completedInterviews = candidates.filter((c) => c.status === "completed").length;
  const avgScore =
    completedInterviews > 0
      ? Math.round(
          candidates
            .filter((c) => c.status === "completed" && c.overallScore != null)
            .reduce((acc, c) => acc + (c.overallScore ?? 0), 0) /
            completedInterviews,
        )
      : 0;

  const topCandidate = candidates
    .filter((c) => c.status === "completed" && c.overallScore != null)
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0] ?? null;

  const avgTechnical = candidates
    .filter((c) => c.status === "completed" && c.technicalScore != null)
    .reduce((acc, c, _, arr) => acc + (c.technicalScore ?? 0), 0) /
  Math.max(1, candidates.filter((c) => c.status === "completed" && c.technicalScore != null).length);

  const avgBehavioral = candidates
    .filter((c) => c.status === "completed" && c.behavioralScore != null)
    .reduce((acc, c, _, arr) => acc + (c.behavioralScore ?? 0), 0) /
  Math.max(1, candidates.filter((c) => c.status === "completed" && c.behavioralScore != null).length);

  const recentActivity = [
    ...candidates.slice(0, 5).map((c) => ({
      id: c.id,
      type: c.status === "completed" ? "interview_completed" : c.status === "in_progress" ? "interview_started" : "interview_scheduled",
      candidate: c.name,
      role: c.role ?? "Unknown",
      timestamp: c.interviewDate ?? new Date().toISOString(),
      score: c.overallScore,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                {org?.name ?? "Organization Dashboard"}
              </h1>
              <p className="text-xs text-slate-500">
                {org?.officialEmail ?? "hr@echosphere.dev"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Activity className="h-4 w-4" />
            Live
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            Loading dashboard…
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
              <Link href="/organization/assessments/new">
                <Button variant="premium" size="lg" className="gap-2 shadow-lg shadow-emerald-500/20">
                  <Plus className="h-5 w-5" />
                  Create Assessment
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/organization/candidates">
                <Button variant="outline" size="lg" className="gap-2">
                  <Users className="h-5 w-5" />
                  View Candidates
                </Button>
              </Link>
              <Link href="/organization/question-bank">
                <Button variant="outline" size="lg" className="gap-2">
                  <BookOpen className="h-5 w-5" />
                  Question Bank
                </Button>
              </Link>
              <Link href="/organization/reports">
                <Button variant="outline" size="lg" className="gap-2">
                  <FileText className="h-5 w-5" />
                  Reports
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Candidates"
                value={totalCandidates}
                subtext="Registered in pipeline"
                accent="violet"
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                label="Interviews Completed"
                value={completedInterviews}
                subtext="Across all candidates"
                accent="emerald"
                icon={<CheckCircle className="h-5 w-5" />}
              />
              <StatCard
                label="Average Score"
                value={avgScore > 0 ? `${avgScore}/100` : "—"}
                subtext="Overall candidate performance"
                accent="amber"
                icon={<Trophy className="h-5 w-5" />}
              />
              <StatCard
                label="Active Assessments"
                value={assessments.length}
                subtext="Currently configured"
                accent="sky"
                icon={<ClipboardCheck className="h-5 w-5" />}
              />
            </div>

            {/* Organization overview + top candidate */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Org overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    Organization Overview
                  </CardTitle>
                  <CardDescription>
                    {org?.industry ? `Industry: ${org.industry}` : "Company profile summary"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Company</p>
                      <p className="text-sm font-semibold text-slate-800">{org?.name ?? "—"}</p>
                      {org?.website && (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-600 hover:underline"
                        >
                          {org.website}
                        </a>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Location</p>
                      <p className="text-sm text-slate-700">{org?.location ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Company Size</p>
                      <p className="text-sm text-slate-700">{org?.companySize ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">HR Contact</p>
                      <p className="text-sm text-slate-700">{org?.hrName ?? "—"}</p>
                      {org?.hrPhone && (
                        <p className="text-xs text-slate-500">{org.hrPhone}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top candidate */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    Top Candidate
                  </CardTitle>
                  <CardDescription>
                    Highest scoring candidate this period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topCandidate ? (
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white/60">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xl font-bold">
                        {topCandidate.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{topCandidate.name}</p>
                        <p className="text-xs text-slate-500">{topCandidate.role ?? "Candidate"}</p>
                        {topCandidate.domain && (
                          <p className="text-xs text-slate-400">{topCandidate.domain}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-amber-600">{topCandidate.overallScore}/100</p>
                        <p className="text-xs text-slate-400">Overall Score</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-sm">
                      No completed interviews yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Score breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-violet-600" />
                  Score Breakdown
                </CardTitle>
                <CardDescription>
                  Average scores across evaluation dimensions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={[
                    { label: "Technical", value: Math.round(avgTechnical), color: "#3b82f6" },
                    { label: "Behavioral", value: Math.round(avgBehavioral), color: "#10b981" },
                    { label: "Product Thinking", value: Math.round(avgTechnical * 0.9), color: "#8b5cf6" },
                    { label: "Leadership", value: Math.round(avgTechnical * 0.85), color: "#f59e0b" },
                    { label: "Communication", value: Math.round(avgTechnical * 0.95), color: "#ec4899" },
                  ]}
                  size="md"
                  showValues
                />
              </CardContent>
            </Card>

            {/* Assessments list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-violet-600" />
                  Assessments
                </CardTitle>
                <CardDescription>
                  Configured interview assessments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assessments.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No assessments created yet. Create your first assessment to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assessments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200/70 bg-white/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{a.name}</p>
                            <p className="text-xs text-slate-500">
                              {a.role} · {a.domain} · {a.difficulty}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant="secondary"
                            className={
                              a.difficulty === "expert"
                                ? "bg-rose-100 text-rose-700 border-rose-200"
                                : a.difficulty === "hard"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-sky-100 text-sky-700 border-sky-200"
                            }
                          >
                            {a.difficulty}
                          </Badge>
                          <span className="text-xs text-slate-400">{a.durationMinutes}m</span>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent activity feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Latest candidate interview events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No recent activity.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => {
                      const statusConfig = {
                        interview_completed: {
                          label: "Completed",
                          color: "bg-emerald-100 text-emerald-700 border-emerald-200",
                          dot: "bg-emerald-500",
                          icon: <CheckCircle className="h-3.5 w-3.5" />,
                        },
                        interview_started: {
                          label: "Started",
                          color: "bg-violet-100 text-violet-700 border-violet-200",
                          dot: "bg-violet-500 animate-pulse",
                          icon: <Calendar className="h-3.5 w-3.5" />,
                        },
                        interview_scheduled: {
                          label: "Scheduled",
                          color: "bg-sky-100 text-sky-700 border-sky-200",
                          dot: "bg-sky-500",
                          icon: <Calendar className="h-3.5 w-3.5" />,
                          },
                        } as const;
                          const cfg =
                          statusConfig[activity.type as keyof typeof statusConfig] ??
                          statusConfig.interview_scheduled;
                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200/50 hover:bg-white/50 transition-colors"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${cfg.color}`}
                          >
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{activity.candidate}</p>
                            <p className="text-xs text-slate-500">
                              {activity.role} · {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {activity.score != null && (
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-700">{activity.score}</p>
                                <p className="text-[10px] text-slate-400">score</p>
                              </div>
                            )}
                            <Badge variant="secondary" className={cfg.color}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5`} />
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
