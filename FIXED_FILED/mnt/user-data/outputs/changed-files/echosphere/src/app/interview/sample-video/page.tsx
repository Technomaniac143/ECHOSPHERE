"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { candidateApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Video, Mic, Play, Square, RefreshCw, Upload, ArrowRight, Loader2,
  CheckCircle2, AlertCircle, Clock, Sparkles
} from "lucide-react";

function SampleVideoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mirror of `stream` kept current so the mount-only cleanup effect below
  // can stop the *current* stream instead of the stale (always-null) value
  // it would otherwise capture from the initial render's closure.
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => { streamRef.current = stream; }, [stream]);

  // Initialize camera stream
  const initStream = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Failed to access camera for sample video:", err);
      toast.error("Could not access camera or microphone. Please allow access.");
    }
  }, []);

  useEffect(() => {
    initStream();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Read via ref, not the closed-over `stream` state (which is always
      // null here since this effect only runs once, on mount) — otherwise
      // the camera/mic are never actually released when leaving this page.
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update live video element
  useEffect(() => {
    if (liveVideoRef.current && stream) {
      liveVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Start recording
  const startRecording = () => {
    if (!stream) {
      toast.error("Camera stream not available.");
      return;
    }

    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);

    try {
      const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? { mimeType: "video/webm;codecs=vp9,opus" }
        : MediaRecorder.isTypeSupported("video/webm")
        ? { mimeType: "video/webm" }
        : undefined;

      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);

      // Duration timer tick
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= 30) {
            // Auto stop at 30s limit
            stopRecording();
            toast.info("30-second recording limit reached.");
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Recording start error:", err);
      toast.error("Failed to start recording.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // Retake video
  const handleRetake = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
  };

  // Submit sample video
  const handleSubmitSample = async () => {
    if (duration < 10) {
      toast.error("Please record your sample response for at least 10 seconds.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (recordedBlob) {
        fd.append("file", recordedBlob, "sample_video.webm");
      }
      fd.append("duration", String(duration));

      await candidateApi.sampleVideo(fd);
      toast.success("Sample video submitted for automated AI analysis!");

      if (sessionId) {
        router.push(`/interview/analysis?sessionId=${sessionId}`);
      } else {
        router.push(`/interview/analysis`);
      }
    } catch (err) {
      console.error("Failed to submit sample video:", err);
      toast.error("Submission failed. Navigating to Analysis Portal...");
      router.push(`/interview/analysis?sessionId=${sessionId}`);
    } finally {
      setSubmitting(false);
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
          <div className="text-sm font-medium text-slate-400">Step 4: Sample Video Test</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 mb-2">Environment Calibration</Badge>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sample Video Recording</h1>
          <p className="text-slate-500 mt-1">
            Record a short 10–30 second answer to verify your audio, video, and screen-sharing environment.
          </p>
        </div>

        {/* Question Prompt Card */}
        <Card className="border border-blue-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                ?
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase font-bold text-blue-600 tracking-wider">Sample Video Question</p>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">"What is your favourite colour?"</h2>
                <p className="text-xs text-slate-500">
                  Answer naturally for 10 to 30 seconds. Speak clearly in your normal tone.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Recorder / Preview Area */}
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-800">
                {recordedUrl ? "Recorded Sample Preview" : "Live Camera Recorder"}
              </CardTitle>
            </div>

            {/* Timer badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`font-mono text-sm px-3 py-1 ${
                recording ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse" : "bg-slate-100 text-slate-700"
              }`}>
                <Clock className="w-3.5 h-3.5 mr-1" />
                {duration}s / 30s
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
              {recordedUrl ? (
                /* Recorded video preview */
                <video
                  ref={previewVideoRef}
                  src={recordedUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Live camera stream feed */
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}

              {/* Recording live indicator badge */}
              {recording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-rose-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                  RECORDING LIVE
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              {!recordedUrl ? (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {!recording ? (
                    <Button
                      size="lg"
                      onClick={startRecording}
                      className="bg-rose-600 hover:bg-rose-700 text-white shadow-md gap-2 h-12 px-6"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={stopRecording}
                      className="bg-slate-900 hover:bg-black text-white shadow-md gap-2 h-12 px-6"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      Stop Recording
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleRetake}
                    className="gap-2 text-slate-700 h-12"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retake Video
                  </Button>
                </div>
              )}

              {/* Requirements & Submit */}
              <div className="flex items-center gap-4 ml-auto">
                <p className="text-xs text-slate-400">
                  {duration < 10 && recordedUrl ? (
                    <span className="text-rose-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Recording must be at least 10s
                    </span>
                  ) : recordedUrl ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Analysis
                    </span>
                  ) : (
                    "Must be 10–30 seconds"
                  )}
                </p>

                <Button
                  size="lg"
                  onClick={handleSubmitSample}
                  disabled={!recordedUrl || duration < 10 || submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md h-12 px-6 gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Sample…
                    </>
                  ) : (
                    <>
                      Submit for AI Analysis
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function SampleVideoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    }>
      <SampleVideoContent />
    </Suspense>
  );
}
