import Link from "next/link";
import { ArrowRight, Mic, Users, BarChart2, Sparkles, Shield, Zap, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

// ── Animations ──

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const float = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
};

const gradientShift = {
  animate: {
    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
    transition: { duration: 8, repeat: Infinity, ease: "linear" },
  },
};

// ── Data ──

const FEATURES = [
  {
    icon: Users,
    title: "Multi-Agent Panel",
    description:
      "Four coordinated AI interviewers — Technical, Product, Hiring Manager, and Behavioral — share context, hand off turns, and challenge your answers from different perspectives.",
    color: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  {
    icon: Zap,
    title: "Adaptive Difficulty",
    description:
      "Every answer shapes the next question. Strong responses push you deeper; weak answers trigger scaffolding. Difficulty adjusts per competency, not globally.",
    color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  {
    icon: Sparkles,
    title: "Evidence-Backed Reports",
    description:
      "Every score links to a specific transcript moment. No black-box judgments — click any score to see the exact quote, timestamp, and which persona assessed it.",
    color: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  },
  {
    icon: Mic,
    title: "Real-Time Voice",
    description:
      "Speak naturally. Interrupt mid-sentence and the AI stops. Barge-in feels like a real conversation, not a form. Speech-based and keyword-based interruption supported.",
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  {
    icon: BarChart2,
    title: "Practice Roadmap",
    description:
      "Your competency ledger persists across sessions. Watch your Technical, Communication, and Product Thinking scores grow over time — not one-off attempts, a real skill map.",
    color: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  {
    icon: Shield,
    title: "Assessment Integrity",
    description:
      "For HR/placement teams: screen-share capture, tab-switch detection, periodic camera checks, and full session recording. All flags are descriptive — never auto-penalizing.",
    color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
];

const PERSONAS = [
  { name: "Alex", role: "Technical Interviewer", color: "#3b82f6", focus: "DSA, Architecture, System Design, Databases" },
  { name: "Maya", role: "Product Manager", color: "#8b5cf6", focus: "Customer Impact, Business Value, Prioritization" },
  { name: "Daniel", role: "Hiring Manager", color: "#f59e0b", focus: "Ownership, Leadership, Decision Making" },
  { name: "Sophia", role: "Behavioral Interviewer", color: "#10b981", focus: "Teamwork, Adaptability, Communication" },
  { name: "Jordan", role: "Customer (Role-play)", color: "#ec4899", focus: "Complaints, Incident Handling, Requirements" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f]">
      {/* ── Animated gradient background ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 20%, rgba(59,130,246,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139,92,246,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(16,185,129,0.04) 0%, transparent 50%)
          `,
        }}
      />

      {/* ── Grid overlay ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* ── Nav ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">EchoSphere</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/auth/candidate"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Candidate
          </Link>
          <Link
            href="/auth/organization"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Organization
          </Link>
          <Link
            href="/auth/candidate"
            className="flex h-9 min-w-[100px] items-center justify-center rounded-full bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-6 flex max-w-[280px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-400"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          Agora Hackathon 2026 — Coordinated AI Interview Panel
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-6 max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          Where Every Answer{" "}
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            Shapes the Next Question
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl"
        >
          AI-powered adaptive voice interviews with a coordinated panel that listens,
          adapts, challenges your answers, and gives evidence-backed feedback.
        </motion.p>

        {/* ── CTAs ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center"
        >
          <Link
            href="/auth/candidate"
            className="group flex h-14 w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-8 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:scale-[1.02]"
          >
            Are you a Candidate?
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/auth/organization"
            className="flex h-14 w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 text-base font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Are you an Organization?
          </Link>
        </motion.div>

        {/* ── Persona showcase ── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3"
        >
          {PERSONAS.map((p, i) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400"
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0]}
              </div>
              <span>
                <span className="text-white font-medium">{p.name}</span> — {p.role}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              One platform.{" "}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Two products.
              </span>
            </h2>
            <p className="mt-4 text-zinc-400">
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
                className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${feature.color} transition-transform group-hover:scale-110`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              How the interview works
            </h2>
            <p className="mt-3 text-zinc-400">
              Your answers drive everything that follows. No fixed script.
            </p>
          </motion.div>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            {[
              { label: "Your Answer", icon: Mic },
              { label: "AI Understanding", icon: Sparkles },
              { label: "Context Update", icon: Users },
              { label: "Competency Eval", icon: BarChart2 },
              { label: "Difficulty Adj", icon: Zap },
              { label: "Next Interviewer", icon: Users },
              { label: "Adaptive Follow-up", icon: Sparkles },
            ].map((step, i) => (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 text-blue-400">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-zinc-400">{step.label}</span>
                {i < 6 && (
                  <div className="my-1 h-0.5 w-6 animate-pulse bg-blue-500/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA section ── */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-white/5 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5 p-12"
          >
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to practice?
            </h2>
            <p className="mt-4 text-zinc-400">
              Start a free mock interview with a coordinated AI panel.
              No credit card. No commitment.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth/candidate"
                className="flex h-12 w-full max-w-[220px] items-center justify-center gap-2 rounded-full bg-white text-black font-semibold transition-colors hover:bg-zinc-100"
              >
                Start Practicing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/organization"
                className="flex h-12 w-full max-w-[220px] items-center justify-center rounded-full border border-white/10 px-8 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
              >
                For Organizations
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="flex flex-col items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="font-medium text-zinc-400">EchoSphere</span>
          </div>
          <p className="max-w-md text-center">
            EchoSphere uses AI interviewers to simulate realistic interview experiences.
            This is a practice tool, not a real job interview.
          </p>
          <p className="text-zinc-600">
            Built for Agora Hackathon 2026 — Team Ctrl Freaks
          </p>
        </div>
      </footer>
    </div>
  );
}
