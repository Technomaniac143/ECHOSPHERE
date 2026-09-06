"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useAgora, type ConnectionQuality } from "@/hooks";
import { AGORA_DEV_MODE } from "@/hooks";
import { Video, Mic, MicOff, Wifi as WifiIcon, WifiOff, EyeOff, Monitor, Cpu } from "lucide-react";

interface AgoraVideoProps {
  stream?: MediaStream | null;
  className?: string;
  mirror?: boolean;
  aspect?: "1:1" | "4:3" | "16:9";
  placeholder?: React.ReactNode;
  showLabel?: boolean;
}

export function AgoraVideo({
  stream,
  className,
  mirror = true,
  aspect = "1:1",
  placeholder,
  showLabel = true,
}: AgoraVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const aspectClass = {
    "1:1": "aspect-square",
    "4:3": "aspect-[4/3]",
    "16:9": "aspect-video",
  }[aspect];

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden bg-slate-900 shadow-lg ring-1 ring-slate-700/40",
        aspectClass,
        className,
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full h-full object-cover",
          mirror && "scale-x-[-1]",
        )}
      />
      {!stream && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/60 backdrop-blur-sm">
          {placeholder}
        </div>
      )}

      {showLabel && (
        <div className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider text-white/70 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur">
          {stream ? "Candidate" : "Waiting for camera"}
        </div>
      )}
    </div>
  );
}

interface AgoraVideoProviderProps {
  /** Pre-requested device stream so the UI can render immediately */
  initialStream?: MediaStream | null;
  onStreamChange?: (stream: MediaStream | null) => void;
  mirror?: boolean;
  className?: string;
  showPlaceholder?: boolean;
}

export function AgoraVideoProvider({
  initialStream,
  onStreamChange,
  mirror = true,
  className,
  showPlaceholder = true,
}: AgoraVideoProviderProps) {
  const [stream, setStream] = useState<MediaStream | null>(initialStream ?? null);
  const [loading, setLoading] = useState(!initialStream);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (initialStream) {
      setStream(initialStream);
      setLoading(false);
      setError(null);
    }
  }, [initialStream]);


  const request = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: "user",
          frameRate: { ideal: 15 },
        },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current) return;
      setStream(s);
      onStreamChange?.(s);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Camera/mic access denied";
      setError(message);
      setError(message);
      setStream(null);
      onStreamChange?.(null);
      setLoading(false);
    }
  }, [onStreamChange]);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (mountedRef.current) setStream(null);
      onStreamChange?.(null);
    }
  }, [stream, onStreamChange]);

  const placeholder = (
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-700/60">
        {loading ? (
          <span className="animate-pulse">📷</span>
        ) : error ? (
          <span className="text-sm">⚠️</span>
        ) : (
          <Video className="w-6 h-6" />
        )}
      </div>
      <div className="text-center">
        {loading && <p className="text-xs animate-pulse">Requesting camera...</p>}
        {error && <p className="text-xs text-rose-300">{error}</p>}
        {!loading && !error && (
          <p className="text-xs">Camera inactive</p>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      <AgoraVideo
        stream={stream}
        mirror={mirror}
        aspect="1:1"
        placeholder={showPlaceholder ? placeholder : undefined}
      />
      {/* controls overlay */}
      <div className="absolute top-2 right-2 flex gap-1">
        {error ? (
          <button
            onClick={request}
            className="bg-black/50 text-white text-xs px-2 py-1 rounded-md backdrop-blur border border-white/10 hover:bg-black/70 transition-colors"
          >
            Fix camera
          </button>
        ) : (
          <button
            onClick={stop}
            className="bg-black/40 text-white text-xs px-2 py-1 rounded-md backdrop-blur border border-white/10 hover:bg-black/60 transition-colors"
          >
            Stop camera
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Connection quality indicator ----------

interface AgoraConnectionQualityBadgeProps {
  quality: ConnectionQuality;
  className?: string;
}

const qualityMeta: Record<ConnectionQuality, { label: string; color: string; icon: React.ReactNode }> = {
  good: { label: "GOOD", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", icon: <WifiIcon className="w-3.5 h-3.5" /> },
  fair: { label: "FAIR", color: "text-amber-400 border-amber-500/40 bg-amber-500/10", icon: <WifiIcon className="w-3.5 h-3.5" /> },
  poor: { label: "POOR", color: "text-rose-400 border-rose-500/40 bg-rose-500/10", icon: <WifiOff className="w-3.5 h-3.5" /> },
  unavailable: { label: "OFFLINE", color: "text-slate-400 border-slate-500/30 bg-slate-500/5", icon: <Cpu className="w-3.5 h-3.5" /> },
};

export function AgoraConnectionQualityBadge({ quality, className }: AgoraConnectionQualityBadgeProps) {
  const meta = qualityMeta[quality] ?? qualityMeta.unavailable;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wider shadow-sm transition-colors",
        meta.color,
        className,
      )}
    >
      {meta.icon}
      {meta.label}
    </div>
  );
}

// ---------- Agora status bar (mic, video, quality, screen) ----------

interface AgoraStatusBarProps {
  audioMuted: boolean;
  videoMuted: boolean;
  quality: ConnectionQuality;
  screenSharing?: boolean;
  onToggleMic?: () => void;
  onToggleVideo?: () => void;
  onToggleScreen?: () => void;
  className?: string;
}

export function AgoraStatusBar({
  audioMuted,
  videoMuted,
  quality,
  screenSharing = false,
  onToggleMic,
  onToggleVideo,
  onToggleScreen,
  className,
}: AgoraStatusBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-xl px-3 py-2 border border-white/5 shadow-lg",
        className,
      )}
    >
      {/* mic */}
      <button
        onClick={onToggleMic}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all hover:bg-white/10",
          audioMuted ? "text-rose-300" : "text-emerald-300",
        )}
        title={audioMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {audioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {audioMuted ? "Muted" : "Mic"}
      </button>

      {/* video */}
      <button
        onClick={onToggleVideo}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all hover:bg-white/10",
          videoMuted ? "text-rose-300" : "text-emerald-300",
        )}
        title={videoMuted ? "Enable camera" : "Disable camera"}
      >
        {videoMuted ? <Video className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        {videoMuted ? "Video off" : "Camera"}
      </button>

      {/* divider */}
      <div className="w-px h-5 bg-white/10" />

      {/* quality */}
      <AgoraConnectionQualityBadge quality={quality} />

      {/* divider */}
      <div className="w-px h-5 bg-white/10" />

      {/* screen share */}
      <button
        onClick={onToggleScreen}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all hover:bg-white/10",
          screenSharing ? "text-violet-300" : "text-slate-300",
        )}
        title={screenSharing ? "Stop sharing" : "Share screen"}
      >
        <Monitor className="w-4 h-4" />
        {screenSharing ? "Sharing" : "Share"}
      </button>

      {/* dev label */}
      {AGORA_DEV_MODE && (
        <div className="ml-auto text-[10px] uppercase tracking-wider text-slate-500/70 bg-white/5 px-2 py-0.5 rounded-full">
          Dev mode
        </div>
      )}
    </div>
  );
}
