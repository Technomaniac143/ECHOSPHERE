"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { interviewApi, ApiClientError } from "@/lib/api/client";
import {
  Search,
  RefreshCw,
  FileText,
  TrendingUp,
  Eye,
  AlertCircle,
} from "lucide-react";

interface ReportRow {
  id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  role?: string | null;
  company?: string | null;
  domain?: string | null;
  overall_score?: number | null;
  status: string;
  created_at?: string | null;
  ended_at?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  in_progress: { label: "In Progress", color: "bg-violet-100 text-violet-700 border-violet-200" },
  abandoned: { label: "Abandoned", color: "bg-rose-100 text-rose-700 border-rose-200" },
  scheduled: { label: "Scheduled", color: "bg-sky-100 text-sky-700 border-sky-200" },
};

export default function OrganizationReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("completed");

  const fetchReports = async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await interviewApi.list({
        status: status || undefined,
        limit: 100,
      });
      setReports((res.data ?? []) as unknown as ReportRow[]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load reports.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const s = search.toLowerCase();
    return reports.filter(
      (r) =>
        (r.candidate_name ?? "").toLowerCase().includes(s) ||
        (r.candidate_email ?? "").toLowerCase().includes(s) ||
        (r.role ?? "").toLowerCase().includes(s) ||
        (r.company ?? "").toLowerCase().includes(s),
    );
  }, [reports, search]);

  const avgScore = useMemo(() => {
    const scored = reports.filter((r) => r.overall_score != null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((acc, r) => acc + (r.overall_score ?? 0), 0) / scored.length);
  }, [reports]);

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
              <h1 className="text-lg font-semibold text-slate-800">Reports</h1>
              <p className="text-xs text-slate-500">Interview reports across your candidate pipeline</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchReports(statusFilter)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{reports.length}</p>
                <p className="text-xs text-slate-500">Reports loaded</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{avgScore != null ? `${avgScore}/100` : "—"}</p>
                <p className="text-xs text-slate-500">Average score</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/60 border-slate-200/60">
            <CardContent className="p-4 flex items-center gap-3">
              <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/60 border-slate-200/60">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by candidate, role, or company…"
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200/70 overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading reports…
              </div>
            ) : error ? (
              <div className="py-12 text-center text-rose-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-70" />
                <p className="text-sm">{error}</p>
                <Button variant="link" size="sm" className="mt-2" onClick={() => fetchReports(statusFilter)}>
                  Try again
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {reports.length === 0 ? "No reports for this filter yet." : "No reports match your search."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200/60">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Candidate
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Role / Company
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                      Score
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right w-[80px]">
                      Report
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.scheduled;
                    const date = r.ended_at ?? r.created_at;
                    return (
                      <TableRow key={r.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{r.candidate_name ?? "Unknown candidate"}</p>
                            {r.candidate_email && <p className="text-xs text-slate-400">{r.candidate_email}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-700">{r.role ?? "—"}</p>
                          <p className="text-xs text-slate-400">{r.company ?? "—"}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">
                            {date ? new Date(date).toLocaleDateString() : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.overall_score != null ? (
                            <span
                              className={`text-sm font-mono font-semibold ${
                                r.overall_score >= 70
                                  ? "text-emerald-600"
                                  : r.overall_score >= 55
                                    ? "text-amber-600"
                                    : "text-rose-600"
                              }`}
                            >
                              {r.overall_score}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${cfg.color} text-[10px]`}>
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/reports/${r.id}`}
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
