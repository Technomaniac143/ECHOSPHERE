"use client";

import { useRef, useEffect, useState } from "react";
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, ArcElement, CategoryScale, Legend, Tooltip, registerables } from "chart.js";
import { cn } from "@/lib/utils";

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, ArcElement, CategoryScale, Legend, Tooltip, ...registerables);

interface RadarChartProps {
  data: Array<{ label: string; score: number }>;
  max?: number;
  size?: number;
  showLabels?: boolean;
  title?: string;
  className?: string;
}

const defaultPalette = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#84cc16", // lime
  "#f97316", // orange
];

export function RadarChart({
  data,
  max = 100,
  size = 220,
  showLabels = true,
  title,
  className,
}: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "radar",
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            data: data.map((d) => d.score),
            backgroundColor: "rgba(99,102,241,0.18)",
            borderColor: "#6366f1",
            borderWidth: 2,
            pointBackgroundColor: defaultPalette.slice(0, data.length),
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw}/100`,
            },
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            max,
            ticks: {
              stepSize: max <= 100 ? 20 : 10,
              display: false,
            },
            grid: {
              color: "rgba(148,163,184,0.25)",
            },
            angleLines: {
              color: "rgba(148,163,184,0.25)",
            },
            pointLabels: {
              display: showLabels,
              font: { size: 11, weight: 500 },
              color: "#334155",
            },
          },
        },
      },
    });

    return () => {
      chart.destroy();
    };
  }, [data, max, showLabels]);

  return (
    <div className={cn("w-full max-w-xs", className)}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
      )}
      <div className="relative" style={{ height: size }}>
        <canvas ref={canvasRef} />
        {/* center score */}
        {(data.length > 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">
                {Math.round(data.reduce((a, d) => a + d.score, 0) / data.length)}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                avg
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Bar chart (horizontal) ----------

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  max?: number;
  size?: "sm" | "md" | "lg";
  title?: string;
  showValues?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

const sizeMap = {
  sm: { barHeight: 10, labelSize: 11, valueSize: 11, gap: 6 },
  md: { barHeight: 14, labelSize: 12, valueSize: 12, gap: 8 },
  lg: { barHeight: 18, labelSize: 13, valueSize: 13, gap: 10 },
};

export function BarChart({
  data,
  max = 100,
  size = "md",
  title,
  showValues = true,
  orientation = "horizontal",
  className,
}: BarChartProps) {
  const { barHeight, labelSize, valueSize, gap } = sizeMap[size];
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("w-full", className)}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      )}
      <div className="space-y-2">
        {data.map((item, i) => {
          const pct = (item.value / maxVal) * 100;
          const color = item.color ?? defaultPalette[i % defaultPalette.length];
          return (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600 w-28 shrink-0 text-right">
                {item.label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full")}
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 * i }}
                />
              </div>
              {showValues && (
                <span className="text-xs font-mono text-slate-500 w-8 text-right">
                  {item.value}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// animate import
import { motion } from "framer-motion";
