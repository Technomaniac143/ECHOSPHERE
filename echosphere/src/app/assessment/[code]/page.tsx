"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Code2,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  Building2,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import type { Assessment } from "@/types";
import { PERSONAS, DIFFICULTY_LEVELS } from "@/types";

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700 border-emerald-200",
  easy: "bg-sky-100 text-sky-700 border-sky-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-orange-100 text-orange-700 border-orange-200",
  expert: "bg-rose-100 text-rose-700 border-rose-200",
};

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hr`;
}

export default function AssessmentJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  async function loadAssessment() {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      // Try to fetch assessment by join code
      const res = await api.get<{ data: Assessment }>(`/api/organizations/assessments/code/${code}`);
      setAssessment(res.data);
    } catch (err: unknown) {
      const is404 = err && typeof err === "object" && "status" in err && (err as { status?: number }).status === 404;
      if (is404) {
        setError("Assessment not found. Please check the invite code.");
      } else {
        setError("Failed to load assessment. Please try again.");
      }
      setAssessment(null);
    } finally {
      setLoading(false);
    }
  }

  async function joinAssessment() {
    if (!assessment) return;
    setJoining(true);
    setError(null);
    try {
      // Join via the sessions API — creates a session for this candidate
      const res = await api.post<{ data: { id: string; joinCode?: string } }>("/api/sessions", {
        mode: "assessment",
        assessmentCode: code ?? "",
      });
      setJoined(true);
      // Redirect to lobby after short delay
      setTimeout(() => {
        router.push(`/interview/${res.data.id}/lobby`);
      }, 1200);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to join assessment. Please try again.";
      setError(msg);
    } finally {
      setJoining(false);
    }
  }

  // Load params
  useEffect(() => {
    params.then((p) => {
      setCode(p.code);
    });
  }, [params]);

  useEffect(() => {
    if (code) loadAssessment();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <div className="h-4 w-32 bg-slate-200 rounded mb-2 animate-pulse" />
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-rose-100">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                <Code2 className="w-7 h-7 text-rose-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-2">Invite Code Invalid</h1>
              <p className="text-sm text-slate-500 mb-4">{error}</p>
              <Button onClick={() => router.push("/dashboard")} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined && assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="border-emerald-100/50 bg-emerald-50/30">
            <CardContent className="pt-8 pb-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </motion.div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">You're All Set</h2>
              <p className="text-sm text-slate-500 mb-2">
                Redirecting you to the interview lobby for{" "}
                <span className="font-semibold text-slate-700">{assessment.name}</span>
              </p>
              <div className="h-1 w-3/4 mx-auto bg-emerald-200 rounded-full mt-3 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-4 font-mono">
                Redirecting in a moment…
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!assessment) {
    return null;
  }

  const personaList = Object.entries(PERSONAS)
    .filter(([key]) => (assessment.personas as string[]).includes(key))
    .map(([, meta]) => meta);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">E</span>
          </div>
          <span className="text-sm font-semibold text-slate-700">EchoSphere</span>
          <span className="text-xs text-slate-300">/</span>
          <span className="text-sm text-slate-500">Join Assessment</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Join code display */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <Code2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-mono text-slate-500">Invite Code</span>
          </div>
          <span className="text-sm font-mono text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            {code}
          </span>
        </div>

        {/* Assessment info card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400" />
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200 flex-shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <Badge
                    className={`text-xs mb-2 border ${DIFFICULTY_COLORS[assessment.difficulty] ?? "bg-slate-100"}`}
                  >
                    {assessment.difficulty}
                  </Badge>
                  <CardTitle className="text-lg text-slate-800 mt-1">
                    {assessment.name}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      {assessment.role}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {assessment.domain}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDuration(assessment.durationMinutes)}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Persona panel */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                  Interview Panel
                </p>
                <div className="flex flex-wrap gap-2">
                  {personaList.map((p) => (
                    <div
                      key={p.key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white/60 px-3 py-2"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm text-slate-700">{p.label}</span>
                      <span className="text-xs text-slate-400">({p.name})</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-slate-800 font-semibold text-sm mb-0.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {assessment.personas.length}
                  </div>
                  <p className="text-[11px] text-slate-400">Interviewers</p>
                </div>
                <div>
                  <div className="flex items-center justify-center text-slate-800 font-semibold text-sm mb-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {formatDuration(assessment.durationMinutes)}
                  </div>
                  <p className="text-[11px] text-slate-400">Duration</p>
                </div>
                <div>
                  <div className="flex items-center justify-center text-slate-800 font-semibold text-sm mb-0.5">
                    <Code2 className="w-3.5 h-3.5 text-slate-400" />
                    {code}
                  </div>
                  <p className="text-[11px] text-slate-400">Invite Code</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* What to expect */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-sm font-semibold text-slate-700 mb-3">What to expect</h2>
          <div className="space-y-2 text-sm text-slate-500">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <span>You'll enter a lobby where the interview panel is waiting</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <span>The panel of AI interviewers will conduct a structured interview</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <span>After the interview, you'll receive a detailed report with scores and feedback</span>
            </div>
          </div>
        </motion.div>

        {/* Error display */}
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">
            <Code2 className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Join button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center gap-3"
        >
          <Button
            size="lg"
            className="w-full max-w-xs shadow-lg shadow-violet-200/50 hover:shadow-xl hover:shadow-violet-200/60"
            onClick={joinAssessment}
            disabled={joining}
          >
            {joining ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Joining…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Enter Interview Lobby
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
          <p className="text-xs text-slate-400 text-center">
            This will start the interview session. Make sure you're in a quiet place.
          </p>
        </motion.div>

        {/* Troubleshooting */}
        <div className="mt-12 text-center">
          <p className="text-xs text-slate-400">
            Having trouble?{" "}
            <a
              href="#"
              className="text-violet-600 hover:text-violet-700 underline underline-offset-2"
              onClick={(e) => e.preventDefault()}
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
