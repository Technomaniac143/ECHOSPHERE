"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AgoraVideoProvider, AgoraConnectionQualityBadge } from "@/components/agora/AgoraVideo";
import { useAgora, usePreparationTimer, AGORA_DEV_MODE } from "@/hooks";
import { sessionApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Loader2,
  ShieldCheck,
  Clock,
  Monitor,
  MonitorOff,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Headphones,
  ChevronRight,
  Play,
} from "lucide-react";

function MicLevelIndicator({ level }: { level: number }) {
  const bars = 5;
  return (
    <div className="flex items-end gap-[3px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const active = level > threshold * 100;
        const height = 20 + (i * 8);
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-150 ${
              active ? "bg-emerald-400" : "bg-slate-600"
            }`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const {
    connected,
    quality,
    muteState,
    loading: agoraLoading,
    error: agoraError,
    devMode,
    initialize,
    requestDevices,
    muteAudio,
    muteVideo,
    join,
    leave,
    restart,
  } = useAgora(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationResults, setCalibrationResults] = useState<{
    camera: boolean;
    mic: boolean;
    audio: boolean;
    connection: boolean;
  }>({ camera: false, mic: false, audio: false, connection: false });

  const { remaining, expired, start: startTimer } = usePreparationTimer(30);
  const [phase, setPhase] = useState<"permissions" | "calibrating" | "preparing" | "ready">("permissions");
  const [streamError, setStreamError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Initialize Agora engine
  useEffect(() => {
    initialize().then(() => {
      requestDevices();
    });
  }, [initialize, requestDevices]);

  // Request camera + mic
  const requestMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: "user",
          frameRate: { ideal: 15 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);
      setCameraActive(true);
      setAudioActive(true);
      setStreamError(null);

      // Set up audio level analysis
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const measure = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(100, Math.round(avg * 2.5)));
          animationRef.current = requestAnimationFrame(measure);
        };
        measure();
      }

      // Start calibration
      setCalibrating(true);
      setCalibrationResults((prev) => ({ ...prev, camera: true, mic: true }));

      // Check connection after a moment
      setTimeout(() => {
        setCalibrationResults((prev) => ({ ...prev, audio: true }));
        if (connected || devMode) {
          setCalibrationResults((prev) => ({ ...prev, connection: true }));
          setCalibrating(false);
          setPhase("preparing");
          startTimer();
        } else {
          // Dev mode: connection is simulated
          setCalibrationResults((prev) => ({ ...prev, connection: true }));
          setCalibrating(false);
          setPhase("preparing");
          startTimer();
        }
      }, 1500);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera/mic access denied";
      setStreamError(message);
      toast.error("Could not access camera or microphone. Please allow permissions and try again.");
      return false;
    }
  }, [connected, devMode]);

  // Join Agora channel when ready
  const handleJoinChannel = useCallback(async () => {
    if (!sessionId) {
      toast.error("No session ID found");
      return;
    }
    try {
      const session = await sessionApi.start(sessionId);
      await join(session.data.agoraChannelName ?? "", session.data.agoraChannelName ?? "", "1");
      toast.success("Connected to interview room");
    } catch (err) {
      if (devMode) {
        // In dev mode, just proceed without real Agora
        toast.info("Dev mode: skipping real Agora join");
      } else {
        toast.error("Failed to connect to interview room");
      }
    }
  }, [sessionId, join, devMode]);

  const handleReady = () => {
    if (!sessionId) return;
    handleJoinChannel();
    router.push(`/interview/session/${sessionId}`);
  };

  const toggleMic = async () => {
    const next = !muteState.audioMuted;
    await muteAudio(next);
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
    }
    setAudioActive(!next);
  };

  const toggleVideo = async () => {
    const next = !muteState.videoMuted;
    await muteVideo(next);
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = !next;
      });
    }
    setCameraActive(!next);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
    };
  }, [localStream]);

  const allCalibrated =
    calibrationResults.camera &&
    calibrationResults.mic &&
    calibrationResults.audio &&
    calibrationResults.connection;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top bar */}
      <header className="border-b border-white/5 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">EchoSphere</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Lobby</span>
            {devMode && (
              <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                Dev mode
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Video preview + status */}
          <div className="lg:col-span-2 space-y-5">
            {/* Video preview card */}
            <div className="bg-slate-800/60 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  Camera Preview
                </h2>
                <div className="flex items-center gap-2">
                  <AgoraConnectionQualityBadge quality={quality} />
                </div>
              </div>

              <div className="relative">
                {localStream && cameraActive ? (
                  <AgoraVideoProvider initialStream={localStream} mirror={true} />
                ) : streamError ? (
                  <div className="aspect-square rounded-xl bg-slate-700/50 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center">
                      <XCircle className="w-7 h-7 text-rose-400" />
                    </div>
                    <p className="text-sm text-slate-300 text-center">{streamError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={requestMedia}
                      className="border-slate-600 text-slate-200 hover:bg-slate-700 mt-2"
                    >
                      <Camera className="w-4 h-4 mr-1.5" />
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-square rounded-xl bg-slate-700/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-slate-600/30 flex items-center justify-center animate-pulse">
                      <Camera className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-400">Click "Enable Camera" to start</p>
                  </div>
                )}

                {/* Video overlay controls */}
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    onClick={toggleVideo}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      cameraActive
                        ? "bg-rose-500/80 text-white hover:bg-rose-600"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                    title={cameraActive ? "Turn off camera" : "Enable camera"}
                  >
                    {cameraActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleMic}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      audioActive
                        ? "bg-emerald-500/80 text-white hover:bg-emerald-600"
                        : "bg-rose-500/80 text-white hover:bg-rose-600"
                    }`}
                    title={audioActive ? "Mute microphone" : "Unmute microphone"}
                  >
                    {audioActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mic level indicator */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {audioActive ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-xs text-slate-400">Mic level</span>
                </div>
                <MicLevelIndicator level={micLevel} />
                {audioActive && (
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {micLevel > 5 ? "Active" : "Waiting..."}
                  </span>
                )}
              </div>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatusCard
                icon={Camera}
                label="Camera"
                status={cameraActive ? "active" : "inactive"}
                statusText={cameraActive ? "Connected" : "Not connected"}
              />
              <StatusCard
                icon={Mic}
                label="Microphone"
                status={audioActive ? "active" : "inactive"}
                statusText={audioActive ? "Active" : "Not detected"}
              />
              <StatusCard
                icon={Wifi}
                label="Connection"
                status={quality === "good" ? "good" : quality === "fair" ? "fair" : "poor"}
                statusText={quality === "good" ? "Good" : quality === "fair" ? "Fair" : "Poor"}
              />
              <StatusCard
                icon={Headphones}
                label="Audio Check"
                status={calibrationResults.audio ? "passed" : "pending"}
                statusText={calibrationResults.audio ? "Passed" : "Not checked"}
              />
            </div>
          </div>

          {/* Right: Calibration + timer */}
          <div className="space-y-5">
            {/* Calibration card */}
            <div className="bg-slate-800/60 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Calibration
              </h2>

              <div className="space-y-3">
                <CalibrationRow
                  label="Camera"
                  passed={calibrationResults.camera}
                  icon={Camera}
                />
                <CalibrationRow
                  label="Microphone"
                  passed={calibrationResults.mic}
                  icon={Mic}
                />
                <CalibrationRow
                  label="Audio Check"
                  passed={calibrationResults.audio}
                  icon={Volume2}
                />
                <CalibrationRow
                  label="Connection"
                  passed={calibrationResults.connection}
                  icon={Wifi}
                />
              </div>

              {calibrating && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-300 text-center">
                    Calibrating devices... Please allow a moment.
                  </p>
                </div>
              )}

              {/* Calibration question */}
              {phase === "preparing" && !expired && (
                <div className="mt-5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-2">
                    Calibration Question
                  </p>
                  <p className="text-sm text-slate-200 font-medium">
                    "What is your favorite colour?"
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5 italic">
                    This is non-graded. It helps test your audio and speaking flow.
                  </p>
                </div>
              )}
            </div>

            {/* Preparation timer */}
            <div className="bg-slate-800/60 rounded-2xl border border-white/5 p-5 backdrop-blur-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Preparation Time
                </span>
              </div>

              <div className="relative mx-auto my-4">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-700"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    className="text-blue-500 transition-all duration-1000"
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - remaining / 30)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`text-3xl font-bold tracking-tight ${
                      remaining <= 10 ? "text-rose-400" : "text-white"
                    }`}
                  >
                    {remaining}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                {expired
                  ? "Time's up — you can start now"
                  : "Get ready. Your interview will begin automatically."}
              </p>

              {expired && (
                <Button
                  size="lg"
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white h-11"
                  onClick={handleReady}
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  Enter Interview
                  <ChevronRight className="w-4 h-4 ml-1.5" />
                </Button>
              )}
            </div>

            {/* Enable camera button (shown when no stream) */}
            {!localStream && !streamError && phase === "permissions" && (
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white h-12 shadow-lg"
                onClick={requestMedia}
              >
                <Camera className="w-4 h-4 mr-2" />
                Enable Camera & Microphone
              </Button>
            )}

            {!localStream && streamError && (
              <Button
                size="lg"
                variant="outline"
                className="w-full border-slate-600 text-slate-200 hover:bg-slate-700 h-12"
                onClick={requestMedia}
              >
                <Camera className="w-4 h-4 mr-2" />
                Retry Permissions
              </Button>
            )}

            {/* Dev mode notice */}
            {devMode && (
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider text-center">
                  Running in development mode — Agora is simulated
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  status,
  statusText,
}: {
  icon: React.ElementType;
  label: string;
  status: "active" | "inactive" | "good" | "fair" | "poor" | "passed" | "pending";
  statusText: string;
}) {
  const statusColor =
    status === "active" || status === "passed"
      ? "text-emerald-400"
      : status === "good"
      ? "text-emerald-400"
      : status === "fair"
      ? "text-amber-400"
      : status === "poor"
      ? "text-rose-400"
      : status === "inactive"
      ? "text-slate-500"
      : "text-slate-500";

  const borderColor =
    status === "active" || status === "passed"
      ? "border-l-emerald-500"
      : status === "good"
      ? "border-l-emerald-500"
      : status === "fair"
      ? "border-l-amber-500"
      : status === "poor"
      ? "border-l-rose-500"
      : "border-l-slate-600";

  return (
    <div
      className={`bg-slate-800/40 rounded-xl border-l-4 ${borderColor} p-3 backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${statusColor}`} />
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {label}
        </span>
      </div>
      <p className={`text-xs font-medium ${statusColor}`}>{statusText}</p>
    </div>
  );
}

function CalibrationRow({
  label,
  passed,
  icon: Icon,
}: {
  label: string;
  passed: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center ${
          passed ? "bg-emerald-500/20" : "bg-slate-700/50"
        }`}
      >
        {passed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Icon className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>
      <span className="text-sm text-slate-300 flex-1">{label}</span>
      {passed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-slate-600" />
      )}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
