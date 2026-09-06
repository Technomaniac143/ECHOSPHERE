"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, setupApi, sessionApi } from "@/lib/api/client";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  mode: "practice" | "assessment";
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
  mode: "practice",
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<SetupState>(EMPTY_SETUP);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const hasParsedRef = useRef(false);

  useEffect(() => {
    if (step === 3 && !hasParsedRef.current) {
      hasParsedRef.current = true;
      const effectiveCompany =
        state.company && state.company !== "Other" ? state.company : state.customCompany;
      const effectiveRole =
        state.role && state.role !== "Other" ? state.role : state.customRole;
      const effectiveDomain =
        state.domain && state.domain !== "Other" ? state.domain : state.customDomain;

      setParsing(true);
      setupApi
        .parse({
          company: effectiveCompany,
          role: effectiveRole,
          domain: effectiveDomain,
        })
        .then((res: any) => {
          const setup = res?.data || res;
          setState((prev) => ({
            ...prev,
            suggestedPersonas: (setup?.suggestedPersonas || setup?.panel || ["technical", "behavioral"]) as PersonaKey[],
            difficulty: (setup?.difficulty as DifficultyLevel) || "Medium",
            estimatedDuration: setup?.estimatedDuration || setup?.est_duration_minutes || 20,
            focusAreas: (setup?.focusAreas || setup?.focus_areas || ["Problem Solving", "Communication"]),
          }));
        })
        .catch((err) => {
          console.error("Setup parsing fallback:", err);
          toast.error("Could not generate setup proposal. Using defaults.");
          setState((prev) => ({
            ...prev,
            suggestedPersonas: ["technical", "behavioral"] as PersonaKey[],
            difficulty: "Medium",
            estimatedDuration: 20,
            focusAreas: ["Problem Solving", "Communication"],
          }));
        })
        .finally(() => {
          setParsing(false);
        });
    } else if (step !== 3) {
      hasParsedRef.current = false;
    }
  }, [step, state.company, state.customCompany, state.role, state.customRole, state.domain, state.customDomain]);

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
          : state.customCompany || "Custom Company";
      const roleVal =
        state.role && state.role !== "Other" ? state.role : state.customRole || "Custom Role";
      const domainVal =
        state.domain && state.domain !== "Other"
          ? state.domain
          : state.customDomain || "Custom Domain";

      const session = await sessionApi.create({
        mode: state.mode,
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
      if (targetSessionId) {
        router.push(`/interview/lobby?sessionId=${targetSessionId}`);
      } else {
        router.push(`/interview/lobby`);
      }
    } catch (err) {
      toast.error("Failed to create session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  const personaColor: Record<PersonaKey, string> = {
    technical: "bg-blue-500",
    product: "bg-purple-500",
    hiring_manager: "bg-amber-500",
    behavioral: "bg-emerald-500",
    customer: "bg-pink-500",
    domain: "bg-teal-500",
    leadership: "bg-indigo-500",
    culture: "bg-rose-500",
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
            <span className="text-lg font-semibold text-slate-800 tracking-tight">EchoSphere</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            Interview Setup
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
                    {i < step ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      i + 1
                    )}
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
                  <h2 className="text-xl font-bold text-slate-800">Which company?</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Select the company you are interviewing with, or search for a custom one.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Select a company
                  </Label>
                  <Select
                    value={state.company}
                    onValueChange={(v) => handleCompanySelect(v ?? "")}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-100">
                      <SelectValue placeholder="Choose a company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_COMPANIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          <div className="flex items-center gap-2.5">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {c}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.company === "Other" && (
                  <div className="animate-in fade-in duration-200">
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Search for your company
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="Type your company name..."
                        value={state.customCompany}
                        onChange={(e) => updateField("customCompany", e.target.value)}
                        className="w-full bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-blue-100 pl-10"
                      />
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <InfoIcon />
                    <span>The company helps us tailor interview questions to their specific hiring style.</span>
                  </div>
                </div>
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
                  <h2 className="text-xl font-bold text-slate-800">What role?</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Choose the position you are interviewing for, or type a custom role.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Select a role
                  </Label>
                  <Select
                    value={state.role}
                    onValueChange={(v) => handleRoleSelect(v ?? "")}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 focus:border-violet-400 focus:ring-violet-100">
                      <SelectValue placeholder="Choose a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          <div className="flex items-center gap-2.5">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            {r}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.role === "Other" && (
                  <div className="animate-in fade-in duration-200">
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Type your role
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. ML Platform Engineer..."
                        value={state.customRole}
                        onChange={(e) => updateField("customRole", e.target.value)}
                        className="w-full bg-slate-50 border-slate-200 focus:border-violet-400 focus:ring-violet-100 pl-10"
                      />
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <InfoIcon />
                    <span>We match interviewers and questions to the role's real-world expectations.</span>
                  </div>
                </div>
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
                  <h2 className="text-xl font-bold text-slate-800">Domain focus</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Pick the primary technical or functional domain for this interview.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Select a domain
                  </Label>
                  <Select
                    value={state.domain}
                    onValueChange={(v) => handleDomainSelect(v as string)}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 focus:border-emerald-400 focus:ring-emerald-100">
                      <SelectValue placeholder="Choose a domain..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>
                          <div className="flex items-center gap-2.5">
                            <Brain className="w-4 h-4 text-slate-400" />
                            {d}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.domain === "Other" && (
                  <div className="animate-in fade-in duration-200">
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Type your domain
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. Distributed Systems..."
                        value={state.customDomain}
                        onChange={(e) => updateField("customDomain", e.target.value)}
                        className="w-full bg-slate-50 border-slate-200 focus:border-emerald-400 focus:ring-emerald-100 pl-10"
                      />
                      <Brain className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <InfoIcon />
                    <span>Domain selection helps us focus the conversation on relevant technical depth.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AI Proposal */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2.5 mb-7">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">AI-generated setup</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    We analyzed your selections and prepared a tailored interview configuration.
                  </p>
                </div>
              </div>

              {parsing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-slate-500">Analyzing your profile and generating setup...</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Summary chip row */}
                  <div className="flex flex-wrap gap-2.5">
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 px-3 py-1.5 text-sm font-medium">
                      {state.company && state.company !== "Other"
                        ? state.company
                        : state.customCompany || "Custom Company"}
                    </Badge>
                    <Badge className="bg-violet-50 text-violet-700 border-violet-200 px-3 py-1.5 text-sm font-medium">
                      {state.role && state.role !== "Other" ? state.role : state.customRole || "Custom Role"}
                    </Badge>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1.5 text-sm font-medium">
                      {state.domain && state.domain !== "Other" ? state.domain : state.customDomain || "Custom Domain"}
                    </Badge>
                    <Badge className={`px-3 py-1.5 text-sm font-medium border ${difficultyColor[state.difficulty]}`}>
                      {state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)}
                    </Badge>
                  </div>

                  {/* Personas */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2.5 block flex items-center gap-1.5">
                      <Target className="w-4 h-4" />
                      Inferred interviewers
                    </Label>
                    <div className="flex flex-wrap gap-2.5">
                      {state.suggestedPersonas.length > 0 ? (
                        state.suggestedPersonas.map((p) => (
                          <Badge
                            key={p}
                            className={`px-3 py-1.5 text-sm font-medium text-white border-0 ${personaColor[p]} flex items-center gap-1.5`}
                          >
                            <Star className="w-3 h-3" />
                            {personaLabel[p]}
                          </Badge>
                        ))
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200 px-3 py-1.5 text-sm">
                          Technical + Behavioral (default)
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Focus areas */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2.5 block flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      Focus areas
                    </Label>
                    {state.focusAreas.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {state.focusAreas.map((area, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Focus areas will be inferred during the interview.</p>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Estimated duration</p>
                      <p className="text-lg font-semibold text-slate-800">
                        ~ {state.estimatedDuration} minutes
                      </p>
                    </div>
                  </div>

                  {/* Mode toggle */}
                  <div className="pt-2">
                    <Label className="text-sm font-medium text-slate-700 mb-2.5 block">Interview mode</Label>
                    <div className="flex gap-2">
                      {(["practice", "assessment"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => updateField("mode", m)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                            state.mode === m
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {m === "practice" ? "Practice" : "Assessment"}
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
              <div className="flex items-center gap-2.5 mb-7">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Review & confirm</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Check everything looks right, then start your interview.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Summary card */}
                <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Company</span>
                    <span className="text-sm font-medium text-slate-800">
                      {state.company && state.company !== "Other"
                        ? state.company
                        : state.customCompany || "Custom Company"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Role</span>
                    <span className="text-sm font-medium text-slate-800">
                      {state.role && state.role !== "Other" ? state.role : state.customRole || "Custom Role"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Domain</span>
                    <span className="text-sm font-medium text-slate-800">
                      {state.domain && state.domain !== "Other" ? state.domain : state.customDomain || "Custom Domain"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Difficulty</span>
                    <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full border ${difficultyColor[state.difficulty]}`}>
                      {state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Duration</span>
                    <span className="text-sm font-medium text-slate-800">~{state.estimatedDuration} min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Mode</span>
                    <span className="text-sm font-medium text-slate-800 capitalize">{state.mode}</span>
                  </div>
                </div>

                {/* Personas */}
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Interviewers</Label>
                  <div className="flex flex-wrap gap-2">
                    {state.suggestedPersonas.length > 0 ? (
                      state.suggestedPersonas.map((p) => (
                        <Badge
                          key={p}
                          className={`px-3 py-1.5 text-sm font-medium text-white ${personaColor[p]} flex items-center gap-1.5`}
                        >
                          <Star className="w-3 h-3" />
                          {personaLabel[p]}
                        </Badge>
                      ))
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 px-3 py-1.5 text-sm">
                        Technical + Behavioral (default)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Edit buttons */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={() => setStep(0)}
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit company
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit role
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit domain
                  </button>
                </div>

                {/* Confirm button */}
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-200/50 h-12 text-base"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating session...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start Interview
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

function InfoIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
