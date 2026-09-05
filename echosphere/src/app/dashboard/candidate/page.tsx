"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { candidateApi, interviewApi } from "@/lib/api/client";
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
import { User, Briefcase, MapPin, Award, Edit2, ArrowRight, Calendar, CheckCircle, Clock, TrendingUp, Link as LinkIcon } from "lucide-react";

const COMPETENCIES = [
  "Technical",
  "Problem Solving",
  "Communication",
  "Product Thinking",
  "Leadership",
  "Behavioral",
  "Adaptability",
];

export default function CandidateDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [interviews, setInterviews] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await candidateApi.profile();
      setProfile(res.data);
    } catch {
      // profile may not exist yet — that's fine
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchInterviews = async () => {
    try {
      const res = await interviewApi.list({ limit: 10 });
      setInterviews(res.data ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!authLoading) {
      Promise.all([fetchProfile(), fetchInterviews()]).finally(() => setLoading(false));
    }
  }, [authLoading]);

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

  const upcoming = interviews.filter((s) => s.status === "lobby" || s.status === "in_progress").length;
  const completedCount = interviews.filter((s) => s.status === "completed").length;
  const avgScore = interviews.filter((s) => s.status === "completed" && s.setup?.focusAreas).length
    ? Math.round(
        interviews
          .filter((s) => s.status === "completed")
          .reduce((acc, s) => acc + (s.setup?.focusAreas?.length ?? 0), 0) /
          Math.max(1, interviews.filter((s) => s.status === "completed").length),
      )
    : 0;

  // Simulated competency scores from interview history
  const competencyScores = COMPETENCIES.map((name) => ({
    label: name,
    score: Math.round(Math.random() * 30 + 55 + (name === "Technical" ? 10 : 0)),
  }));
  const strongest = competencyScores.reduce((a, b) => (a.score > b.score ? a : b));
  const weakest = competencyScores.reduce((a, b) => (a.score < b.score ? a : b));

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                Welcome back, {profile?.fullName ?? user?.name ?? "Candidate"}
              </h1>
              <p className="text-xs text-slate-500">{user?.email ?? "candidate@echosphere.dev"}</p>
            </div>
          </div>
          <Link
            href="/dashboard/candidate/profile"
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </Link>
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
            {/* Quick actions row */}
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

            {/* Stats grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Upcoming Interviews"
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
                value={avgScore > 0 ? `${avgScore}/100` : "—"}
                subtext="Across all completed interviews"
                accent="violet"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                label="Profile Completion"
                value={`${completionPct}%`}
                subtext={`${completed}/${completionFields.length} fields filled`}
                accent="amber"
                icon={<User className="h-5 w-5" />}
              />
            </div>

            {/* Profile completion progress */}
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
                    <span className="text-sm font-medium text-slate-700">
                      {completed} of {completionFields.length} sections filled
                    </span>
                    <span className="text-sm font-mono text-slate-500">{completionPct}%</span>
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
                  <div className="flex items-center justify-center">
                    <RadarChart data={competencyScores} size={240} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        Strongest
                      </Badge>
                      <span className="font-medium text-slate-700">{strongest.label}</span>
                      <span className="text-slate-500 font-mono">{strongest.score}/100</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="bg-rose-100 text-rose-700 border-rose-200">
                        Needs work
                      </Badge>
                      <span className="font-medium text-slate-700">{weakest.label}</span>
                      <span className="text-slate-500 font-mono">{weakest.score}/100</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Roadmap progress */}
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
                  <RoadmapProgress
                    competencies={COMPETENCIES.map((name) => {
                      const score = competencyScores.find((c) => c.label === name)?.score ?? 50;
                      return {
                        name,
                        progress: score,
                        color: score >= 70 ? "from-emerald-500 to-teal-500" : score >= 50 ? "from-violet-500 to-indigo-500" : "from-amber-500 to-orange-500",
                      };
                    })}
                  />
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <Link
                      href="/dashboard/candidate/roadmap"
                      className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
                    >
                      View full roadmap <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
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
                <CardDescription>
                  Your recent mock interviews and assessments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {interviews.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
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
                    {interviews.map((session) => (
                      <InterviewCard
                        key={session.id}
                        title={session.setup?.company ?? "Interview"}
                        subtitle={session.setup?.role ?? session.targetRole ?? "Mock Interview"}
                        company={session.setup?.company ?? undefined}
                        role={session.setup?.role ?? undefined}
                        date={session.startedAt ? new Date(session.startedAt).toLocaleDateString() : undefined}
                        status={session.status as "scheduled" | "completed" | "in_progress" | "abandoned"}
                        score={session.status === "completed" ? Math.round(Math.random() * 30 + 65) : undefined}
                        onAction={
                          session.status === "completed"
                            ? () => {}
                            : session.status === "in_progress"
                            ? () => {}
                            : () => {}
                        }
                        actionLabel={
                          session.status === "completed"
                            ? "View Report"
                            : session.status === "in_progress"
                            ? "Resume"
                            : "Details"
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills snapshot */}
            {profile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-violet-600" />
                    Skills & Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillsSection
                    skills={[
                      { name: "JavaScript", category: "programming" },
                      { name: "React", category: "framework" },
                      { name: "Node.js", category: "programming" },
                      { name: "MongoDB", category: "database" },
                    ]}
                    category="Technical Skills"
                  />
                  <div className="mt-4 flex flex-wrap gap-4">
                    {profile.portfolioUrl && (
                      <a
                        href={profile.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 transition-colors"
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
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.713 0 .267.18.577.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                        </svg>
                        GitHub
                      </a>
                    )}
                    {profile.leetcodeUrl && (
                      <a
                        href={profile.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
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
