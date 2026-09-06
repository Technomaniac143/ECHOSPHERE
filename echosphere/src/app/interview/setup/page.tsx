"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setupApi, sessionApi } from "@/lib/api/client";
import {
  POPULAR_COMPANIES,
  POPULAR_ROLES,
  POPULAR_DOMAINS,
  DIFFICULTY_LEVELS,
  type InterviewSetup,
  type PersonaKey,
  type DifficultyLevel,
} from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Edit3,
  MapPin,
  Briefcase,
  Building2,
  Brain,
  Clock,
  Target,
  Loader2,
  Star,
  Award,
  BarChart3,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Company Logo Representations ─────────────────────────────────────────────
const COMPANY_LOGOS: Record<string, React.ReactNode> = {
  Google: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  ),
  Microsoft: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#F25022" d="M1 1h10v10H1z"/>
      <path fill="#7FBA00" d="M13 1h10v10H13z"/>
      <path fill="#00A4EF" d="M1 13h10v10H1z"/>
      <path fill="#FFB900" d="M13 13h10v10H13z"/>
    </svg>
  ),
  Amazon: (
    <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center font-black text-xs">
      a
    </div>
  ),
  Meta: (
    <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
      ∞
    </div>
  ),
  Apple: (
    <div className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
      
    </div>
  ),
  Netflix: (
    <div className="w-5 h-5 rounded-md bg-red-600 text-white flex items-center justify-center font-bold text-xs">
      N
    </div>
  ),
  Uber: (
    <div className="w-5 h-5 rounded-md bg-black text-white flex items-center justify-center font-bold text-[10px]">
      UBER
    </div>
  ),
  Stripe: (
    <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
      S
    </div>
  ),
  Airbnb: (
    <div className="w-5 h-5 rounded-md bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
      A
    </div>
  ),
  Shopify: (
    <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
      S
    </div>
  ),
  Salesforce: (
    <div className="w-5 h-5 rounded-md bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
      sf
    </div>
  ),
};

function getCompanyIcon(name: string) {
  if (COMPANY_LOGOS[name]) return COMPANY_LOGOS[name];
  return (
    <div className="w-5 h-5 rounded-md bg-violet-600 text-white flex items-center justify-center font-bold text-xs">
      {name ? name.slice(0, 2).toUpperCase() : "CO"}
    </div>
  );
}

// ── Course Weightage Matrix ───────────────────────────────────────────────────
interface CourseWeightage {
  technical: number;
  systemDesign: number;
  problemSolving: number;
  behavioral: number;
  communication: number;
  focusAreas: string[];
  suggestedPersonas: PersonaKey[];
}

const DOMAIN_WEIGHTAGES: Record<string, CourseWeightage> = {
  "Web Development": {
    technical: 35,
    systemDesign: 25,
    problemSolving: 20,
    behavioral: 10,
    communication: 10,
    focusAreas: ["Frontend Performance", "React Architecture", "REST/GraphQL APIs", "State Management"],
    suggestedPersonas: ["technical", "domain", "behavioral"],
  },
  "Mobile Development": {
    technical: 35,
    systemDesign: 20,
    problemSolving: 25,
    behavioral: 10,
    communication: 10,
    focusAreas: ["iOS/Android Lifecycle", "Offline Synchronization", "Mobile Security", "UI Rendering"],
    suggestedPersonas: ["technical", "domain"],
  },
  "Data Engineering": {
    technical: 35,
    systemDesign: 30,
    problemSolving: 20,
    behavioral: 10,
    communication: 5,
    focusAreas: ["Spark/Kafka Streaming", "Data Warehousing", "ETL Pipelines", "Data Quality & Schema Design"],
    suggestedPersonas: ["technical", "domain", "hiring_manager"],
  },
  "Machine Learning / AI": {
    technical: 40,
    systemDesign: 25,
    problemSolving: 20,
    behavioral: 10,
    communication: 5,
    focusAreas: ["Model Inference & Fine-tuning", "LLM Evaluation", "Feature Engineering", "Scalable Serving"],
    suggestedPersonas: ["technical", "domain"],
  },
  "DevOps / Infrastructure": {
    technical: 30,
    systemDesign: 40,
    problemSolving: 15,
    behavioral: 10,
    communication: 5,
    focusAreas: ["Kubernetes & Docker", "Terraform / IaC", "CI/CD Pipelines", "Observability & SRE"],
    suggestedPersonas: ["technical", "hiring_manager"],
  },
  "Product Management": {
    technical: 15,
    systemDesign: 20,
    problemSolving: 25,
    behavioral: 20,
    communication: 20,
    focusAreas: ["Product Roadmap & Metrics", "Feature Prioritization", "User Empathy", "Stakeholder Management"],
    suggestedPersonas: ["product", "behavioral", "hiring_manager"],
  },
  "Systems Design": {
    technical: 25,
    systemDesign: 45,
    problemSolving: 15,
    behavioral: 10,
    communication: 5,
    focusAreas: ["Scalability & Caching", "Microservices Architecture", "Database Partitioning", "Fault Tolerance"],
    suggestedPersonas: ["technical", "leadership"],
  },
  "Security": {
    technical: 40,
    systemDesign: 30,
    problemSolving: 15,
    behavioral: 10,
    communication: 5,
    focusAreas: ["Application Security", "Threat Modeling", "Authentication & OAuth", "Vulnerability Analysis"],
    suggestedPersonas: ["technical", "domain"],
  },
};

const DEFAULT_WEIGHTAGE: CourseWeightage = {
  technical: 30,
  systemDesign: 25,
  problemSolving: 20,
  behavioral: 15,
  communication: 10,
  focusAreas: ["Core Algorithms", "System Architecture", "Code Quality", "Problem Solving"],
  suggestedPersonas: ["technical", "behavioral"],
};

const STEP_LABELS = ["Company", "Role", "Domain", "AI Proposal", "Confirm"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4;

interface SetupState {
  company: string;
  customCompany: string;
  role: string;
  customRole: string;
  domain: string;
  customDomain: string;
  suggestedPersonas: PersonaKey[];
  difficulty: DifficultyLevel;
  estimatedDuration: number;
  focusAreas: string[];
  mode: "assessment"; // Unified Mock Interview Mode
}

const EMPTY_SETUP: SetupState = {
  company: "",
  customCompany: "",
  role: "",
  customRole: "",
  domain: "",
  customDomain: "",
  suggestedPersonas: [],
  difficulty: "Medium",
  estimatedDuration: 20,
  focusAreas: [],
  mode: "assessment",
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<SetupState>(EMPTY_SETUP);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [weightage, setWeightage] = useState<CourseWeightage>(DEFAULT_WEIGHTAGE);

  useEffect(() => {
    if (step === 3) {
      setParsing(true);
      const chosenDomain = state.domain && state.domain !== "Other" ? state.domain : state.customDomain;
      const derived = DOMAIN_WEIGHTAGES[chosenDomain] ?? DEFAULT_WEIGHTAGE;
      setWeightage(derived);

      setState((prev) => ({
        ...prev,
        suggestedPersonas: derived.suggestedPersonas,
        focusAreas: derived.focusAreas,
        estimatedDuration: 25,
      }));
      setParsing(false);
    }
  }, [step, state.domain, state.customDomain]);

  const next = () => {
    if (step < 4) setStep((s) => (s + 1) as StepIndex);
  };

  const prev = () => {
    if (step > 0) setStep((s) => (s - 1) as StepIndex);
  };

  const updateField = <K extends keyof SetupState>(key: K, value: SetupState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompanySelect = (value: string) => {
    updateField("company", value);
    if (value !== "Other") updateField("customCompany", "");
  };

  const handleRoleSelect = (value: string) => {
    updateField("role", value);
    if (value !== "Other") updateField("customRole", "");
  };

  const handleDomainSelect = (value: string) => {
    updateField("domain", value);
    if (value !== "Other") updateField("customDomain", "");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const companyVal =
        state.company && state.company !== "Other"
          ? state.company
          : state.customCompany || "Target Company";
      const roleVal =
        state.role && state.role !== "Other" ? state.role : state.customRole || "Software Engineer";
      const domainVal =
        state.domain && state.domain !== "Other"
          ? state.domain
          : state.customDomain || "Web Development";

      const session = await sessionApi.create({
        mode: "assessment",
        company: companyVal,
        role: roleVal,
        domain: domainVal,
        personas: state.suggestedPersonas.length > 0 ? state.suggestedPersonas : undefined,
        difficulty: state.difficulty,
        targetRole: roleVal,
        targetCompany: companyVal,
      });

      const sessionObj = (session as any)?.data || session;
      const targetSessionId = sessionObj?.id || sessionObj?.session_id;

      toast.success("Interview session created");
      // Route directly into Candidate Personal Information Portal
      if (targetSessionId) {
        router.push(`/interview/information?sessionId=${targetSessionId}`);
      } else {
        router.push(`/interview/information`);
      }
    } catch (err) {
      console.error("Session creation error:", err);
      toast.error("Failed to create interview session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const personaColor: Record<PersonaKey, string> = {
    technical: "bg-blue-600",
    product: "bg-purple-600",
    hiring_manager: "bg-amber-600",
    behavioral: "bg-emerald-600",
    customer: "bg-pink-600",
    domain: "bg-teal-600",
    leadership: "bg-indigo-600",
    culture: "bg-rose-600",
  };

  const personaLabel: Record<PersonaKey, string> = {
    technical: "Technical Interviewer",
    product: "Product Manager",
    hiring_manager: "Hiring Manager",
    behavioral: "Behavioral Interviewer",
    customer: "Customer (Role-play)",
    domain: "Domain Expert",
    leadership: "Leadership",
    culture: "Culture Fit",
  };

  const difficultyColor: Record<DifficultyLevel, string> = {
    Easy: "text-blue-600 bg-blue-50 border-blue-200",
    Medium: "text-amber-600 bg-amber-50 border-amber-200",
    Hard: "text-orange-600 bg-orange-50 border-orange-200",
    Expert: "text-rose-600 bg-rose-50 border-rose-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="text-lg font-semibold text-slate-800 tracking-tight">EcoSphere</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400 font-medium">
            Mock Interview Setup
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Progress steps */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      i < step
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                        : i === step
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200 ring-4 ring-blue-100"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span
                    className={`text-[11px] font-medium transition-colors ${
                      i <= step ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 transition-colors duration-300 ${
                      i < step ? "bg-emerald-300" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 min-h-[420px]">
          {/* STEP 1: Company */}
          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2.5 mb-7">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Target Company</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Select a target company to customize interview questions to their hiring bar.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Select Company
                  </Label>
                  <Select
                    value={state.company}
                    onValueChange={(v) => handleCompanySelect(v ?? "")}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-100 h-12">
                      <SelectValue placeholder="Choose a company..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {POPULAR_COMPANIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          <div className="flex items-center gap-3">
                            {getCompanyIcon(c)}
                            <span className="font-medium text-slate-800">{c}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.company === "Other (describe below)" && (
                  <div className="animate-in fade-in duration-200">
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Custom Company Name
                    </Label>
                    <Input
                      placeholder="Type your target company..."
                      value={state.customCompany}
                      onChange={(e) => updateField("customCompany", e.target.value)}
                      className="w-full bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Role */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2.5 mb-7">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Target Role</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Specify the role for tailored candidate evaluation.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Select Position
                  </Label>
                  <Select
                    value={state.role}
                    onValueChange={(v) => handleRoleSelect(v ?? "")}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 focus:border-violet-400 focus:ring-violet-100 h-12">
                      <SelectValue placeholder="Choose a role..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {POPULAR_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          <div className="flex items-center gap-2.5">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-800">{r}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.role === "Other (describe below)" && (
                  <div className="animate-in fade-in duration-200">
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Custom Role
                    </Label>
                    <Input
                      placeholder="e.g. ML Platform Engineer..."
                      value={state.customRole}
                      onChange={(e) => updateField("customRole", e.target.value)}
                      className="w-full bg-slate-50 border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Domain */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2.5 mb-7">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Domain & Competency Focus</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Select your domain to calibrate course-specific weightage matrix.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Course / Domain Focus
                  </Label>
                  <Select
                    value={state.domain}
                    onValueChange={(v) => handleDomainSelect(v as string)}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 focus:border-emerald-400 focus:ring-emerald-100 h-12">
                      <SelectValue placeholder="Choose a domain..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>
                          <div className="flex items-center gap-2.5">
                            <Brain className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-800">{d}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.domain === "Other (describe below)" && (
                  <div className="animate-in fade-in duration-200">
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Custom Domain
                    </Label>
                    <Input
                      placeholder="e.g. Distributed Systems..."
                      value={state.customDomain}
                      onChange={(e) => updateField("customDomain", e.target.value)}
                      className="w-full bg-slate-50 border-slate-200 focus:border-emerald-400 focus:ring-emerald-100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: AI Proposal (Course Weightage Driven) */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Dynamic AI Proposal</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Proposal generated based on course weightage matrix for{" "}
                    <span className="font-semibold text-slate-700">
                      {state.domain && state.domain !== "Other (describe below)" ? state.domain : state.customDomain || "Web Development"}
                    </span>
                  </p>
                </div>
              </div>

              {parsing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-slate-500">Calculating course weightage and generating proposal...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Weightage breakdown bar */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-violet-600" />
                        Competency Weightage Breakdown
                      </span>
                      <span className="text-xs text-slate-400">Course Matrix</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                      <div className="p-2 bg-white rounded-lg border border-blue-200">
                        <p className="font-bold text-blue-600">{weightage.technical}%</p>
                        <p className="text-[10px] text-slate-500">Technical</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-purple-200">
                        <p className="font-bold text-purple-600">{weightage.systemDesign}%</p>
                        <p className="text-[10px] text-slate-500">System Design</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-emerald-200">
                        <p className="font-bold text-emerald-600">{weightage.problemSolving}%</p>
                        <p className="text-[10px] text-slate-500">Problem Solving</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-amber-200">
                        <p className="font-bold text-amber-600">{weightage.behavioral}%</p>
                        <p className="text-[10px] text-slate-500">Behavioral</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-rose-200">
                        <p className="font-bold text-rose-600">{weightage.communication}%</p>
                        <p className="text-[10px] text-slate-500">Communication</p>
                      </div>
                    </div>
                  </div>

                  {/* Panel & Focus areas */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-blue-600" />
                        Inferred Interview Panel
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {state.suggestedPersonas.map((p) => (
                          <Badge
                            key={p}
                            className={`px-2.5 py-1 text-xs font-medium text-white ${personaColor[p]}`}
                          >
                            {personaLabel[p]}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-600" />
                        Course Focus Areas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {state.focusAreas.map((area, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-700 font-medium"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Difficulty selector */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Target Difficulty Level
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {DIFFICULTY_LEVELS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateField("difficulty", d)}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                            state.difficulty === d
                              ? difficultyColor[d] + " ring-2 ring-blue-400"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Confirm */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Confirm Mock Interview Setup</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Ready to proceed to Candidate Personal Information.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Company</span>
                    <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      {getCompanyIcon(state.company)}
                      {state.company && state.company !== "Other (describe below)"
                        ? state.company
                        : state.customCompany || "Custom Company"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Role</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {state.role && state.role !== "Other (describe below)"
                        ? state.role
                        : state.customRole || "Software Engineer"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Domain</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {state.domain && state.domain !== "Other (describe below)"
                        ? state.domain
                        : state.customDomain || "Web Development"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Difficulty</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${difficultyColor[state.difficulty]}`}>
                      {state.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Interview Mode</span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-semibold">
                      Assessment / Mock Interview
                    </Badge>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-200/50 h-12 text-base"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing Candidate Session...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Proceed to Candidate Information
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <Button
              variant="outline"
              size="lg"
              onClick={prev}
              disabled={step === 0}
              className="border-slate-200 hover:bg-slate-50 h-11"
            >
              <ChevronLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>
            {step < 4 && (
              <Button
                size="lg"
                onClick={next}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-11"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
