"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizationApi } from "@/lib/api/client";
import type { OrgCandidate } from "@/types";
import {
  Search,
  Filter,
  RefreshCw,
  Users,
  Calendar,
  TrendingUp,
  Eye,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  scheduled: { label: "Scheduled", color: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  in_progress: { label: "In Progress", color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500 animate-pulse" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  abandoned: { label: "Abandoned", color: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export default function OrganizationCandidatesPage() {
  const [candidates, setCandidates] = useState<OrgCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await organizationApi.candidates({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setCandidates(res.data ?? []);
      setTotal(res.total ?? res.data?.length ?? 0);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [roleFilter, statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        (c.domain && c.domain.toLowerCase().includes(q)),
    );
  }, [candidates, search]);

  const stats = useMemo(() => {
    const total = candidates.length;
    const completed = candidates.filter((c) => c.status === "completed").length;
    const inProgress = candidates.filter((c) => c.status === "in_progress").length;
    const avgScore =
      completed > 0
        ? Math.round(
            candidates
              .filter((c) => c.status === "completed" && c.overallScore != null)
              .reduce((acc, c) => acc + (c.overallScore ?? 0), 0) / completed,
          )
        : 0;
    return { total, completed, inProgress, avgScore };
  }, [candidates]);

  const topCandidate = useMemo(() => {
    return candidates
      .filter((c) => c.status === "completed" && c.overallScore != null)
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0] ?? null;
  }, [candidates]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set(candidates.map((c) => c.role).filter(Boolean));
    return Array.from(roles).sort();
  }, [candidates]);

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
              <h1 className="text-lg font-semibold text-slate-800">Candidates</h1>
              <p className="text-xs text-slate-500">Manage and filter interview candidates</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCandidates} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Candidates</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.completed}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.inProgress}</p>
                <p className="text-xs text-slate-500">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.avgScore > 0 ? `${stats.avgScore}/100` : "—"}
                </p>
                <p className="text-xs text-slate-500">Avg Score</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/60 border-slate-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4 text-violet-600" />
              Filters
            </CardTitle>
            <CardDescription>Search and filter candidates by role, status, or name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-[160px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Role</label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All roles</SelectItem>
                    {uniqueRoles.filter((r): r is string => Boolean(r)).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[160px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(roleFilter || statusFilter || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("");
                    setStatusFilter("");
                  }}
                  className="text-slate-500"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>
            {filtered.length} of {total} candidates{filtered.length !== candidates.length ? ` (filtered)` : ""}
          </p>
          {topCandidate && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-600 font-medium">Top:</span>
              <span className="text-slate-700">{topCandidate.name}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-600">{topCandidate.overallScore}/100</span>
            </div>
          )}
        </div>

        {/* Table */}
        <Card className="bg-white/80 border-slate-200/70 overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading candidates…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No candidates found</p>
                {(roleFilter || statusFilter || search) && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 text-violet-600"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("");
                      setStatusFilter("");
                    }}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200/60">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Candidate
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Role
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Domain
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Interview Date
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                      Overall Score
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                      Technical
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                      Behavioral
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right w-[80px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.scheduled;
                    return (
                      <TableRow key={c.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-sm font-bold flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                              <p className="text-xs text-slate-400 truncate">{c.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-700">{c.role ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">{c.domain ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          {c.interviewDate ? (
                            <span className="text-sm text-slate-600">
                              {new Date(c.interviewDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.overallScore != null ? (
                            <span
                              className={`text-sm font-mono font-semibold ${
                                c.overallScore >= 70
                                  ? "text-emerald-600"
                                  : c.overallScore >= 55
                                    ? "text-amber-600"
                                    : "text-rose-600"
                              }`}
                            >
                              {c.overallScore}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.technicalScore != null ? (
                            <span className="text-sm font-mono text-slate-600">{c.technicalScore}</span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.behavioralScore != null ? (
                            <span className="text-sm font-mono text-slate-600">{c.behavioralScore}</span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${cfg.color} text-[10px]`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5`} />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/reports/${c.sessionId}`}
                            className="inline-flex items-center justify-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
