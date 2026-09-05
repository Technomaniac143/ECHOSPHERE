"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { organizationApi } from "@/lib/api/client";
import type { Assessment } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  ClipboardCheck,
  Plus,
  ChevronRight,
  FileText,
  Clock,
  Users,
  RefreshCw,
} from "lucide-react";

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700 border-emerald-200",
  easy: "bg-sky-100 text-sky-700 border-sky-200",
  medium: "bg-violet-100 text-violet-700 border-violet-200",
  hard: "bg-amber-100 text-amber-700 border-amber-200",
  expert: "bg-rose-100 text-rose-700 border-rose-200",
};

const ROLE_OPTIONS = [
  "Software Engineer",
  "Backend Developer",
  "Frontend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Cybersecurity Engineer",
  "Product Manager",
  "Business Analyst",
  "QA Engineer",
];

const DOMAIN_OPTIONS = [
  "Web Development",
  "Backend Development",
  "Frontend Development",
  "Full Stack Development",
  "Machine Learning",
  "Artificial Intelligence",
  "Data Science",
  "Cloud Computing",
  "DevOps",
  "Cybersecurity",
  "Mobile Development",
  "Blockchain",
  "Embedded Systems",
  "Product Management",
  "Software Engineering",
  "Other",
];

const DIFFICULTY_OPTIONS = ["beginner", "easy", "medium", "hard", "expert"];

export default function OrganizationAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formDifficulty, setFormDifficulty] = useState("medium");
  const [formDuration, setFormDuration] = useState(60);
  const [formPersons, setFormPersons] = useState<string[]>([]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const res = await organizationApi.assessments();
      setAssessments(res.data ?? []);
    } catch {
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const togglePersona = (persona: string) => {
    setFormPersons((prev) =>
      prev.includes(persona) ? prev.filter((p) => p !== persona) : [...prev, persona],
    );
  };

  const handleCreate = async () => {
    if (!formName || !formRole || !formDomain || formPersons.length === 0) return;
    setCreating(true);
    try {
      await organizationApi.createAssessment({
        name: formName,
        role: formRole,
        domain: formDomain,
        difficulty: formDifficulty as Assessment["difficulty"],
        durationMinutes: formDuration,
        personas: formPersons as Assessment["personas"],
      });
      setOpenDialog(false);
      resetForm();
      fetchAssessments();
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormRole("");
    setFormDomain("");
    setFormDifficulty("medium");
    setFormDuration(60);
    setFormPersons([]);
  };

  const stats = assessments.reduce(
    (acc, a) => {
      acc.total++;
      if (a.difficulty === "expert" || a.difficulty === "hard") acc.hard++;
      acc.personas += a.personas.length;
      return acc;
    },
    { total: 0, hard: 0, personas: 0 },
  );

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/organization"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h1 className="text-lg font-semibold text-slate-800">Assessments</h1>
              <p className="text-xs text-slate-500">Configure interview assessments for candidates</p>
            </div>
          </div>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger>
              <Button variant="premium" size="lg" className="gap-2 shadow-lg shadow-emerald-500/20">
                <Plus className="w-5 h-5" />
                New Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Assessment</DialogTitle>
                <p className="text-sm text-slate-500">
                  Configure an interview assessment with role, domain, difficulty, and personas.
                </p>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Assessment Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Senior Backend Engineer Assessment"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={formRole} onValueChange={(v) => setFormRole(v ?? "")}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="domain">Domain</Label>
                    <Select value={formDomain} onValueChange={(v) => setFormDomain(v ?? "")}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOMAIN_OPTIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select value={formDifficulty} onValueChange={setFormDifficulty}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={15}
                      max={180}
                      value={formDuration}
                      onChange={(e) => setFormDuration(Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label>Interview Personas</Label>
                  <p className="text-xs text-slate-400 mt-1">Select which AI personas will conduct the interview</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { key: "technical", label: "Technical", color: "bg-blue-100 text-blue-700 border-blue-200" },
                      { key: "product", label: "Product", color: "bg-violet-100 text-violet-700 border-violet-200" },
                      { key: "hiring_manager", label: "Hiring Manager", color: "bg-amber-100 text-amber-700 border-amber-200" },
                      { key: "behavioral", label: "Behavioral", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                      { key: "customer", label: "Customer", color: "bg-pink-100 text-pink-700 border-pink-200" },
                    ].map((p) => (
                      <Button
                        key={p.key}
                        variant={formPersons.includes(p.key) ? "default" : "outline"}
                        size="sm"
                        className={`gap-1.5 ${formPersons.includes(p.key) ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700" : ""}`}
                        onClick={() => togglePersona(p.key)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={resetForm}>
                    Reset
                  </Button>
                  <Button onClick={handleCreate} disabled={creating || !formName || !formRole || !formDomain || formPersons.length === 0}>
                    {creating ? "Creating…" : "Create Assessment"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Assessments</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.hard}</p>
                <p className="text-xs text-slate-500">Hard / Expert</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.personas}</p>
                <p className="text-xs text-slate-500">Total Personas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assessments list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading assessments…
          </div>
        ) : assessments.length === 0 ? (
          <Card className="bg-white/80 border-slate-200/70">
            <CardContent className="py-16 text-center">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-slate-300 opacity-50" />
              <h3 className="text-base font-semibold text-slate-700 mb-1">No assessments yet</h3>
              <p className="text-sm text-slate-400 mb-4">
                Create your first assessment to start evaluating candidates.
              </p>
              <Button variant="premium" size="lg" className="gap-2 shadow-lg shadow-emerald-500/20">
                <Plus className="w-5 h-5" />
                Create Assessment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assessments.map((a) => (
              <Card key={a.id} className="bg-white/80 border-slate-200/70 hover:border-slate-300 transition-all hover:shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 flex-shrink-0">
                        <ClipboardCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base">{a.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {a.role} · {a.domain}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="secondary"
                        className={DIFFICULTY_COLORS[a.difficulty] ?? "bg-slate-100 text-slate-700"}
                      >
                        {a.difficulty}
                      </Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {a.durationMinutes}m
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {a.personas.length} personas
                      </span>
                      {a.competencies && a.competencies.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          {a.competencies.length} competencies
                        </span>
                      )}
                      <span>Created {new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.joinCode && (
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                          Code: {a.joinCode}
                        </span>
                      )}
                      <Link
                        href={`/assessment/${a.joinCode ?? a.id}`}
                        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                      >
                        Start Assessment
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                  {a.personas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.personas.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="text-[10px] capitalize border-slate-200 text-slate-600"
                        >
                          {p.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
