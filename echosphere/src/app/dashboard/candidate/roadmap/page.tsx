"use client";

import { useRouter } from "next/navigation";
import { useCandidateAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { RoadmapProgress } from "@/components/dashboard/DashboardCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, Map, Target, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function CandidateRoadmapPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const { data: analyticsData, loading, error } = useCandidateAnalytics(user?.id ?? null);

  const competencyScores = analyticsData?.competency_scores ?? [];
  const mapData = competencyScores.map(c => ({
    name: c.label,
    progress: c.score,
    color: c.score >= 80 ? "from-emerald-500 to-teal-400" : c.score >= 50 ? "from-amber-500 to-orange-400" : "from-rose-500 to-red-400"
  }));

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/candidate")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-violet-600" />
              Skill Roadmap
            </h1>
            <p className="text-xs text-muted-foreground">Track your progress and focus your interview preparation</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Error loading roadmap</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-20 text-muted-foreground">
              <Clock className="h-6 w-6 animate-spin mr-2" />
              Loading your skill progression...
            </div>
          ) : mapData.length === 0 ? (
            <div className="col-span-full text-center py-16 border rounded-xl bg-card border-dashed">
              <Map className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No competency data yet</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Complete a mock interview to generate your personalized skill roadmap.
              </p>
              <Button asChild className="mt-6">
                <Link href="/interview/setup">Start an Interview</Link>
              </Button>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-violet-600" />
                    Competency Tracking
                  </CardTitle>
                  <CardDescription>
                    Your proficiency in different interview dimensions based on past sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RoadmapProgress competencies={mapData} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-emerald-600" />
                    Next Steps
                  </CardTitle>
                  <CardDescription>
                    Recommended actions based on your skill profile.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {competencyScores.filter(c => c.score < 60).length > 0 ? (
                      competencyScores.filter(c => c.score < 60).slice(0, 3).map((comp, idx) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <div className="mt-0.5 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <div>
                            <p className="font-medium">Improve your {comp.label}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">Your score is {Math.round(comp.score)}/100. Practice more questions focused on this area.</p>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="flex gap-3 text-sm">
                        <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="font-medium">All clear!</p>
                          <p className="text-muted-foreground text-xs mt-0.5">You have no major weak spots.</p>
                        </div>
                      </li>
                    )}
                  </ul>
                  <Button asChild className="w-full mt-6" variant="outline">
                    <Link href="/interview/setup">Practice Weak Areas</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
