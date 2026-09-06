"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, ArrowRight, Sparkles, ShieldCheck, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function CandidateAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCandidateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.__CLERK_USER__ = {
          id: "cand_dev_101",
          email: email || "candidate@echosphere.dev",
          name: email ? email.split("@")[0] : "Candidate Arjun",
          role: "student",
        };
      }
      router.push("/dashboard/candidate");
    }, 600);
  };

  const handleQuickDemo = () => {
    setLoading(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.__CLERK_USER__ = {
          id: "cand_dev_101",
          email: "arjun.sharma@echosphere.dev",
          name: "Arjun Sharma",
          role: "student",
        };
      }
      router.push("/dashboard/candidate");
    }, 400);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 transition-colors duration-300">
      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-500/8 blur-[120px] transition-colors duration-700" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/8 dark:bg-purple-500/6 blur-[100px] transition-colors duration-700" />
      </div>

      <div className="w-full max-w-md">
        {/* Brand */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">EchoSphere</span>
        </Link>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-8 shadow-xl backdrop-blur-xl transition-colors duration-300"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <User className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Candidate Portal</h1>
              <p className="text-xs text-muted-foreground">Practice AI voice interviews</p>
            </div>
          </div>

          <form onSubmit={handleCandidateLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Work or Personal Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="w-full rounded-xl border border-border bg-muted/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
            >
              {loading ? "Signing in..." : "Continue to Candidate Dashboard"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              or quick launch
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleQuickDemo}
            disabled={loading}
            className="w-full h-11 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-600 font-medium rounded-xl transition-all"
          >
            <Zap className="mr-2 h-4 w-4 fill-current" />
            Enter Demo Candidate Workspace
          </Button>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>End-to-End Voice &amp; Identity Encryption</span>
          </div>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an assessment invite?{" "}
          <Link href="/assessment/demo" className="text-blue-500 hover:underline">
            Enter Access Code
          </Link>
        </p>
      </div>
    </div>
  );
}
