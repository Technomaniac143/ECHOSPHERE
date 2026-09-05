"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PersonaKey } from "@/types";
import { PERSONAS } from "@/types";

interface PersonaIndicatorProps {
  persona: PersonaKey;
  phase?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const dotSize = { sm: "w-2 h-2", md: "w-2.5 h-2.5", lg: "w-3 h-3" };

export function PersonaIndicator({ persona, phase, size = "md", className }: PersonaIndicatorProps) {
  const meta = PERSONAS[persona] ?? PERSONAS.technical;
  const dot = dotSize[size];

  return (
    <motion.div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 border transition-all",
        "bg-white/80 backdrop-blur-sm border-slate-200/80 shadow-sm",
        className,
      )}
      layout
      animate={{ boxShadow: `0 0 0 2px ${meta.color}22` }}
      transition={{ duration: 0.3 }}
    >
      <span className={cn("rounded-full flex-shrink-0", dot, "bg-[", meta.color, "] shadow-[0_0_6px_", meta.color, "]")} />
      <span className="text-sm font-medium text-slate-800">
        {meta.label}
      </span>
      {phase && (
        <span className="text-xs text-slate-500 ml-1">
          · {phase}
        </span>
      )}
    </motion.div>
  );
}

interface PersonaLegendProps {
  activePersona: PersonaKey;
  personas?: PersonaKey[];
  className?: string;
}

export function PersonaLegend({ activePersona, personas = ["technical", "product", "hiring_manager", "behavioral"], className }: PersonaLegendProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 justify-center", className)}>
      {personas.map((p) => {
        const meta = PERSONAS[p];
        const active = p === activePersona;
        return (
          <motion.div
            key={p}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all cursor-default",
              active
                ? "bg-white/95 border-violet-300 shadow-sm text-slate-800"
                : "bg-white/50 border-slate-200/70 text-slate-500",
            )}
            animate={active ? { scale: 1.04 } : {}}
            transition={{ duration: 0.2 }}
          >
            <span className={cn("w-2 h-2 rounded-full", active ? "shadow-[0_0_6px_currentColor]" : "", {
              "bg-blue-500": p === "technical",
              "bg-violet-500": p === "product",
              "bg-amber-500": p === "hiring_manager",
              "bg-emerald-500": p === "behavioral",
              "bg-pink-500": p === "customer",
            })}
            />
            {meta.label}
          </motion.div>
        );
      })}
    </div>
  );
}
