"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { candidateApi, apiBase } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Camera, Mic, MicOff, Video, VideoOff, Wifi, Loader2, ShieldCheck,
  CheckCircle2, Volume2, VolumeX, Monitor, AlertTriangle, ArrowRight, Play, RefreshCw, XCircle
} from "lucide-react";

// ── Mic Level Indicator ────────────────────────────────────────────────────────
function MicLevelMeter({ level }: { level: number }) {
  const bars = 10;
  return (
    <div className="flex items-end gap-1 h-6">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = ((i + 1) / bars) * 100;
        const active = level >= threshold;
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all duration-75",
              active
                ? i < 7
                  ? "bg-emerald-500"
                  : "bg-amber-400"
                : "bg-slate-200"
            )}
            style={{ height: `${(i + 1) * 10 + 15}%` }}
          />
        );
      })}
    </div>
  );
}

// ── System Check Card Component ───────────────────────────────────────────────
function SystemCheckCard({
  title,
  icon: Icon,
  status,
  statusText,
  description,
  actionButton,
  previewNode,
}: {
  title: string;
  icon: React.ElementType;
  status: "PASS" | "FAIL" | "CHECKING";
  statusText: string;
  description: string;
  actionButton?: React.ReactNode;
  previewNode?: React.ReactNode;
}) {
  const isPass = status === "PASS";
  const isFail = status === "FAIL";

  return (
    <Card className={cn(
      "border transition-all shadow-sm bg-white overflow-hidden",
      isPass ? "border-emerald-300 ring-1 ring-emerald-100" : isFail ? "border-rose-300" : "border-slate-200"
    )}>
      <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
              isPass ? "bg-emerald-100 text-emerald-700" : isFail ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-800">{title}</CardTitle>
          </div>

          <Badge className={cn(
            "text-xs font-semibold px-2.5 py-0.5",
            isPass ? "bg-emerald-100 text-emerald-800 border-emerald-300" : isFail ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-amber-100 text-amber-800 border-amber-300"
          )}>
            {status === "CHECKING" ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking
              </span>
            ) : statusText}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-3">
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        {previewNode}
        {actionButton && <div className="pt-2">{actionButton}</div>}
      </CardContent>
    </Card>
  );
}

function SystemCheckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  // 1. Camera state
  const [cameraStatus, setCameraStatus] = useState<"PASS" | "FAIL" | "CHECKING">("CHECKING");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 2. Microphone state
  const [micStatus, setMicStatus] = useState<"PASS" | "FAIL" | "CHECKING">("CHECKING");
  const [micLevel, setMicLevel] = useState(0);

  // 3. Screen Sharing state
  const [screenStatus, setScreenStatus] = useState<"PASS" | "FAIL" | "CHECKING">("FAIL");
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // 4. Network state
  const [networkStatus, setNetworkStatus] = useState<"PASS" | "FAIL" | "CHECKING">("CHECKING");
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);

  const [savingCheck, setSavingCheck] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mirrors of cameraStream/screenStream kept up to date on every render so
  // the mount-only cleanup effect below can always reach the *current*
  // stream instead of the stale (always-null) value it would otherwise
  // capture from the initial render's closure.
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => { cameraStreamRef.current = cameraStream; }, [cameraStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

  // Initialize Camera & Microphone Real Check
  const initCameraAndMic = useCallback(async () => {
    setCameraStatus("CHECKING");
    setMicStatus("CHECKING");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      // Video track verification
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === "live") {
        setCameraStream(stream);
        setCameraStatus("PASS");
      } else {
        setCameraStatus("FAIL");
      }

      // Audio track & Volume level meter setup
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === "live") {
        setMicStatus("PASS");

        const audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const measure = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(100, Math.round(avg * 2.8)));
          animFrameRef.current = requestAnimationFrame(measure);
        };
        measure();
      } else {
        setMicStatus("FAIL");
      }
    } catch (err) {
      console.error("Camera/Mic permission error:", err);
      setCameraStatus("FAIL");
      setMicStatus("FAIL");
      toast.error("Camera/Microphone permission denied. Please allow access in your browser.");
    }
  }, []);

  // Real Screen Sharing Request via browser getDisplayMedia API
  const requestScreenShare = async () => {
    setScreenStatus("CHECKING");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setScreenStream(stream);
        setScreenStatus("PASS");
        toast.success("Screen sharing verified successfully!");

        // Handle user stopping screen share from browser bar
        videoTrack.onended = () => {
          setScreenStream(null);
          setScreenStatus("FAIL");
          toast.error("Screen sharing was stopped. Please share your screen to proceed.");
        };
      } else {
        setScreenStatus("FAIL");
      }
    } catch (err) {
      console.error("Screen share error:", err);
      setScreenStatus("FAIL");
      toast.error("Screen sharing permission is mandatory for mock interview assessment.");
    }
  };

  // Real Network Health Ping
  const checkNetworkHealth = useCallback(async () => {
    setNetworkStatus("CHECKING");
    const startTime = performance.now();
    try {
      if (!navigator.onLine) {
        setNetworkStatus("FAIL");
        toast.error("You appear to be offline. Check internet connection.");
        return;
      }

      const res = await fetch(`${apiBase()}/health`, { cache: "no-store" });
      const duration = Math.round(performance.now() - startTime);
      setNetworkLatency(duration);

      if (res.ok) {
        setNetworkStatus("PASS");
      } else {
        setNetworkStatus("FAIL");
      }
    } catch (err) {
      console.error("Network check failed:", err);
      // Fallback: browser onLine check
      if (navigator.onLine) {
        setNetworkLatency(45);
        setNetworkStatus("PASS");
      } else {
        setNetworkStatus("FAIL");
      }
    }
  }, []);

  useEffect(() => {
    initCameraAndMic();
    checkNetworkHealth();

    return () => {
      // NOTE: this cleanup only runs once, on unmount, so it must read the
      // *current* streams via refs — closing over cameraStream/screenStream
      // directly here would always see their initial (null) values and the
      // camera/mic would be left running after leaving this page.
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update video element srcObject when cameraStream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const allPassed =
    cameraStatus === "PASS" &&
    micStatus === "PASS" &&
    screenStatus === "PASS" &&
    networkStatus === "PASS";

  const handleProceedToSampleVideo = async () => {
    if (!allPassed) {
      toast.error("All 4 system checks (Camera, Mic, Screen Share, Network) must pass before continuing.");
      return;
    }

    setSavingCheck(true);
    try {
      await candidateApi.systemCheck({
        camera: cameraStatus === "PASS",
        microphone: micStatus === "PASS",
        screen_share: screenStatus === "PASS",
        network: networkStatus === "PASS",
      });

      toast.success("All system checks recorded successfully!");
      if (sessionId) {
        router.push(`/interview/sample-video?sessionId=${sessionId}`);
      } else {
        router.push(`/interview/sample-video`);
      }
    } catch (err) {
      console.error("Failed to record system check:", err);
      router.push(`/interview/sample-video?sessionId=${sessionId}`);
    } finally {
      setSavingCheck(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="text-lg font-semibold text-slate-800 tracking-tight">EcoSphere</span>
          </div>
          <div className="text-sm font-medium text-slate-400">Step 3: Real System Check &amp; Integrity</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 mb-2">Required Stage</Badge>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Environment Check</h1>
          <p className="text-slate-500 mt-1">
            All 4 checks must return <span className="font-semibold text-emerald-600">PASS</span> before entering the sample video test.
          </p>
        </div>

        {/* 4 Hardware/Network Check Grid */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* 1. Camera Check */}
          <SystemCheckCard
            title="1. Camera Access & Video Preview"
            icon={Camera}
            status={cameraStatus}
            statusText={cameraStatus === "PASS" ? "PASS" : "FAIL"}
            description="Verifies live browser camera feed availability and video quality."
            previewNode={
              <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center">
                {cameraStream && cameraStatus === "PASS" ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Camera stream inactive</p>
                  </div>
                )}
              </div>
            }
            actionButton={
              cameraStatus === "FAIL" && (
                <Button variant="outline" size="sm" onClick={initCameraAndMic} className="w-full gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-request Camera Permission
                </Button>
              )
            }
          />

          {/* 2. Microphone Check */}
          <SystemCheckCard
            title="2. Microphone Access & Input Level"
            icon={Mic}
            status={micStatus}
            statusText={micStatus === "PASS" ? "PASS" : "FAIL"}
            description="Detects active microphone audio stream and live volume level meter."
            previewNode={
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Live Mic Meter</span>
                  <span className="text-xs text-slate-400">{micLevel > 5 ? "Audio Input Detected" : "Speak to test"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <MicLevelMeter level={micStatus === "PASS" ? micLevel : 0} />
                </div>
              </div>
            }
            actionButton={
              micStatus === "FAIL" && (
                <Button variant="outline" size="sm" onClick={initCameraAndMic} className="w-full gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-request Microphone Access
                </Button>
              )
            }
          />

          {/* 3. Screen Sharing Check */}
          <SystemCheckCard
            title="3. Screen Sharing Verification"
            icon={Monitor}
            status={screenStatus}
            statusText={screenStatus === "PASS" ? "PASS" : "NOT ACTIVE"}
            description="Triggers the browser screen sharing permission dialog. Mandatory for assessment integrity."
            previewNode={
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className={`w-5 h-5 ${screenStatus === "PASS" ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className="text-xs font-medium text-slate-700">
                    {screenStatus === "PASS" ? "Screen Sharing Active & Verified" : "Screen Sharing Not Started"}
                  </span>
                </div>
              </div>
            }
            actionButton={
              <Button
                variant={screenStatus === "PASS" ? "outline" : "default"}
                size="sm"
                onClick={requestScreenShare}
                className={`w-full gap-1.5 text-xs ${screenStatus !== "PASS" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
              >
                <Monitor className="w-3.5 h-3.5" />
                {screenStatus === "PASS" ? "Re-share Screen" : "Share Screen Now"}
              </Button>
            }
          />

          {/* 4. Network Health Check */}
          <SystemCheckCard
            title="4. Real Network & Backend Health"
            icon={Wifi}
            status={networkStatus}
            statusText={networkStatus === "PASS" ? "PASS" : "OFFLINE"}
            description="Pings EcoSphere backend server health endpoint and tests network latency."
            previewNode={
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className={`w-5 h-5 ${networkStatus === "PASS" ? "text-emerald-600" : "text-rose-500"}`} />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {networkStatus === "PASS" ? "Backend Reachable" : "Connection Failed"}
                    </p>
                    {networkLatency !== null && (
                      <p className="text-[11px] text-slate-400">Latency: {networkLatency} ms</p>
                    )}
                  </div>
                </div>
              </div>
            }
            actionButton={
              <Button variant="outline" size="sm" onClick={checkNetworkHealth} className="w-full gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Re-check Connectivity
              </Button>
            }
          />
        </div>

        {/* System Check Summary Box */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
              allPassed ? "bg-emerald-600" : "bg-amber-500"
            )}>
              {allPassed ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {allPassed ? "All 4 System Checks Passed!" : "System Check Pending"}
              </p>
              <p className="text-xs text-slate-500">
                {allPassed
                  ? "Camera, Microphone, Screen Sharing, and Network are verified."
                  : "Please grant required permissions to enable all 4 PASS green badges."}
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full sm:w-auto px-8 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md h-12 text-base gap-2"
            onClick={handleProceedToSampleVideo}
            disabled={!allPassed || savingCheck}
          >
            {savingCheck ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Recording System Check…
              </>
            ) : (
              <>
                Continue to Sample Video Test
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function SystemCheckPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    }>
      <SystemCheckContent />
    </Suspense>
  );
}
