"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PersonaKey } from "@/types";

interface TranscriptTurn {
  id: string;
  speaker: "candidate" | "agent";
  persona?: PersonaKey | null;
  text: string;
  tsStart: string;
  tsEnd?: string | null;
}

interface TranscriptPanelProps {
  turns: TranscriptTurn[];
  activePersona?: PersonaKey;
  listening?: boolean;
  speaking?: boolean;
  thinking?: boolean;
  className?: string;
  onScrollToEnd?: () => void;
}

export function TranscriptPanel({
  turns,
  activePersona,
  listening,
  speaking,
  thinking,
  className,
  onScrollToEnd,
}: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [turns, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        "relative flex flex-col h-full max-h-[320px] overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur-sm shadow-sm",
        className,
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Transcript</span>
          {activePersona && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              {activePersona}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {listening && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Listening
            </span>
          )}
          {speaking && (
            <span className="inline-flex items-center gap-1 text-xs text-violet-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              Speaking
            </span>
          )}
          {thinking && !speaking && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
              <span className="inline-block h-2 w-2 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              Thinking
            </span>
          )}
        </div>
      </div>

      {/* transcript lines */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth">
        <AnimatePresence mode="popLayout">
          {turns.map((turn, i) => {
            const isLast = i === turns.length - 1;
            return (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "relative flex gap-2.5",
                  isLast && listening && "bg-emerald-50/70 rounded-lg px-3 py-1.5 -mx-1.5",
                )}
              >
                {/* speaker tag */}
                <div
                  className={cn(
                    "flex-shrink-0 self-start mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm border",
                    turn.speaker === "agent"
                      ? "bg-violet-100 text-violet-700 border-violet-200"
                      : "bg-slate-100 text-slate-600 border-slate-200",
                  )}
                >
                  {turn.speaker === "agent" && (turn.persona ?? "agent")}
                  {turn.speaker === "candidate" && "You"}
                </div>

                {/* bubble */}
                <div
                  className={cn(
                    "flex-1 text-sm leading-relaxed break-words",
                    turn.speaker === "agent"
                      ? "text-slate-800 bg-violet-50/40 rounded-2xl px-4 py-2.5 border border-violet-100/50 shadow-sm"
                      : "text-slate-700 bg-white rounded-2xl px-4 py-2.5 border border-slate-200/70 shadow-sm",
                  )}
                >
                  {turn.text}
                </div>

                {/* timestamp */}
                {turn.tsStart && (
                  <span className="absolute bottom-0 right-3 text-[10px] text-slate-400 font-mono">
                    {formatTs(turn.tsStart)}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* listening indicator */}
        {listening && turns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-20 text-slate-400">
            <motion.div
              className="flex items-center gap-1"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <span className="text-xl">🎤</span>
              <span className="text-sm">Listening...</span>
            </motion.div>
          </div>
        )}

        {speaking && turns.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-violet-600 px-1 py-1 bg-violet-50/40 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            AI speaking
          </div>
        )}
      </div>

      {/* scroll hint */}
      <button
        onClick={() => {
          setAutoScroll(true);
          if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
          onScrollToEnd?.();
        }}
        className="absolute bottom-2 right-2 text-xs text-slate-400 hover:text-slate-600 bg-white/80 backdrop-blur px-2 py-1 rounded-md border border-slate-200/60 transition-colors"
      >
        Scroll to latest
      </button>
    </div>
  );
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${m}:${s}`;
  } catch {
    return ts;
  }
}
