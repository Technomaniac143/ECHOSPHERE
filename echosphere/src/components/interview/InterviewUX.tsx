"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AudioLevelMeterProps {
  level: number; // 0-1
  label?: string;
  className?: string;
  color?: string;
  warningLevel?: number;
  peakHold?: number;
}

export function AudioLevelMeter({
  level,
  label = "Microphone",
  className,
  color = "bg-violet-500",
  warningLevel = 0.85,
  peakHold = 0.7,
}: AudioLevelMeterProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [peak, setPeak] = useState(0);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    // smooth peak decay
    if (level > peak) {
      setPeak(level);
    } else {
      const decay = setInterval(() => {
        setPeak((p) => Math.max(0, p - 0.03));
      }, 60);
      return () => clearInterval(decay);
    }
  }, [level, peak]);

  useEffect(() => {
    setIsWarning(level >= warningLevel);
  }, [level, warningLevel]);

  const pct = Math.min(100, Math.round(level * 100));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200/60">
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", color, "transition-none")}
          style={{ width: `${pct}%` }}
          animate={{ backgroundColor: isWarning ? "#ef4444" : undefined }}
          transition={{ duration: 0.08 }}
        />
        {/* peak marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-slate-400/70"
          style={{ left: `${Math.min(100, peak * 100)}%`, transform: "translateX(-1px)" }}
        />
      </div>
      {isWarning && (
        <motion.p
          className="text-[10px] text-amber-600 font-medium flex items-center gap-1"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
        >
          High input level — move slightly away from microphone
        </motion.p>
      )}
    </div>
  );
}

// ---------- Calibration screen ----------

interface CalibrationStatus {
  camera: { ok: boolean; note?: string };
  microphone: { ok: boolean; note?: string };
  audio: { ok: boolean; note?: string };
  connection: { ok: boolean; note?: string };
}

interface CalibrationScreenProps {
  onPass: () => void;
  onRetry: () => void;
  monitor?: {
    cameraOk?: boolean;
    micOk?: boolean;
    audioOk?: boolean;
    connectionOk?: boolean;
  };
  className?: string;
}

export function CalibrationScreen({
  onPass,
  onRetry,
  monitor,
  className,
}: CalibrationScreenProps) {
  const [status, setStatus] = useState<CalibrationStatus>({
    camera: { ok: false },
    microphone: { ok: false },
    audio: { ok: false },
    connection: { ok: false },
  });
  const [step, setStep] = useState<"checking" | "feedback">("checking");

  // In real deployment we would poll actual media metrics.
  // Dev path: use monitor prop or fallback to simulated pass after a beat.
  useEffect(() => {
    if (!monitor) {
      const t = setTimeout(() => {
        setStatus({
          camera: { ok: true, note: "Good" },
          microphone: { ok: true, note: "Good" },
          audio: { ok: true, note: "Good" },
          connection: { ok: true, note: "Good" },
        });
        setStep("feedback");
      }, 1200);
      return () => clearTimeout(t);
    }

    // Honor explicit monitor flags if provided
    if (typeof monitor.cameraOk === "boolean") {
      setStatus((prev) => ({
        ...prev,
        camera: { ok: monitor.cameraOk, note: monitor.cameraOk ? "Good" : "Adjust lighting" },
      }));
    }
    if (typeof monitor.micOk === "boolean") {
      setStatus((prev) => ({
        ...prev,
        microphone: { ok: monitor.micOk, note: monitor.micOk ? "Good" : "Volume low" },
      }));
    }
    if (typeof monitor.audioOk === "boolean") {
      setStatus((prev) => ({
        ...prev,
        audio: { ok: monitor.audioOk, note: monitor.audioOk ? "Good" : "Check input" },
      }));
    }
    if (typeof monitor.connectionOk === "boolean") {
      setStatus((prev) => ({
        ...prev,
        connection: { ok: monitor.connectionOk, note: monitor.connectionOk ? "Good" : "Network weak" },
      }));
    }
    setStep("feedback");
  }, [monitor]);

  const allOk = Object.values(status).every((s) => s.ok);

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-6 py-10 px-4",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Calibration Check</h2>
        <p className="text-sm text-slate-500">
          We are verifying your camera, microphone, and connection before the interview.
        </p>
      </div>

      {/* status grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {[
          { key: "camera", label: "Camera", icon: "📷", color: "border-emerald-300 bg-emerald-50/60" },
          { key: "microphone", label: "Microphone", icon: "🎤", color: "border-emerald-300 bg-emerald-50/60" },
          { key: "audio", label: "Audio Quality", icon: "🔊", color: "border-emerald-300 bg-emerald-50/60" },
          { key: "connection", label: "Connection", icon: "🌐", color: "border-emerald-300 bg-emerald-50/60" },
        ].map((item) => {
          const st = status[item.key as keyof CalibrationStatus];
          const ok = st?.ok ?? false;
          return (
            <motion.div
              key={item.key}
              className={cn(
                "rounded-xl border px-4 py-3 flex items-center gap-3 transition-all",
                ok
                  ? "bg-emerald-50/40 border-emerald-200/70 shadow-sm"
                  : "bg-slate-50/80 border-slate-200/70",
              )}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className={cn("text-xs", ok ? "text-emerald-600" : "text-slate-500")}>
                  {st?.note ?? (ok ? "Good" : "Checking...")}
                </p>
              </div>
              {ok ? (
                <span className="text-emerald-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
              ) : (
                <span className="text-slate-300 animate-pulse">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* feedback */}
      <AnimatePresence>
        {step === "feedback" && (
          <motion.div
            className="w-full max-w-sm text-center space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {!allOk ? (
              <div className="bg-amber-50 border border-amber-200/70 rounded-xl px-4 py-3 text-sm text-amber-800">
                Some checks need attention.
                <br />
                <span className="text-amber-700">
                  {status.camera.ok ? "" : "Lighting appears insufficient — please move to a better-lit location. "}
                  {status.microphone.ok ? "" : "Your microphone volume is low — please move closer to the microphone. "}
                  {status.audio.ok ? "" : "Audio quality is poor — check your microphone input. "}
                  {status.connection.ok ? "" : "Network connection is weak — try a more stable connection."}
                </span>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200/70 rounded-xl px-4 py-3 text-sm text-emerald-800">
                All checks passed. Your device is ready for the interview.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onRetry} className="flex-1">
          {allOk ? "Re-check" : "Try Again"}
        </Button>
        <Button
          onClick={onPass}
          disabled={!allOk}
          className="flex-1"
        >
          Continue to Interview
        </Button>
      </div>
    </motion.div>
  );
}

// ---------- AI disclosure screen ----------

interface DisclosureScreenProps {
  onAccept: () => void;
  className?: string;
  persona?: string;
}

export function DisclosureScreen({ onAccept, className, persona }: DisclosureScreenProps) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-6 py-10 px-4 max-w-lg mx-auto",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 text-violet-700 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-3">Before We Begin</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {persona && (
            <span className="block text-slate-500 mb-2 not-italic italic">
              — {persona}
            </span>
          )}
          You are about to speak with an <strong>AI interview panel</strong>, not a human interviewer.
          Your responses will be analyzed to generate your interview assessment.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          This platform is designed to help you practice. The feedback is AI-generated and should be used as a
          complement to human interview preparation, not a replacement.
        </p>
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <Button onClick={onAccept} className="flex-1">
          I Understand, Begin Interview
        </Button>
      </div>
    </motion.div>
  );
}

// ---------- Preparation timer ----------

interface PreparationTimerProps {
  seconds: number;
  onComplete: () => void;
  label?: string;
  className?: string;
}

export function PreparationTimer({ seconds, onComplete, label = "Your interview begins in...", className }: PreparationTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) onComplete();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [started, remaining, onComplete]);

  const start = () => setStarted(true);

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-5 py-10 px-4",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {!started ? (
        <>
          <p className="text-sm text-slate-500 text-center max-w-xs">{label}</p>
          <Button onClick={start} size="lg" className="text-4xl font-mono tracking-tight px-12">
            {seconds}
          </Button>
          <p className="text-xs text-slate-400">seconds</p>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500 text-center max-w-xs">{label}</p>
          <motion.div
            className="text-7xl font-mono font-bold text-slate-800 tracking-tight"
            key={remaining}
            initial={{ scale: 1.15, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {remaining}
          </motion.div>
          <p className="text-xs text-slate-400">
            {remaining > 5 ? "Use this time to settle in, adjust your camera, and take a deep breath." : "Get ready..."}
          </p>
        </>
      )}
    </motion.div>
  );
}

// ---------- Interrupt button ----------

interface InterruptButtonProps {
  onInterrupt: () => void;
  disabled?: boolean;
  className?: string;
}

export function InterruptButton({ onInterrupt, disabled = false, className }: InterruptButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    if (disabled) return;
    setPressed(true);
    onInterrupt();
    setTimeout(() => setPressed(false), 300);
  };

  return (
    <motion.button
      onClick={handlePress}
      disabled={disabled}
      className={cn(
        "relative flex items-center gap-2 rounded-xl border border-violet-300/60 bg-violet-50/80 hover:bg-violet-100/90 shadow-sm transition-all active:scale-95",
        "text-violet-700 font-medium text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2",
        className,
      )}
      whileTap={{ scale: 0.95 }}
      animate={pressed ? { scale: [1, 0.95, 1] } : {}}
      transition={{ duration: 0.15 }}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m0 0a3 3 0 01-3 3m3-3a3 3 0 00-3-3m0 0a3 3 0 00-3 3m0 0h-3m4.5-9H9a3 3 0 01-3-3m0 0H6" />
      </svg>
      Interrupt AI
    </motion.button>
  );
}
