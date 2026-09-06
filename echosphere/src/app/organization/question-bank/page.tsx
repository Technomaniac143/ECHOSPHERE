"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { organizationApi, ApiClientError, type RawQuestion } from "@/lib/api/client";
import type { QuestionBankItem } from "@/types";
import {
  RefreshCw,
  BookOpen,
  Plus,
  Search,
  Layers,
  AlertCircle,
} from "lucide-react";

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-rose-100 text-rose-700 border-rose-200",
};

function mapQuestion(raw: RawQuestion): QuestionBankItem {
  return {
    id: raw.id,
    question: raw.question,
    category: raw.category,
    difficulty: raw.difficulty,
    expectedCompetency: raw.expected_competency,
    role: raw.role,
    domain: raw.domain,
    expectedAnswer: raw.expected_answer,
    organizationId: raw.organization_id,
    createdAt: raw.created_at,
  };
}

const EMPTY_FORM = {
  question: "",
  category: "",
  difficulty: "medium",
  expected_competency: "",
  role: "",
  domain: "",
  expected_answer: "",
};

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await organizationApi.questions();
      setQuestions((raw ?? []).map(mapQuestion));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load the question bank.");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(questions.map((q) => q.category).filter(Boolean));
    return Array.from(set).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (categoryFilter && q.category !== categoryFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        q.question.toLowerCase().includes(s) ||
        q.category.toLowerCase().includes(s) ||
        (q.role ?? "").toLowerCase().includes(s) ||
        (q.domain ?? "").toLowerCase().includes(s)
      );
    });
  }, [questions, search, categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.question.trim() || !form.category.trim()) {
      setFormError("Question and category are required.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await organizationApi.addQuestion({
        question: form.question.trim(),
        category: form.category.trim(),
        difficulty: form.difficulty,
        expected_competency: form.expected_competency.trim() || undefined,
        role: form.role.trim() || undefined,
        domain: form.domain.trim() || undefined,
        expected_answer: form.expected_answer.trim() || undefined,
      });
      setQuestions((prev) => [mapQuestion(created), ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save the question.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
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
              <h1 className="text-lg font-semibold text-slate-800">Question Bank</h1>
              <p className="text-xs text-slate-500">Curate interview questions for your assessments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchQuestions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="premium" size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1">
              <Plus className="w-4 h-4" />
              Add Question
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {showForm && (
          <Card className="bg-white/90 border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-base">New question</CardTitle>
              <CardDescription>Add a question to reuse across assessments.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Question *</Label>
                  <Textarea
                    id="question"
                    value={form.question}
                    onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                    placeholder="e.g. Walk me through how you'd design a rate limiter."
                    rows={3}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. system_design, behavioral"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select
                      value={form.difficulty}
                      onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      placeholder="e.g. Backend Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      value={form.domain}
                      onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                      placeholder="e.g. distributed_systems"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="competency">Expected competency</Label>
                    <Input
                      id="competency"
                      value={form.expected_competency}
                      onChange={(e) => setForm((f) => ({ ...f, expected_competency: e.target.value }))}
                      placeholder="e.g. Systems thinking"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="answer">Expected answer (optional)</Label>
                  <Textarea
                    id="answer"
                    value={form.expected_answer}
                    onChange={(e) => setForm((f) => ({ ...f, expected_answer: e.target.value }))}
                    placeholder="Notes on what a strong answer covers"
                    rows={2}
                  />
                </div>
                {formError && (
                  <div className="flex items-center gap-2 text-sm text-rose-600">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button type="submit" variant="premium" disabled={submitting}>
                    {submitting ? "Saving…" : "Save question"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      setForm(EMPTY_FORM);
                      setFormError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/60 border-slate-200/60">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions, category, role…"
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-slate-500 ml-auto">
              <Layers className="w-4 h-4" />
              {filtered.length} of {questions.length} questions
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200/70">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading question bank…
              </div>
            ) : error ? (
              <div className="py-12 text-center text-rose-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-70" />
                <p className="text-sm">{error}</p>
                <Button variant="link" size="sm" className="mt-2" onClick={fetchQuestions}>
                  Try again
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {questions.length === 0 ? "No questions in the bank yet." : "No questions match your filters."}
                </p>
                {questions.length === 0 && (
                  <Button variant="link" size="sm" className="mt-2 text-violet-600" onClick={() => setShowForm(true)}>
                    Add your first question
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((q) => (
                  <div key={q.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-slate-800 font-medium leading-snug">{q.question}</p>
                      <Badge
                        variant="secondary"
                        className={`${DIFFICULTY_COLOR[q.difficulty] ?? "bg-slate-100 text-slate-700 border-slate-200"} text-[10px] flex-shrink-0`}
                      >
                        {q.difficulty}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {q.category}
                      </span>
                      {q.role && <span>Role: {q.role}</span>}
                      {q.domain && <span>Domain: {q.domain}</span>}
                      {q.expectedCompetency && <span>Competency: {q.expectedCompetency}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
