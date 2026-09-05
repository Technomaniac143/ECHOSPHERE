"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PersonaKey } from "@/types";
import { PERSONAS } from "@/types";

interface InterviewAvatarProps {
  persona: PersonaKey;
  speaking?: boolean;
  listening?: boolean;
  thinking?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { container: "w-14 h-14", ring: "w-16 h-16" },
  md: { container: "w-20 h-20", ring: "w-24 h-24" },
  lg: { container: "w-28 h-28", ring: "w-32 h-32" },
};

export function InterviewAvatar({ persona, speaking, listening, thinking, size = "md", className }: InterviewAvatarProps) {
  const meta = PERSONAS[persona] ?? PERSONAS.technical;
  const s = sizeMap[size];

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* glow ring */}
      <motion.div
        className={cn(
          "absolute rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-500/20",
          s.ring,
        )}
        animate={speaking ? { scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9] } : listening ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 1.4, repeat: speaking ? Infinity : 0 }}
      >
        {/* primary ring pulse */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border",
            speaking && "border-violet-400/50 shadow-lg shadow-violet-500/20 animate-pulse",
            listening && "border-emerald-400/50",
            thinking && "border-amber-400/50 animate-pulse",
            !speaking && !listening && !thinking && "border-violet-400/20",
          )}
        />
      </motion.div>

      {/* avatar core */}
      <motion.div
        className={cn(
          "relative z-10 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shadow-lg",
          s.container,
          "bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600",
        )}
        style={{ boxShadow: `0 0 24px ${meta.color}33` }}
      >
        <span className="text-lg">{meta.name[0]}</span>
      </motion.div>

      {/* status badge */}
      <div className="absolute bottom-0 right-0 z-20 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200/60 shadow-sm">
        {speaking && (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span className="text-[10px] uppercase tracking-wide">Speaking</span>
          </>
        )}
        {listening && (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse inline-flex h-full w-full rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] uppercase tracking-wide">Listening</span>
          </>
        )}
        {thinking && !speaking && (
          <>
            <span className="inline-flex">
              <span className="animate-spin inline-block h-[10px] w-[10px] rounded-full border-2 border-slate-400 border-t-violet-500" />
            </span>
            <span className="text-[10px] uppercase tracking-wide">Thinking</span>
          </>
        )}
        {!speaking && !listening && !thinking && (
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Waiting</span>
        )}
      </div>
    </div>
  );
}
