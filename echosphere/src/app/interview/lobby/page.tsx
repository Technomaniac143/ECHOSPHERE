"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AgoraConnectionQualityBadge } from "@/components/agora/AgoraVideo";
import { useAgora, usePreparationTimer, AGORA_DEV_MODE } from "@/hooks";
import { sessionApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Camera, Mic, MicOff, Video, VideoOff, Wifi, Loader2, ShieldCheck,
  Clock, CheckCircle2, Volume2, VolumeX, Headphones, ChevronRight, Play, AlertTriangle,
} from "lucide-react";

// ─── Mic Level Bars ────────────────────────────────────────────────────────────
function MicLevelIndicator({ level }: { level: number }) {
  const bars = 6;
  const heights = [8, 10, 13, 16, 13, 10];
  return (
    <div className="flex items-end gap-[3px] h-5">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = ((i + 1) / bars) * 100;
        const active = level >= threshold;
        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-100",
              active
                ? i < 4 ? "bg-emerald-500" : "bg-amber-400"
                : "bg-border"
            )}
            style={{ height: heights[i] }}
          />
        );
      })}
    </div>
  );
}

// ─── Status Card ───────────────────────────────────────────────────────────────
function StatusCard({ icon: Icon, label, status, statusText }: {
  icon: React.ElementType;
  label: string;
  status: "active" | "inactive" | "good" | "fair" | "poor" | "passed" | "pending";
  statusText: string;
}) {
  const isPositive = status === "active" || status === "passed" || status === "good";
  const isFair = status === "fair";
  const isBad = status === "poor";

  const textColor = isPositive ? "text-emerald-500" : isFair ? "text-amber-500" : isBad ? "text-destructive" : "text-muted-foreground";
  const borderColor = isPositive ? "border-l-emerald-500" : isFair ? "border-l-amber-500" : isBad ? "border-l-destructive" : "border-l-border";
  const dotColor = isPositive ? "bg-emerald-500" : isFair ? "bg-amber-500" : isBad ? "bg-destructive" : "bg-muted-foreground/30";

  return (
    <div className={cn("bg-card rounded-xl border border-border border-l-4 p-3", borderColor)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-3.5 h-3.5", textColor)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <div className={cn("w-1.5 h-1.5 rounded-full ml-auto", dotColor, isPositive && "animate-pulse")} />
      </div>
      <p className={cn("text-xs font-medium", textColor)}>{statusText}</p>
    </div>
  );
}

// ─── Calibration Row ──────────────────────────────────────────────────────────
function CalibrationRow({ label, passed, pending, icon: Icon }: {
  label: string; passed: boolean; pending?: boolean; icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
        passed ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
          : pending ? "bg-amber-500/10"
          : "bg-muted"
      )}>
        {passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          : pending ? <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          : <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <span className={cn("text-sm flex-1 transition-colors duration-300", passed ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {passed
        ? <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">OK</span>
        : <div className="w-3 h-3 rounded-full border border-border" />}
    </div>
  );
}

// ─── Inline Video Preview ─────────────────────────────────────────────────────
function VideoPreview({ stream, mirror = true }: { stream: MediaStream | null; mirror?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      if (video.srcObject !== stream) { video.srcObject = stream; video.play().catch(() => {}); }
    } else {
      video.srcObject = null;
    }
  }, [stream]);
  return (
    <video
      ref={videoRef} autoPlay playsInline muted
      className={cn(
        "w-full h-full object-cover transition-opacity duration-500",
        stream ? "opacity-100" : "opacity-0",
        mirror && "scale-x-[-1]"
      )}
    />
  );
}

// ─── Main Lobby Content ───────────────────────────────────────────────────────
function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";
  const { quality, devMode, initialize, requestDevices, muteAudio, muteVideo, join } = useAgora(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [mediaRequested, setMediaRequested] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationResults, setCalibrationResults] = useState({ camera: false, mic: false, audio: false, connection: false });
  const { remaining, expired, start: startTimer } = usePreparationTimer(30);
  const [phase, setPhase] = useState<"permissions" | "calibrating" | "preparing">("permissions");

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const initDone = useRef(false);

  const stopAudioAnalysis = useCallback(() => {
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;
    setMicLevel(0);
  }, []);

  const requestMedia = useCallback(async () => {
    if (mediaLoading) return;
    setMediaLoading(true);
    setStreamError(null);
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    stopAudioAnalysis();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user", frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setLocalStream(stream);
      setCameraActive(true);
      setAudioActive(true);
      setMediaRequested(true);
      setStreamError(null);

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const measure = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(100, Math.round(avg * 2.5)));
          animationRef.current = requestAnimationFrame(measure);
        };
        measure();
      }

      setCalibrating(true);
      setPhase("calibrating");
      setCalibrationResults({ camera: false, mic: false, audio: false, connection: false });
      setTimeout(() => setCalibrationResults((p) => ({ ...p, camera: true })), 600);
      setTimeout(() => setCalibrationResults((p) => ({ ...p, mic: true })), 1200);
      setTimeout(() => setCalibrationResults((p) => ({ ...p, audio: true })), 1800);
      setTimeout(() => {
        setCalibrationResults((p) => ({ ...p, connection: true }));
        setCalibrating(false);
        setPhase("preparing");
        startTimer();
      }, 2400);

      setMediaLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera/mic access denied";
      setStreamError(msg);
      setMediaLoading(false);
      setMediaRequested(true);
      toast.error("Could not access camera or microphone. Please allow permissions.");
    }
  }, [localStream, mediaLoading, startTimer, stopAudioAnalysis]);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    initialize().then(() => requestDevices());
    const t = setTimeout(() => requestMedia(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      localStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    const newActive = !cameraActive;
    localStream.getVideoTracks().forEach((t) => { t.enabled = newActive; });
    setCameraActive(newActive);
    await muteVideo(!newActive);
  }, [localStream, cameraActive, muteVideo]);

  const toggleAudio = useCallback(async () => {
    if (!localStream) return;
    const newActive = !audioActive;
    localStream.getAudioTracks().forEach((t) => { t.enabled = newActive; });
    setAudioActive(newActive);
    await muteAudio(!newActive);
  }, [localStream, audioActive, muteAudio]);

  const handleReady = useCallback(async () => {
    if (!sessionId) { toast.error("No session ID found"); return; }
    try {
      const session = await sessionApi.start(sessionId);
      await join(session.data?.agoraChannelName ?? sessionId, session.data?.agoraChannelName ?? sessionId, "1");
      toast.success("Entering interview room…");
    } catch {
      if (devMode) toast.info("Dev mode: proceeding to interview");
      else toast.error("Failed to connect — entering anyway");
    }
    router.push(`/interview/session/${sessionId}`);
  }, [sessionId, join, devMode, router]);

  const showVideoFeed = !!localStream && cameraActive;
  const allCalibrated = calibrationResults.camera && calibrationResults.mic && calibrationResults.audio && calibrationResults.connection;

  // Timer ring colour: uses primary when >15s, amber 5-15s, destructive <=5s
  const timerColor = remaining <= 5 ? "text-destructive" : remaining <= 15 ? "text-amber-500" : "text-primary";
  const timerTextColor = remaining <= 5 ? "text-destructive" : remaining <= 15 ? "text-amber-500" : "text-foreground";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground text-sm font-bold">E</span>
            </div>
            <span className="text-foreground font-semibold text-sm tracking-tight">EchoSphere</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Interview Lobby</span>
            {devMode && (
              <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                Dev mode
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Left: Camera Preview (3/5) ── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">

              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  Camera Preview
                </h2>
                <AgoraConnectionQualityBadge quality={quality} />
              </div>

              {/* Video container */}
              <div className="relative aspect-video bg-muted">
                <VideoPreview stream={showVideoFeed ? localStream : null} mirror />

                {/* Placeholder overlay */}
                {!showVideoFeed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    {mediaLoading ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Loader2 className="w-7 h-7 text-primary animate-spin" />
                        </div>
                        <p className="text-sm text-muted-foreground animate-pulse">Requesting camera access…</p>
                      </>
                    ) : streamError ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                          <AlertTriangle className="w-7 h-7 text-destructive" />
                        </div>
                        <div className="text-center px-6">
                          <p className="text-sm text-destructive mb-1">Camera access denied</p>
                          <p className="text-xs text-muted-foreground max-w-xs">{streamError}</p>
                        </div>
                        <button
                          onClick={requestMedia}
                          className="mt-1 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm border border-border transition-all flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" /> Retry
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center animate-pulse">
                          <Camera className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">Waiting for camera…</p>
                        {mediaRequested && (
                          <button
                            onClick={requestMedia}
                            className="mt-1 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-sm transition-all flex items-center gap-2"
                          >
                            <Camera className="w-4 h-4" /> Enable Camera
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* "You" label */}
                {showVideoFeed && (
                  <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider text-foreground/60 bg-background/60 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-border/40">
                    You
                  </div>
                )}

                {/* Controls */}
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    onClick={toggleVideo}
                    disabled={!localStream}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40",
                      showVideoFeed
                        ? "bg-destructive/80 hover:bg-destructive text-white"
                        : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                    )}
                    title={cameraActive ? "Turn off camera" : "Enable camera"}
                  >
                    {cameraActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleAudio}
                    disabled={!localStream}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40",
                      audioActive
                        ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                        : "bg-destructive/80 hover:bg-destructive text-white"
                    )}
                    title={audioActive ? "Mute microphone" : "Unmute microphone"}
                  >
                    {audioActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mic level */}
              <div className="flex items-center gap-3 px-5 py-3 border-t border-border">
                {audioActive
                  ? <Volume2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  : <VolumeX className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Mic level</span>
                <MicLevelIndicator level={audioActive ? micLevel : 0} />
                {audioActive && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {micLevel > 5 ? "Detecting audio" : "Listening…"}
                  </span>
                )}
              </div>
            </div>

            {/* Status grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatusCard icon={Camera} label="Camera" status={cameraActive ? "active" : "inactive"} statusText={cameraActive ? "Connected" : "Offline"} />
              <StatusCard icon={Mic} label="Mic" status={audioActive ? "active" : "inactive"} statusText={audioActive ? "Active" : "Muted"} />
              <StatusCard icon={Wifi} label="Network"
                status={quality === "good" ? "good" : quality === "fair" ? "fair" : "poor"}
                statusText={quality === "good" ? "Excellent" : quality === "fair" ? "Fair" : "Poor"} />
              <StatusCard icon={Headphones} label="Audio" status={calibrationResults.audio ? "passed" : "pending"} statusText={calibrationResults.audio ? "Passed" : "Checking…"} />
            </div>
          </div>

          {/* ── Right: System Check + Timer (2/5) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* System Check card */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                System Check
                {calibrating && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin ml-auto" />}
                {allCalibrated && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
              </h2>

              <div className="divide-y divide-border">
                <CalibrationRow label="Camera" passed={calibrationResults.camera} pending={calibrating && !calibrationResults.camera} icon={Camera} />
                <CalibrationRow label="Microphone" passed={calibrationResults.mic} pending={calibrating && calibrationResults.camera && !calibrationResults.mic} icon={Mic} />
                <CalibrationRow label="Audio Output" passed={calibrationResults.audio} pending={calibrating && calibrationResults.mic && !calibrationResults.audio} icon={Volume2} />
                <CalibrationRow label="Connection" passed={calibrationResults.connection} pending={calibrating && calibrationResults.audio && !calibrationResults.connection} icon={Wifi} />
              </div>

              {!mediaRequested && !mediaLoading && (
                <Button className="mt-5 w-full" onClick={requestMedia}>
                  <Camera className="w-4 h-4 mr-2" />
                  Enable Camera &amp; Microphone
                </Button>
              )}

              {phase === "preparing" && !expired && (
                <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <p className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-1">Warm-up question</p>
                  <p className="text-sm text-foreground leading-relaxed">"What is your favorite colour?"</p>
                  <p className="text-[10px] text-muted-foreground mt-1 italic">Non-graded — helps calibrate your audio &amp; speaking flow.</p>
                </div>
              )}
            </div>

            {/* Preparation Timer card */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Preparation Time</span>
              </div>

              <div className="flex items-center gap-5">
                {/* Circular timer */}
                <div className="relative flex-shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    {/* Track */}
                    <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-border" strokeWidth="3.5" />
                    {/* Progress */}
                    <circle
                      cx="40" cy="40" r="34" fill="none" stroke="currentColor"
                      className={cn("transition-all duration-1000", timerColor)}
                      strokeWidth="3.5"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - remaining / 30)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-2xl font-bold tracking-tight", timerTextColor)}>
                      {remaining}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {expired
                      ? "Time is up — you are ready to start."
                      : phase === "preparing"
                      ? "Use this time to compose yourself."
                      : "Waiting for system check…"}
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full mt-5 h-11"
                onClick={handleReady}
              >
                <Play className="w-4 h-4 mr-2" />
                {expired ? "Enter Interview" : "I'm Ready — Enter Now"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>

              {devMode && (
                <p className="text-[10px] text-muted-foreground/50 text-center mt-3 uppercase tracking-wider">
                  Agora simulated — dev mode
                </p>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Preparing lobby…</p>
        </div>
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
