"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PersonaKey } from "@/types";
import { PERSONAS } from "@/types";

interface RecommendationsProps {
  items: string[];
  className?: string;
}

export function Recommendations({ items, className }: RecommendationsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" />
        Improvement Plan
      </h3>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-3 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 p-3 shadow-sm"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * i }}
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-sm text-slate-700">{item}</span>
          </motion.div>
        ))}
      </ol>
    </div>
  );
}

// ---------- Difficulty progression viz ----------

interface DifficultyProgressionProps {
  steps: Array<{ level: string; reached: boolean; timestamp?: string }>;
  className?: string;
}

const levelColors: Record<string, string> = {
  beginner: "bg-emerald-400",
  easy: "bg-sky-400",
  medium: "bg-violet-400",
  hard: "bg-indigo-400",
  expert: "bg-rose-400",
};

export function DifficultyProgression({ steps, className }: DifficultyProgressionProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, i) => {
        const color = levelColors[step.level] ?? "bg-slate-300";
        const reached = step.reached;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <motion.div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-md",
                color,
                reached ? "" : "opacity-30 grayscale",
              )}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 * i }}
            >
              {reached && (step.timestamp ? step.timestamp.split(":")[0] : "✓")}
            </motion.div>
            <span className={cn("text-[10px] font-medium", reached ? "text-slate-700" : "text-slate-400")}>
              {step.level}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Interviewer contribution (persona) pie ----------

interface PersonaContributionProps {
  contributions: Array<{ persona: PersonaKey; score: number; weight?: number }>;
  className?: string;
}

export function PersonaContribution({ contributions, className }: PersonaContributionProps) {
  const total = contributions.reduce((a, c) => a + c.score, 0) || 1;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <h3 className="text-sm font-semibold text-slate-700">Interviewer Contribution</h3>
      <div className="grid grid-cols-2 gap-2">
        {contributions.map((c) => {
          const meta = PERSONAS[c.persona] ?? { name: c.persona, label: c.persona };
          const pct = (c.score / total) * 100;
          return (
            <div
              key={c.persona}
              className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white/60 p-2.5"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 truncate">{meta.label}</p>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500">{c.score.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Competency progression over turns ----------

interface CompetencyProgressionProps {
  series: Array<{ label: string; scores: number[] }>;
  className?: string;
}

export function CompetencyProgression({ series, className }: CompetencyProgressionProps) {
  if (!series.length) return null;
  const maxPoints = Math.max(...series.map((s) => s.scores.length), 1);
  const maxScore = 100;

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-semibold text-slate-700">Competency Progression</h3>
      <div className="relative h-32 w-full">
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ bottom: `${frac * 100}%` }}
          />
        ))}
        {/* lines */}
        {series.map((s) => {
          const pts: string[] = [];
          s.scores.forEach((v, idx) => {
            const x = (idx / Math.max(maxPoints - 1, 1)) * 100;
            const y = 100 - (v / maxScore) * 100;
            pts.push(`${x},${y}`);
          });
          const path = pts.length ? `M${pts.join(" L")}` : "";
          return (
            <svg
              key={s.label}
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="0.8"
                points={pts.join(" ")}
                opacity="0.6"
              />
              <circle
                r="0.8"
                fill="#6366f1"
                cx={0}
                cy={100 - (s.scores[0] / maxScore) * 100}
              />
            </svg>
          );
        })}
        {/* axis labels */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-between text-[8px] text-slate-400">
          {Array.from({ length: maxPoints }, (_, i) => (
            <span key={i} className="text-[8px]">
              Q{i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Overall score display (hero) ----------

interface OverallScoreDisplayProps {
  score: number;
  totalPossible?: number;
  weightBreakdown?: Array<{ label: string; weight: number; score?: number }>;
  className?: string;
}

export function OverallScoreDisplay({ score, totalPossible = 100, className }: OverallScoreDisplayProps) {
  const pct = Math.min(100, Math.max(0, (score / totalPossible) * 100));

  const tier = pct >= 85 ? { label: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" }
    : pct >= 70 ? { label: "Strong", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" }
    : pct >= 55 ? { label: "Developing", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" }
    : { label: "Needs Work", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" };

  return (
    <div className={cn("text-center", className)}>
      <div className="relative inline-flex items-center justify-center mb-2">
        {/* ring */}
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="6"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${pct * 3.52} 352`}
            initial={{ strokeDasharray: `0 352` }}
            animate={{ strokeDasharray: `${pct * 3.52} 352` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-800">{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>
      <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold", tier.bg, tier.color)}>
        {tier.label}
      </div>
    </div>
  );
}
