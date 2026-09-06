
import { SignIn, SignUp } from "@clerk/nextjs";
import { ArrowRight, User, Building2, FileCode } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function AuthPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 20%, rgba(59,130,246,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139,92,246,0.04) 0%, transparent 60%)
            `,
          }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <Link href="/" className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2a10 10 0 0 1 10 10c0 2.5-1 4.5-3 6-2 1.5-4 2-5 2s-3-.5-5-2c-2-1.5-3-3.5-3-6a10 10 0 0 1 10-10z" />
                <circle cx="12" cy="10" r="2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">EchoSphere</span>
          </Link>

          <div className="mb-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <h1 className="mb-2 text-center text-2xl font-bold text-white">
              Welcome to EchoSphere
            </h1>
            <p className="text-center text-sm text-zinc-400">
              Adaptive AI voice interviews with a coordinated panel.
            </p>
          </div>

          {/* Auth cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Candidate */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-blue-500/20 hover:bg-white/[0.04]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Candidate</h2>
                  <p className="text-xs text-zinc-400">Practice interviews</p>
                </div>
              </div>
              <Link
                href="/auth/candidate"
                className="group flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Sign in as Candidate
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Organization */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-purple-500/20 hover:bg-white/[0.04]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Building2 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Organization</h2>
                  <p className="text-xs text-zinc-400">Run assessment loops</p>
                </div>
              </div>
              <Link
                href="/auth/organization"
                className="group flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Sign in as Organization
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Social auth */}
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
              Or continue with
            </p>
            <div className="flex gap-3">
              <button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.86-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white">
                <FileCode className="h-4 w-4" />
                GitHub
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-500">
            By continuing, you agree to EchoSphere's terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
