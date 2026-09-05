"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  accent?: "violet" | "emerald" | "amber" | "rose" | "sky";
  className?: string;
}

const accentMap = {
  violet: {
    bg: "bg-violet-50/60 border-violet-200/50",
    text: "text-violet-700",
    accent: "bg-violet-500/10 text-violet-600",
    ring: "ring-violet-500/10",
  },
  emerald: {
    bg: "bg-emerald-50/60 border-emerald-200/50",
    text: "text-emerald-700",
    accent: "bg-emerald-500/10 text-emerald-600",
    ring: "ring-emerald-500/10",
  },
  amber: {
    bg: "bg-amber-50/60 border-amber-200/50",
    text: "text-amber-700",
    accent: "bg-amber-500/10 text-amber-600",
    ring: "ring-amber-500/10",
  },
  rose: {
    bg: "bg-rose-50/60 border-rose-200/50",
    text: "text-rose-700",
    accent: "bg-rose-500/10 text-rose-600",
    ring: "ring-rose-500/10",
  },
  sky: {
    bg: "bg-sky-50/60 border-sky-200/50",
    text: "text-sky-700",
    accent: "bg-sky-500/10 text-sky-600",
    ring: "ring-sky-500/10",
  },
};

export function StatCard({
  label,
  value,
  subtext,
  change,
  changeLabel,
  icon,
  accent = "violet",
  className,
}: StatCardProps) {
  const colors = accentMap[accent];
  const changeType = change === undefined ? null : change > 0 ? "up" : change < 0 ? "down" : "flat";

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md",
        colors.bg,
        className,
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* decorative accent */}
      <div className={cn("absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-30", colors.accent)} />

      <div className="flex items-start justify-between relative">
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium uppercase tracking-wider mb-1", colors.text)}>
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
          {subtext && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{subtext}</p>
          )}
        </div>
        {icon && (
          <div className={cn("p-2 rounded-lg", colors.accent)}>
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && changeType && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          {changeType === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
          {changeType === "down" && <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
          {changeType === "flat" && <Minus className="w-3.5 h-3.5 text-slate-400" />}
          <span className={cn(
            "font-medium",
            changeType === "up" ? "text-emerald-600" : changeType === "down" ? "text-rose-600" : "text-slate-500",
          )}>
            {change > 0 ? "+" : ""}{change}%
          </span>
          {changeLabel && <span className="text-slate-400 ml-1">{changeLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}

// ---------- Interview card ----------

interface InterviewCardProps {
  title: string;
  subtitle?: string;
  company?: string;
  role?: string;
  date?: string;
  status: "scheduled" | "completed" | "in_progress" | "abandoned";
  score?: number | null;
  duration?: string;
  onAction?: () => void;
  actionLabel?: string;
  selected?: boolean;
  className?: string;
}

const statusConfig = {
  scheduled: { label: "Scheduled", color: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  in_progress: { label: "In Progress", color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500 animate-pulse" },
  abandoned: { label: "Abandoned", color: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export function InterviewCard({
  title,
  subtitle,
  company,
  role,
  date,
  status,
  score,
  duration,
  onAction,
  actionLabel,
  selected,
  className,
}: InterviewCardProps) {
  const cfg = statusConfig[status] ?? statusConfig.scheduled;

  return (
    <motion.div
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all cursor-pointer",
        selected
          ? "border-violet-300 ring-2 ring-violet-200/50 shadow-md shadow-violet-100"
          : "border-slate-200/70 hover:border-slate-300 hover:shadow-sm",
        className,
      )}
      whileHover={selected ? {} : { scale: 1.005 }}
      onClick={onAction}
    >
      {/* color bar */}
      <div className={cn("h-1 w-full", {
        "bg-sky-400": status === "scheduled",
        "bg-emerald-400": status === "completed",
        "bg-violet-400": status === "in_progress",
        "bg-rose-400": status === "abandoned",
      })} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
              {company && <span>{company}</span>}
              {role && <span>· {role}</span>}
              {date && <span>· {date}</span>}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
              cfg.color,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            {cfg.label}
          </span>
        </div>

        {/* score strip */}
        {status === "completed" && score !== undefined && score !== null && (
          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Overall Score</span>
                <span className="font-semibold text-slate-700">{score}/100</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
            {duration && (
              <span className="text-xs text-slate-400 whitespace-nowrap">{duration}</span>
            )}
          </div>
        )}

        {onAction && actionLabel && (
          <div className="mt-3 flex justify-end">
            <span className="text-xs text-violet-600 font-medium hover:text-violet-700 transition-colors">
              {actionLabel}
              <svg className="inline ml-1 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------- Profile section (mini) ----------

interface ProfileSectionProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  href?: string;
  className?: string;
}

export function ProfileSection({ label, value, icon, href, className }: ProfileSectionProps) {
  return (
    <a
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200/60 bg-white/60 p-3 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm group",
        className,
      )}
    >
      {icon && (
        <div className="flex-shrink-0 p-2 rounded-lg bg-slate-50 text-slate-500 group-hover:text-violet-600 group-hover:bg-violet-50 transition-colors">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-700 truncate">{value || "Not set"}</p>
      </div>
      {href && (
        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </a>
  );
}

// ---------- Skills section (tags) ----------

interface SkillsSectionProps {
  skills: Array<{ name: string; category: string }>;
  category?: string;
  className?: string;
}

const categoryColors: Record<string, string> = {
  programming: "bg-sky-100 text-sky-700 border-sky-200",
  framework: "bg-violet-100 text-violet-700 border-violet-200",
  database: "bg-amber-100 text-amber-700 border-amber-200",
  cloud: "bg-emerald-100 text-emerald-700 border-emerald-200",
  tool: "bg-rose-100 text-rose-700 border-rose-200",
  other: "bg-slate-100 text-slate-600 border-slate-200",
};

export function SkillsSection({ skills, category, className }: SkillsSectionProps) {
  const grouped = skills.reduce<Record<string, typeof skills>>((acc, s) => {
    const cat = s.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className={cn("space-y-4", className)}>
      {category && (
        <p className="text-sm font-medium text-slate-700">{category}</p>
      )}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="flex flex-wrap gap-1.5">
          {items.map((s) => (
            <span
              key={s.name}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                categoryColors[cat] ?? categoryColors.other,
              )}
            >
              {s.name}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Roadmap progress ----------

interface RoadmapProgressProps {
  competencies: Array<{ name: string; progress: number; color?: string }>;
  className?: string;
}

export function RoadmapProgress({ competencies, className }: RoadmapProgressProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {competencies.map((comp) => {
        const pct = Math.min(100, Math.max(0, comp.progress));
        const barColor = comp.color ?? "from-violet-500 to-indigo-500";
        return (
          <div key={comp.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">{comp.name}</span>
              <span className="text-xs font-mono text-slate-500">{Math.round(pct)}%</span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r",
                  barColor,
                )}
                style={{ width: `${pct}%` }}
              />
              {/* shine */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
