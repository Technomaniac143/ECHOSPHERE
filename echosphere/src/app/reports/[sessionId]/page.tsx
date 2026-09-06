"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  RadarChart,
  BarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sparkles,
  Star,
  AlertTriangle,
  ChevronRight,
  Clock,
  Calendar,
  Users,
  BarChart2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Report, CompetencyScore, EvidenceLink, PanelPerspective } from "@/types";

// ── Types ──

interface CompetencyData {
  competency: string;
  score: number;
}

// ── Sample data (would come from API) ──

const SAMPLE_REPORT: Report = {
  id: "rep-001",
  sessionId: "sess-001",
  overallScore: 78,
  strengths: [
    "Strong debugging ability and backend fundamentals",
    "Clear, logical communication style",
    "Good ownership and teamwork examples"
  ],
  weaknesses: [
    "Could elaborate more on advanced topics under pressure",
    "Needs more focus on connecting implementation choices to user impact"
  ],
  competencyScores: [
    { competency: "Technical", score: 84, confidence: 0.86, strengths: ["Strong debugging ability", "Good backend fundamentals", "Clear technical explanations"], weaknesses: ["Could elaborate more on advanced topics"], evidence: [{ transcriptTurnId: "t1", timestamp: "08:42", text: "The candidate demonstrated understanding of caching and horizontal scaling." }] },
    { competency: "Problem Solving", score: 81, confidence: 0.78, strengths: ["Logical approach to challenges"], weaknesses: ["Could break down complex problems more systematically"], evidence: [{ transcriptTurnId: "t2", timestamp: "09:15", text: "Acknowledged the trade-offs in the proposed solution." }] },
    { competency: "Communication", score: 76, confidence: 0.82, strengths: ["Clear explanations", "Good questioning"], weaknesses: [], evidence: [] },
    { competency: "Product Thinking", score: 67, confidence: 0.72, strengths: ["Understood business context"], weaknesses: ["Did not consistently connect implementation choices to customer impact"], evidence: [{ transcriptTurnId: "t3", timestamp: "10:20", text: "The candidate focused on technical implementation but did not discuss user impact." }] },
    { competency: "Leadership", score: 72, confidence: 0.68, strengths: ["Strong ownership examples"], weaknesses: ["Limited discussion of team leadership"], evidence: [] },
    { competency: "Behavioral", score: 78, confidence: 0.80, strengths: ["Good teamwork examples", "Clear motivation"], weaknesses: [], evidence: [] },
    { competency: "Adaptability", score: 74, confidence: 0.70, strengths: ["Adapted well to feedback"], weaknesses: ["Could discuss more about handling ambiguity"], evidence: [] },
  ],
  evidenceLinks: [
    { competency: "Technical", transcriptTurnId: "t1", timestamp: "08:42", excerpt: "The candidate demonstrated understanding of caching and horizontal scaling." },
    { competency: "Product Thinking", transcriptTurnId: "t3", timestamp: "10:20", excerpt: "The candidate focused on technical implementation but did not discuss user impact." },
  ],
  panelDisagreement: [
    {
      persona: "technical",
      personaLabel: "Technical Interviewer",
      summary: "Strong technical implementation knowledge.",
      strengths: ["Strong debugging ability", "Good backend fundamentals"],
      concerns: ["Minor gaps in advanced topic depth"],
      score: 84,
    },
    {
      persona: "product",
      personaLabel: "Product Manager",
      summary: "Candidate did not consistently connect implementation choices to customer impact.",
      strengths: [],
      concerns: ["Limited product thinking discussion", "Technical focus over user impact"],
      score: 67,
    },
    {
      persona: "hiring_manager",
      personaLabel: "Hiring Manager",
      summary: "Strong ownership demonstrated.",
      strengths: ["Strong ownership examples"],
      concerns: ["Limited leadership depth"],
      score: 72,
    },
  ],
  recommendations: [
    "Practice system-design tradeoffs.",
    "Quantify project outcomes with metrics.",
    "Connect technical decisions to customer impact.",
    "Practice STAR-format behavioral responses.",
  ],
  durationSeconds: 1180,
  startedAt: "2026-09-05T10:00:00Z",
  endedAt: "2026-09-05T11:58:00Z",
  generatedAt: "2026-09-05T12:00:00Z",
};

const COMPETENCY_COLORS: Record<string, string> = {
  Technical: "#3b82f6",
  "Problem Solving": "#8b5cf6",
  Communication: "#10b981",
  "Product Thinking": "#f59e0b",
  Leadership: "#ec4899",
  Behavioral: "#06b6d4",
  Adaptability: "#84cc16",
};

// ── Component ──

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceLink | null>(null);

  const handleDownloadReport = () => {
    const reportData = report ?? SAMPLE_REPORT;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview_report_${sessionId || "summary"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      window.print();
    }, 300);
  };

  useEffect(() => {
    // Fetch report from API
    const fetchReport = async () => {
      try {
        const data = await fetch(`/api/reports/${sessionId}`);
        const json = await data.json();
        setReport(json);
      } catch {
        // Use sample data for demo
        setReport(SAMPLE_REPORT);
      } finally {
        setLoading(false);
      }
    };

    // Simulate loading
    const timer = setTimeout(() => {
      setReport(SAMPLE_REPORT);
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [sessionId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-blue-500/20 border-t-blue-500">
              <Sparkles className="h-8 w-8 text-blue-400" />
            </div>
          </motion.div>
          <p className="text-lg text-zinc-400">Generating your interview report...</p>
          <div className="mt-6 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 w-1 rounded-full bg-blue-500/60"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const competencyScores = report.competencyScores || [];
  const strengths = report.strengths || [];
  const weaknesses = report.weaknesses || [];
  const panelDisagreement = report.panelDisagreement || [];

  const radarData: CompetencyData[] = competencyScores.map((cs) => ({
    competency: cs.competency,
    score: cs.score,
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Interview Report</h1>
              <p className="text-sm text-zinc-500">Evidence-backed assessment</p>
            </div>
          </div>

          <Card className="border-white/5 bg-white/[0.02] mt-4">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Candidate</p>
                  <p className="text-white font-medium">Arjun Sharma</p>
                  <p className="text-xs text-zinc-500">Backend Engineer at Amazon</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-zinc-400">Interview Date</p>
                <p className="text-white font-medium">{formatDate(report.startedAt || "")}</p>
                <p className="text-xs text-zinc-500">{formatDuration(report.durationSeconds || 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall score */}
        <div className="grid gap-4 mb-8 lg:grid-cols-3">
          {/* Overall score hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center"
          >
            <p className="text-sm text-zinc-500 mb-2">Overall Score</p>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="mb-2"
            >
              <span className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                {report.overallScore}
              </span>
              <span className="text-2xl text-zinc-500">/100</span>
            </motion.div>
            <div className="flex items-center justify-center gap-1">
              <div className="h-2 w-24 rounded-full bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                  style={{ width: `${report.overallScore}%` }}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Confidence: {((competencyScores[0]?.confidence || 0) * 100).toFixed(0)}%
            </p>
          </motion.div>

          {/* Strengths */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Key Strengths</h3>
            </div>
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Weaknesses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">Areas for Improvement</h3>
            </div>
            <ul className="space-y-2">
              {weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Charts row */}
        <div className="grid gap-4 mb-8 lg:grid-cols-2">
          {/* Radar chart */}
          <Card className="border-white/5 bg-white/[0.02] lg:col-span-1">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-base text-white">Competency Profile</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Your performance across all assessed competencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <RadarChart
                  data={radarData}
                  margin={{ top: 20, right: 30, left: 30, bottom: 10 }}
                  outerRadius={90}
                  innerRadius={50}
                >
                  <PolarGrid stroke="#3f3f46" strokeDasharray="2 2" />
                  <PolarAngleAxis dataKey="competency" stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    dot={{ fill: "#3b82f6", r: 3 }}
                  />
                </RadarChart>
              </div>
            </CardContent>
          </Card>

          {/* Persona scores bar chart */}
          <Card className="border-white/5 bg-white/[0.02] lg:col-span-1">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-base text-white">Persona Scores</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                How each interviewer assessed you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {panelDisagreement.map((p) => {
                  const compKey = p.competency || "Technical";
                  const color = COMPETENCY_COLORS[compKey] || "#3b82f6";
                  const label = p.personaLabel || p.persona;
                  return (
                    <div key={p.persona} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style={{ backgroundColor: color }}
                          >
                            {label.charAt(0)}
                          </div>
                          <span className="text-zinc-300">{label}</span>
                        </div>
                        <span className="text-white font-medium">{p.score}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${p.score}%, backgroundColor: ${color}` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score breakdown tabs */}
        <Card className="border-white/5 bg-white/[0.02] mb-8">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4 bg-white/5 border border-white/10">
              <TabsTrigger value="all" className="text-zinc-400 hover:text-white">
                All Competencies ({competencyScores.length})
              </TabsTrigger>
              <TabsTrigger value="strengths" className="text-zinc-400 hover:text-white">
                Strengths
              </TabsTrigger>
              <TabsTrigger value="weaknesses" className="text-zinc-400 hover:text-white">
                Weaknesses
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {competencyScores.map((cs, i) => {
                const color = COMPETENCY_COLORS[cs.competency] || "#3b82f6";
                return (
                  <motion.div
                    key={cs.competency}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
                          style={{ backgroundColor: color + "20" }}
                        >
                          {cs.competency.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white">{cs.competency}</h3>
                          <p className="text-xs text-zinc-500">Confidence: {((cs.confidence || 0) * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-3xl font-bold"
                          style={{ color }}
                        >
                          {cs.score}
                        </span>
                        <span className="text-zinc-500 text-sm">/100</span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="h-2 rounded-full bg-zinc-700 overflow-hidden mb-4">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${cs.score}%, backgroundColor: ${color}` }}
                      />
                    </div>

                    {/* Strengths/weaknesses */}
                    {((cs.strengths && cs.strengths.length > 0) || (cs.weaknesses && cs.weaknesses.length > 0)) && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {cs.strengths && cs.strengths.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-emerald-400 font-medium">Strengths</p>
                            {cs.strengths.map((s, i) => (
                              <p key={i} className="text-xs text-zinc-400 pl-2">
                                ✓ {s}
                              </p>
                            ))}
                          </div>
                        )}
                        {cs.weaknesses && cs.weaknesses.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-amber-400 font-medium">Weaknesses</p>
                            {cs.weaknesses.map((w, i) => (
                              <p key={i} className="text-xs text-zinc-400 pl-2">
                                ⚠ {w}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Evidence link */}
                    {cs.evidence.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full border-white/10 text-zinc-400 hover:text-white"
                        onClick={() => setActiveEvidence(cs.evidence[0])}
                      >
                        View Evidence
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </TabsContent>

            <TabsContent value="strengths" className="space-y-2">
              {strengths.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-zinc-300">{s}</span>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="weaknesses" className="space-y-2">
              {weaknesses.map((w, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-zinc-300">{w}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Evidence panel */}
        {activeEvidence && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Evidence</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-white"
                onClick={() => setActiveEvidence(null)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="h-3 w-3" />
                <span>Timestamp: {activeEvidence.timestamp}</span>
              </div>
              <p className="text-white text-sm leading-relaxed">{activeEvidence.text}</p>
            </div>
          </motion.div>
        )}

        {/* Panel disagreement */}
        {report.panelDisagreement && report.panelDisagreement.length > 0 && (
          <Card className="border-white/5 bg-white/[0.02] mb-8">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Panel Perspective
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                How each interviewer viewed your performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.panelDisagreement.map((p) => {
                const compKey = p.competency || "Technical";
                const color = COMPETENCY_COLORS[compKey] || "#3b82f6";
                const label = p.personaLabel || p.persona;
                return (
                  <div key={p.persona} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {label.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{label}</p>
                          <span
                            className="text-sm font-bold"
                            style={{ color }}
                          >
                            {p.score}/100
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{p.summary}</p>
                      </div>
                    </div>
                    {((p.strengths && p.strengths.length > 0) || (p.concerns && p.concerns.length > 0)) && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {p.strengths && p.strengths.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-emerald-400 font-medium">Strengths</p>
                            {p.strengths.map((s, i) => (
                              <p key={i} className="text-xs text-zinc-400 pl-2">✓ {s}</p>
                            ))}
                          </div>
                        )}
                        {p.concerns && p.concerns.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-amber-400 font-medium">Concerns</p>
                            {p.concerns.map((c, i) => (
                              <p key={i} className="text-xs text-zinc-400 pl-2">⚠ {c}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Disagreement badge */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-400 font-medium">Panel disagreement detected</span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  The panel showed divergent perspectives. The technical interviewer emphasized implementation depth while the product manager noted opportunities to connect technical decisions to business outcomes.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Improvement plan */}
        <Card className="border-white/5 bg-white/[0.02] mb-8">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Improvement Plan
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Actionable recommendations based on your performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(report.recommendations || []).map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold shrink-0"
                    style={{ zIndex: 1 }}
                  >
                    {i + 1}
                  </div>
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                    <p className="text-sm text-zinc-300">{r}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 print:hidden">
          <Button
            onClick={handleDownloadReport}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-all active:scale-[0.98]"
          >
            Download Report
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-white/10 text-zinc-400 hover:text-white font-medium shadow-md transition-all active:scale-[0.98]"
            onClick={() => router.push("/dashboard/candidate")}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
