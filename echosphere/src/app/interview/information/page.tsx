"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clock,
  ChevronRight,
  Video,
  Mic,
  Shield,
  BarChart3,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Users,
  Headphones,
  MessageSquare,
  Target,
  Eye,
  Brain,
  AlertTriangle,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PERSONAS, type PersonaKey } from "@/types";

const FLOW_STEPS = [
  {
    icon: MessageSquare,
    label: "Answer",
    desc: "You respond to the interviewer's question",
    color: "text-blue-500 bg-blue-50 border-blue-200",
  },
  {
    icon: Brain,
    label: "Understanding",
    desc: "AI analyzes your answer in real time",
    color: "text-violet-500 bg-violet-50 border-violet-200",
  },
  {
    icon: Target,
    label: "Context",
    desc: "Relevant context and follow-ups are prepared",
    color: "text-emerald-500 bg-emerald-50 border-emerald-200",
  },
  {
    icon: BarChart3,
    label: "Evaluation",
    desc: "Your answer is scored against competencies",
    color: "text-amber-500 bg-amber-50 border-amber-200",
  },
  {
    icon: Shield,
    label: "Difficulty",
    desc: "Next question adjusts to your level",
    color: "text-orange-500 bg-orange-50 border-orange-200",
  },
  {
    icon: Users,
    label: "Next Interviewer",
    desc: "A new persona takes over the conversation",
    color: "text-pink-500 bg-pink-50 border-pink-200",
  },
  {
    icon: Headphones,
    label: "Follow-up",
    desc: "Deeper questions probe your thinking",
    color: "text-cyan-500 bg-cyan-50 border-cyan-200",
  },
];

const AVOID_ITEMS = [
  {
    icon: XCircle,
    title: "Reading from a script",
    desc: "Reading answers verbatim is easily detected and reduces your score.",
  },
  {
    icon: XCircle,
    title: "Looking off-screen constantly",
    desc: "Frequent gaze shifts away from the camera may indicate reading or distraction.",
  },
  {
    icon: XCircle,
    title: "Using a second device",
    desc: "Switching to another screen or device during the interview is against the rules.",
  },
  {
    icon: XCircle,
    title: "Having someone assist you",
    desc: "Another person speaking or feeding you answers invalidates the interview.",
  },
  {
    icon: XCircle,
    title: "Background noise & distractions",
    desc: "A noisy or distracting environment affects audio quality and your focus.",
  },
  {
    icon: XCircle,
    title: "Muting for long periods",
    desc: "Extended silence or muting during a question is treated as no response.",
  },
];

export default function InformationPage() {
  const router = useRouter();
  const [termsChecked, setTermsChecked] = useState(false);
  const [disclosureChecked, setDisclosureChecked] = useState(false);

  const canContinue = termsChecked && disclosureChecked;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Top nav */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="text-lg font-semibold text-slate-800 tracking-tight">EchoSphere</span>
          </div>
          <div className="text-sm text-slate-400">Interview Info</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
            <Clock className="w-3.5 h-3.5" />
            Approximately 20 minutes
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            Welcome to your<br />
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              AI Interview
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
            You will be interviewed by multiple AI interviewers, each with their own persona and focus.
            The questions adapt to your answers in real time.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-8">
            {/* How the interview works */}
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">How the Interview Works</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Every question goes through seven stages. The interview flows naturally — you just answer, and the AI handles the rest.
              </p>

              {/* Flow diagram */}
              <div className="flex items-center gap-0 overflow-x-auto pb-2 -mx-2 px-2">
                {FLOW_STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${step.color} transition-all hover:scale-110 cursor-default`}>
                        <step.icon className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700 text-center whitespace-nowrap">
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-400 text-center hidden lg:block leading-tight max-w-[80px]">
                        {step.desc}
                      </span>
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <div className="mx-1.5 mt-[-1.25rem] w-6 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Mobile descriptions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5 lg:hidden">
                {FLOW_STEPS.map((step) => (
                  <div
                    key={step.label}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border ${step.color.split(" ")[2]}/30`}
                  >
                    <step.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${step.color.split(" ")[1]}`} />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{step.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Rules */}
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Shield className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Interview Rules</h2>
              </div>
              <div className="space-y-3">
                {[
                  "Complete the interview in one sitting — you cannot pause and resume.",
                  "Camera and microphone must be on and working throughout the session.",
                  "You will be interviewed by AI interviewers, each with a distinct persona.",
                  "Question difficulty adapts in real time based on your answers.",
                  "You can interrupt the AI at any time to clarify or redirect the conversation.",
                  "Your responses are analyzed for competency, communication, and behavioral signals.",
                ].map((rule, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* The 4 personas */}
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Your Interview Panel</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                You will meet up to four different AI interviewers. Each brings a unique perspective to evaluate your fit.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "technical" as PersonaKey,
                      title: "Technical Interviewer",
                      desc: "Alex evaluates your coding, system design, and problem-solving ability. Expect algorithmic questions, architecture discussions, and live debugging.",
                      color: "border-l-blue-500",
                      bg: "bg-blue-50/40",
                    },
                    {
                      key: "product" as PersonaKey,
                      title: "Product Manager",
                      desc: "Maya probes your product sense, prioritization, and user empathy. She'll ask about trade-offs, feature scoping, and how you think about users.",
                      color: "border-l-purple-500",
                      bg: "bg-purple-50/40",
                    },
                    {
                      key: "hiring_manager" as PersonaKey,
                      title: "Hiring Manager",
                      desc: "Daniel assesses leadership, ownership, and team fit. He cares about how you handle ambiguity, drive results, and work with others.",
                      color: "border-l-amber-500",
                      bg: "bg-amber-50/40",
                    },
                    {
                      key: "behavioral" as PersonaKey,
                      title: "Behavioral Interviewer",
                      desc: "Sophia explores your past experiences, communication style, and growth mindset through behavioral questions and situational prompts.",
                      color: "border-l-emerald-500",
                      bg: "bg-emerald-50/40",
                    },
                  ]
                ).map((p) => (
                  <div
                    key={p.key}
                    className={`rounded-xl border-l-4 ${p.color} ${p.bg} p-4 transition-all hover:shadow-md`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          p.key === "technical"
                            ? "bg-blue-500"
                            : p.key === "product"
                            ? "bg-purple-500"
                            : p.key === "hiring_manager"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      >
                        {p.key === "technical" ? "A" : p.key === "product" ? "M" : p.key === "hiring_manager" ? "D" : "S"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.title}</p>
                        <p className="text-[11px] text-slate-400">{PERSONAS[p.key].name}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick facts card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Quick Facts</h3>
              <div className="space-y-3">
                {[
                  { icon: Clock, label: "Duration", value: "~20 minutes" },
                  { icon: Video, label: "Camera", value: "Required" },
                  { icon: Mic, label: "Microphone", value: "Required" },
                  { icon: Brain, label: "Interviewers", value: "Up to 4 AI personas" },
                  { icon: Monitor, label: "Questions", value: "Dynamic & adaptive" },
                  { icon: Target, label: "Format", value: "Live conversational" },
                ].map((fact) => (
                  <div key={fact.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <fact.icon className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{fact.label}</p>
                      <p className="text-sm font-medium text-white">{fact.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What to avoid */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">What to Avoid</h2>
              </div>
              <div className="space-y-3">
                {AVOID_ITEMS.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* T&C + disclosure */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Before You Begin</h2>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <Checkbox
                    checked={termsChecked}
                    onCheckedChange={(c) => setTermsChecked(c as boolean)}
                    className="mt-0.5 flex-shrink-0 ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                      I agree to the Terms & Conditions
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      By proceeding, you agree to EchoSphere's terms of service, privacy policy, and the interview rules outlined above.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <Checkbox
                    checked={disclosureChecked}
                    onCheckedChange={(c) => setDisclosureChecked(c as boolean)}
                    className="mt-0.5 flex-shrink-0 ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                      I understand this is an AI-powered interview
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      I acknowledge that my interview will be conducted by AI interviewers, recorded for analysis, and evaluated using automated scoring. I consent to this process.
                    </p>
                  </div>
                </label>
              </div>

              <Button
                size="lg"
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-200/40 h-12 text-base"
                onClick={() => router.push("/interview/lobby")}
                disabled={!canContinue}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              {!canContinue && (
                <p className="text-center text-xs text-slate-400 mt-3">
                  Please accept both checkboxes to continue.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
