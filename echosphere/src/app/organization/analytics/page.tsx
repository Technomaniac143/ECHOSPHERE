"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertTriangle, HelpCircle, Shield } from "lucide-react";
import { StatCard } from "@/components/dashboard/DashboardCards";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";

const METRIC_COLORS = ["#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

function DistributionChart({
  data,
  title,
  color,
  height = 180,
}: {
  data: Array<{ range: string; count: number; pct: number }>;
  title: string;
  color?: string;
  height?: number;
}) {
  if (!data.length) return null;
  return (
    <div className="h-[200px]">
      <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color ?? "#6366f1" }} />
        {title}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
          <Tooltip formatter={(value) => `${value}`} />
          <Legend />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={color ?? METRIC_COLORS[i % METRIC_COLORS.length]} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RateGauge({
  rate,
  maxRate = 100,
  label,
  icon: Icon,
  color,
  height = 100,
}: {
  rate: number;
  maxRate?: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  height?: number;
}) {
  const pct = Math.min(100, (rate / maxRate) * 100);
  const tier =
    pct < 10
      ? "text-emerald-600"
      : pct < 30
      ? "text-amber-600"
      : "text-rose-600";
  return (
    <div className="flex flex-col items-center justify-center" style={{ height }}>
      <div className="relative w-20 h-20 mb-2">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="5" />
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke={color ?? "#6366f1"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${pct * 2.01} 201`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-lg font-bold text-slate-800", tier)}>
            {pct.toFixed(0)}%
          </span>
          <span className="text-[9px] text-slate-400">rate</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
    </div>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ data: Record<string, unknown> }>("/api/batches/latest/analytics");
      setAnalytics(res.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  // React effect for loading
  useEffect(() => { load(); }, []);

  const scoreDist = useMemo(() => {
    if (!analytics) return [];
    const raw = analytics["scoreDistribution"] as Array<{ range: string; count: number; pct: number }> | undefined;
    return raw ?? [];
  }, [analytics]);

  const technicalDist = useMemo(() => {
    if (!analytics) return [];
    const raw = analytics["technicalDistribution"] as Array<{ range: string; count: number; pct: number }> | undefined;
    return raw ?? [];
  }, [analytics]);

  const behavioralDist = useMemo(() => {
    if (!analytics) return [];
    const raw = analytics["behavioralDistribution"] as Array<{ range: string; count: number; pct: number }> | undefined;
    return raw ?? [];
  }, [analytics]);

  const productDist = useMemo(() => {
    if (!analytics) return [];
    const raw = analytics["productDistribution"] as Array<{ range: string; count: number; pct: number }> | undefined;
    return raw ?? [];
  }, [analytics]);

  const disagreementRate = useMemo(() => {
    if (!analytics) return 0;
    const v = analytics["panelDisagreementRate"] as number | undefined;
    return v ?? 0;
  }, [analytics]);

  const vaguenessRate = useMemo(() => {
    if (!analytics) return 0;
    const v = analytics["vaguenessFrequency"] as number | undefined;
    return v ?? 0;
  }, [analytics]);

  const contradictionRate = useMemo(() => {
    if (!analytics) return 0;
    const v = analytics["contradictionFrequency"] as number | undefined;
    return v ?? 0;
  }, [analytics]);

  const integrityEventRate = useMemo(() => {
    if (!analytics) return 0;
    const v = analytics["integrityEventFrequency"] as number | undefined;
    return v ?? 0;
  }, [analytics]);

  const totalCandidates = useMemo(() => {
    if (!analytics) return 0;
    const v = analytics["totalCandidates"] as number | undefined;
    return v ?? 0;
  }, [analytics]);

  const avgScore = useMemo(() => {
    if (!analytics) return 0;
    const v = analytics["averageScore"] as number | undefined;
    return v ?? 0;
  }, [analytics]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Batch-level interview analytics and quality metrics
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
        ) : !analytics ? (
          <Card className="border-dashed border-slate-200">
            <CardContent className="py-16 text-center text-slate-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No analytics data available yet</p>
              <p className="text-xs text-slate-300 mt-0.5">Complete interviews to see metrics</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Candidates"
                value={totalCandidates}
                accent="violet"
                icon={<HelpCircle className="w-4 h-4" />}
              />
              <StatCard
                label="Average Score"
                value={`${avgScore.toFixed(0)}`}
                subtext="/100"
                accent="emerald"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="Panel Disagreement"
                value={`${disagreementRate.toFixed(1)}%`}
                subtext="of interviews"
                accent="amber"
                icon={<AlertTriangle className="w-4 h-4" />}
              />
              <StatCard
                label="Integrity Events"
                value={`${integrityEventRate.toFixed(1)}%`}
                subtext="of interviews"
                accent="rose"
                icon={<Shield className="w-4 h-4" />}
              />
            </div>

            {/* Distribution charts */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scoreDist.length > 0 ? (
                  <DistributionChart data={scoreDist} title="All candidates" color="#6366f1" />
                ) : (
                  <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
                    No distribution data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Three metric charts side by side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Technical Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {technicalDist.length > 0 ? (
                    <DistributionChart data={technicalDist} title="" color="#3b82f6" height={150} />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                      No data
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Behavioral Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {behavioralDist.length > 0 ? (
                    <DistributionChart data={behavioralDist} title="" color="#10b981" height={150} />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                      No data
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Product Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {productDist.length > 0 ? (
                    <DistributionChart data={productDist} title="" color="#f59e0b" height={150} />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                      No data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Frequency metrics — 2x2 grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="overflow-hidden">
                <CardContent className="pt-6 flex flex-col items-center">
                  <RateGauge
                    rate={disagreementRate}
                    label="Panel Disagreement Rate"
                    icon={AlertTriangle}
                    color="#f59e0b"
                  />
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardContent className="pt-6 flex flex-col items-center">
                  <RateGauge
                    rate={vaguenessRate}
                    label="Vagueness Frequency"
                    icon={HelpCircle}
                    color="#06b6d4"
                  />
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardContent className="pt-6 flex flex-col items-center">
                  <RateGauge
                    rate={contradictionRate}
                    label="Contradiction Frequency"
                    icon={AlertTriangle}
                    color="#ec4899"
                  />
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardContent className="pt-6 flex flex-col items-center">
                  <RateGauge
                    rate={integrityEventRate}
                    label="Integrity Event Frequency"
                    icon={Shield}
                    color="#10b981"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Data quality summary */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  Data Quality Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Panel agreement",
                      value: 100 - disagreementRate,
                      color: disagreementRate < 20 ? "text-emerald-600" : disagreementRate < 40 ? "text-amber-600" : "text-rose-600",
                      note: disagreementRate < 15 ? "Good agreement across personas" : disagreementRate < 30 ? "Moderate disagreement — review" : "High disagreement — investigate",
                    },
                    {
                      label: "Answer clarity",
                      value: 100 - vaguenessRate,
                      color: vaguenessRate < 10 ? "text-emerald-600" : vaguenessRate < 25 ? "text-amber-600" : "text-rose-600",
                      note: vaguenessRate < 8 ? "Clear, specific answers" : vaguenessRate < 20 ? "Some vague answers" : "High vagueness — coach candidate",
                    },
                    {
                      label: "Integrity",
                      value: 100 - integrityEventRate,
                      color: integrityEventRate < 3 ? "text-emerald-600" : integrityEventRate < 8 ? "text-amber-600" : "text-rose-600",
                      note: integrityEventRate === 0 ? "No integrity concerns" : integrityEventRate < 5 ? "Low integrity flag rate" : "Monitor closely",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-100 bg-white p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                        <span className={cn("text-lg font-bold", item.color)}>
                          {item.value.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.value}%`,
                            backgroundColor:
                              item.value >= 80
                                ? "#10b981"
                                : item.value >= 60
                                ? "#f59e0b"
                                : "#ec4899",
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{item.note}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
