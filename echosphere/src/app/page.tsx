"use client";

import Link from "next/link";
import { ArrowRight, Mic, Users, BarChart2, Sparkles, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// ── Animations ──

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

// ── Data ──

const FEATURES = [
  {
    icon: Users,
    title: "Multi-Agent Panel",
    description:
      "Four coordinated AI interviewers — Technical, Product, Hiring Manager, and Behavioral — share context, hand off turns, and challenge your answers from different perspectives.",
    color: "border-blue-500/30 bg-blue-500/10 text-blue-500",
    glow: "group-hover:shadow-blue-500/10",
  },
  {
    icon: Zap,
    title: "Adaptive Difficulty",
    description:
      "Every answer shapes the next question. Strong responses push you deeper; weak answers trigger scaffolding. Difficulty adjusts per competency, not globally.",
    color: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    glow: "group-hover:shadow-amber-500/10",
  },
  {
    icon: Sparkles,
    title: "Evidence-Backed Reports",
    description:
      "Every score links to a specific transcript moment. No black-box judgments — click any score to see the exact quote, timestamp, and which persona assessed it.",
    color: "border-purple-500/30 bg-purple-500/10 text-purple-500",
    glow: "group-hover:shadow-purple-500/10",
  },
  {
    icon: Mic,
    title: "Real-Time Voice",
    description:
      "Speak naturally. Interrupt mid-sentence and the AI stops. Barge-in feels like a real conversation, not a form. Speech-based and keyword-based interruption supported.",
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    glow: "group-hover:shadow-emerald-500/10",
  },
  {
    icon: BarChart2,
    title: "Practice Roadmap",
    description:
      "Your competency ledger persists across sessions. Watch your Technical, Communication, and Product Thinking scores grow over time — not one-off attempts, a real skill map.",
    color: "border-rose-500/30 bg-rose-500/10 text-rose-500",
    glow: "group-hover:shadow-rose-500/10",
  },
  {
    icon: Shield,
    title: "Assessment Integrity",
    description:
      "For HR/placement teams: screen-share capture, tab-switch detection, periodic camera checks, and full session recording. All flags are descriptive — never auto-penalizing.",
    color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
    glow: "group-hover:shadow-cyan-500/10",
  },
];

const PERSONAS = [
  { name: "Alex", role: "Technical Interviewer", color: "#3b82f6" },
  { name: "Maya", role: "Product Manager", color: "#8b5cf6" },
  { name: "Daniel", role: "Hiring Manager", color: "#f59e0b" },
  { name: "Sophia", role: "Behavioral Interviewer", color: "#10b981" },
  { name: "Jordan", role: "Customer (Role-play)", color: "#ec4899" },
];

const STEPS = [
  { label: "Your Answer", icon: Mic },
  { label: "AI Understanding", icon: Sparkles },
  { label: "Context Update", icon: Users },
  { label: "Competency Eval", icon: BarChart2 },
  { label: "Difficulty Adj", icon: Zap },
  { label: "Next Interviewer", icon: Users },
  { label: "Adaptive Follow-up", icon: Sparkles },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">

      {/* ── Animated gradient orbs ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Light mode orbs: soft lavender/blue */}
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-blue-400/10 dark:bg-blue-600/8 blur-[120px] transition-colors duration-700" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-purple-400/10 dark:bg-purple-600/6 blur-[100px] transition-colors duration-700" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-emerald-400/8 dark:bg-emerald-600/5 blur-[80px] transition-colors duration-700" />
      </div>

      {/* ── Subtle grid ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-5"
        style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px),
                            linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          opacity: 0.4,
        }}
      />

      {/* ══════════════════════════════════════════ NAV ══ */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 border-b border-border backdrop-blur-md bg-background/80 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">EchoSphere</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/auth/candidate"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Candidate
          </Link>
          <Link
            href="/auth/organization"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Organization
          </Link>
          <ThemeToggle />
          <Link
            href="/auth/candidate"
            className="flex h-9 min-w-[100px] items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/15 border border-border px-5 text-sm font-medium text-foreground transition-all duration-200 hover:scale-[1.02]"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════ HERO ══ */}
      <section className="relative z-10 flex flex-col items-center px-6 pt-20 pb-32 text-center">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-6 flex max-w-[300px] items-center justify-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-300"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          Agora Hackathon 2026 — Coordinated AI Interview Panel
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-6 max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl transition-colors duration-300"
        >
          Where Every Answer{" "}
          <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 bg-clip-text text-transparent">
            Shapes the Next Question
          </span>
        </motion.h1>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl transition-colors duration-300"
        >
          AI-powered adaptive voice interviews with a coordinated panel that listens,
          adapts, challenges your answers, and gives evidence-backed feedback.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center"
        >
          <Link
            href="/auth/candidate"
            className="group flex h-14 w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-8 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.03]"
          >
            Are you a Candidate?
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/auth/organization"
            className="flex h-14 w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-border bg-muted/60 px-8 text-base font-medium text-foreground transition-all hover:bg-muted hover:border-foreground/20 hover:scale-[1.02]"
          >
            Are you an Organization?
          </Link>
        </motion.div>

        {/* Persona showcase */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3"
        >
          {PERSONAS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-all duration-200 hover:border-foreground/20 hover:bg-muted"
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0]}
              </div>
              <span>
                <span className="text-foreground font-medium">{p.name}</span> — {p.role}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════ FEATURES ══ */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl transition-colors duration-300">
              One platform.{" "}
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                Two products.
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground transition-colors duration-300">
              Practice realistic interviews as a candidate. Run proctored hiring loops as an organization.
              Same adaptive engine, different mode.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08 }}
                className={`group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-foreground/10 ${feature.glow}`}
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg border ${feature.color} transition-transform group-hover:scale-110`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground transition-colors duration-300">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground transition-colors duration-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ HOW IT WORKS ══ */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl transition-colors duration-300">
              How the interview works
            </h2>
            <p className="mt-3 text-muted-foreground transition-colors duration-300">
              Your answers drive everything that follows. No fixed script.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm transition-colors duration-300"
          >
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-500 transition-all duration-200 hover:bg-blue-500/20 hover:scale-110">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground text-center max-w-[80px]">{step.label}</span>
                {i < STEPS.length - 1 && (
                  <div className="my-1 h-0.5 w-6 animate-pulse bg-gradient-to-r from-blue-500/40 to-purple-500/40 rounded-full" />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ CTA SECTION ══ */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl border border-border bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5 p-12 overflow-hidden transition-colors duration-300"
          >
            {/* Decorative glow behind the card */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/8 via-purple-500/5 to-transparent dark:from-blue-500/5 dark:via-purple-500/3 transition-colors duration-700" />

            <h2 className="relative text-3xl font-bold text-foreground sm:text-4xl transition-colors duration-300">
              Ready to practice?
            </h2>
            <p className="relative mt-4 text-muted-foreground transition-colors duration-300">
              Start a free mock interview with a coordinated AI panel.
              No credit card. No commitment.
            </p>
            <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth/candidate"
                className="flex h-12 w-full max-w-[220px] items-center justify-center gap-2 rounded-full bg-foreground text-background font-semibold transition-all hover:opacity-90 hover:scale-[1.03] hover:shadow-lg"
              >
                Start Practicing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/organization"
                className="flex h-12 w-full max-w-[220px] items-center justify-center rounded-full border border-border bg-muted/40 px-8 text-sm font-medium text-foreground transition-all hover:bg-muted hover:scale-[1.02]"
              >
                For Organizations
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ FOOTER ══ */}
      <footer className="relative z-10 border-t border-border px-6 py-8 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="font-medium text-foreground">EchoSphere</span>
          </div>
          <p className="max-w-md text-center">
            EchoSphere uses AI interviewers to simulate realistic interview experiences.
            This is a practice tool, not a real job interview.
          </p>
          <p className="text-muted-foreground/60">
            Built for Agora Hackathon 2026 — Team Ctrl Freaks
          </p>
        </div>
      </footer>
    </div>
  );
}
