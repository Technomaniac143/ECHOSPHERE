"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranscript, useInterview, useWhiteboard, useInterrupt } from "@/hooks";
import { sessionApi } from "@/lib/api/client";
import { createClient, AnamEvent } from "@anam-ai/js-sdk";
import { PERSONAS, type PersonaKey } from "@/types";
import { AgoraVideo, AgoraStatusBar } from "@/components/agora/AgoraVideo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ChevronLeft,
  MessageCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Send,
  Users,
  Brain,
  FileText,
  HeartPulse,
  CheckCircle2,
  X,
  AudioWaveform,
  CheckCircle,
  MessageSquare,
  ListTodo
} from "lucide-react";

// Interview is capped at 5 questions. The interviewer's system prompt
// (backend/app/api/sessions.py::_interviewer_system_prompt) instructs the
// AI to ask exactly this many questions, then say a closing line containing
// this phrase once the candidate has answered the last one.
const MAX_QUESTIONS = 5;
const INTERVIEW_CLOSING_MARKER = "concludes our";

function TranscriptBubble({
  speaker,
  text,
  persona,
  isLatest,
}: {
  speaker: "candidate" | "agent";
  text: string;
  persona?: PersonaKey | null;
  isLatest?: boolean;
}) {
  const isAgent = speaker === "agent";
  const meta = persona ? PERSONAS[persona] : null;

  return (
    <div className={`flex flex-col mb-4 ${isAgent ? "items-start" : "items-end"}`}>
      {isAgent && (
        <div className="flex items-center gap-2 mb-1 pl-1">
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 text-[10px] font-bold">{meta?.name?.charAt(0) || "A"}</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-700">
            {meta?.name || "AI Agent"}
          </span>
          <span className="text-[10px] text-slate-400 ml-1">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      {!isAgent && (
        <div className="flex items-center gap-2 mb-1 pr-1">
          <span className="text-[11px] font-semibold text-slate-700">You</span>
          <span className="text-[10px] text-slate-400 ml-1">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isAgent
            ? "bg-slate-50 text-slate-700 rounded-tl-sm border border-slate-200/60 shadow-sm"
            : "bg-green-50 text-green-900 rounded-tr-sm border border-green-100 shadow-sm"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { turns, listening, speaking, thinking, replaceAll, clearTurns, markSpeaking, markThinking } = useTranscript();
  const transcriptListRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const {
    phase,
    status,
    remainingSeconds,
    durationMinutes,
    startTimer,
    setPhaseState,
    decrement,
  } = useInterview(sessionId, {
    onPhaseChange: (p) => {
      if (p === "completed") {
        router.push(`/reports/${sessionId}`);
      }
    },
  });

  const { state: whiteboard, persona: currentPersona, refresh: refreshWhiteboard } = useWhiteboard(sessionId);
  const { suppressAi, raise: raiseInterrupt, release: releaseInterrupt } = useInterrupt();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [candidateName, setCandidateName] = useState("Candidate");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [activeTab, setActiveTab] = useState<"conversation" | "notes">("conversation");
  const sessionInitDone = useRef(false);
  const mediaInitDone = useRef(false);
  const anamClientRef = useRef<any>(null);
  const interviewEndTriggeredRef = useRef(false);
  const [anamStatus, setAnamStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  // Auto-scroll transcript list on new turns
  useEffect(() => {
    const list = transcriptListRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
      return;
    }
    transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // Initialize
  useEffect(() => {
    if (sessionInitDone.current) return;
    sessionInitDone.current = true;
    const init = async () => {
      try {
        const sessionRes = await sessionApi.get(sessionId).catch(() => null) as {
          data?: { targetRole?: string; role?: string };
          target_role?: string;
        } | null;
        const role = sessionRes?.data?.targetRole || sessionRes?.data?.role || sessionRes?.target_role;
        if (role) setTargetRole(role);

        // Anam owns the microphone during the call — we only need this to
        // trigger the browser permission prompt ahead of time. Stop the
        // tracks immediately so this stream doesn't linger alongside the
        // one Anam's SDK opens itself.
        try {
          const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          permStream.getTracks().forEach((t) => t.stop());
        } catch (micErr) {
          console.warn("Mic permission denied or unavailable:", micErr);
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://echosphere-backend-2vxu.onrender.com"}/api/sessions/${sessionId}/anam-token`, {
          method: "POST",
        });
        if (response.ok) {
          const data = await response.json();
          const token = data.sessionToken || data.token;
          if (token) {
            const anamClient = createClient(token);
            anamClientRef.current = anamClient;

            try {
              anamClient.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (messages: any[]) => {
                if (!messages || !Array.isArray(messages)) return;
                const mapped = messages
                  .filter((msg) => msg?.content && String(msg.content).trim())
                  .map((msg, index) => {
                    const isUser = msg.role === "user";
                    return {
                      id: String(msg.id || `anam-${index}`),
                      speaker: (isUser ? "candidate" : "agent") as "candidate" | "agent",
                      persona: isUser ? null : (currentPersona || "technical"),
                      text: String(msg.content).trim(),
                      tsStart: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    };
                  });
                replaceAll(mapped);
                const last = mapped[mapped.length - 1];
                if (last?.speaker === "agent") {
                  markSpeaking("agent", true);
                  setTimeout(() => markSpeaking("agent", false), 2500);
                }

                // The interview is capped at MAX_QUESTIONS questions. The
                // interviewer's system prompt is instructed to say a fixed
                // closing line once the candidate has answered the final
                // question — detect that (with a turn-count safety net in
                // case the model doesn't say it verbatim) and end the
                // session automatically.
                if (!interviewEndTriggeredRef.current) {
                  const agentTurns = mapped.filter((m) => m.speaker === "agent");
                  const lastAgentText = (agentTurns[agentTurns.length - 1]?.text || "").toLowerCase();
                  const saidClosingLine = lastAgentText.includes(INTERVIEW_CLOSING_MARKER);
                  const hitSafetyCap = agentTurns.length > MAX_QUESTIONS + 1; // questions + closing line
                  if (saidClosingLine || hitSafetyCap) {
                    interviewEndTriggeredRef.current = true;
                    // Give the closing line a few seconds to finish playing
                    // via TTS before ending the call and redirecting.
                    setTimeout(() => {
                      handleEndSession();
                    }, 4000);
                  }
                }
              });

              anamClient.addListener(AnamEvent.USER_SPEECH_STARTED, () => {
                markSpeaking("candidate", true);
              });

              anamClient.addListener(AnamEvent.USER_SPEECH_ENDED, () => {
                markSpeaking("candidate", false);
              });

              // Log connection errors from the SDK
              anamClient.addListener(AnamEvent.CONNECTION_CLOSED, (reason: unknown) => {
                console.warn("Anam CONNECTION_CLOSED:", reason);
              });
            } catch (err) {
              console.warn("Anam event listener setup notice:", err);
            }

            // Wait for DOM paint so the video element is fully available
            await new Promise((resolve) => setTimeout(resolve, 800));
            const videoEl = document.getElementById("anam-video-element") as HTMLVideoElement | null;
            if (videoEl) {
              videoEl.muted = true;
              videoEl.playsInline = true;
              videoEl.autoplay = true;
            }
            try {
              await anamClient.streamToVideoElement("anam-video-element");
            } catch (streamErr: any) {
              console.error("Anam streamToVideoElement error:", streamErr?.message || streamErr);
              throw streamErr;
            }
            if (videoEl) {
              try {
                await videoEl.play();
              } catch {
                // Autoplay with sound can be blocked; keep the stream muted until the user taps mic.
              }
              videoEl.muted = false;
            }
            setAnamStatus("connected");
          } else {
            setAnamStatus("error");
          }
        } else {
          console.error("Anam token request failed:", response.status, await response.text());
          setAnamStatus("error");
        }
      } catch (e: any) {
        console.error("Failed to init session or Anam:", e?.cause || e?.message || e);
        setAnamStatus("error");
      }
      startTimer(durationMinutes);
      // Must pass "in_progress" here — the countdown timer (and the
      // auto-end-on-timeout logic) in useInterview only runs while
      // status === "in_progress"; leaving it at the default "lobby"
      // status meant the timer never actually started.
      setPhaseState("session", "in_progress");
    };
    init();

    // Cleanup: stop Anam streaming when component unmounts
    return () => {
      if (anamClientRef.current) {
        try { anamClientRef.current.stopStreaming(); } catch {}
        anamClientRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // PIP webcam is video-only so Anam keeps exclusive access to the microphone.
  useEffect(() => {
    if (mediaInitDone.current) return;
    mediaInitDone.current = true;
    const requestMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" },
          audio: false,
        });
        setLocalStream(stream);
      } catch {}
    };
    requestMedia();
    return () => {
      setLocalStream((s) => { s?.getTracks().forEach((t) => t.stop()); return null; });
    };
  }, []);

  const handleEndSession = async () => {
    try {
      await sessionApi.end(sessionId);
      setPhaseState("completed");
    } catch {
      router.push("/interview");
    }
  };

  const steps = [
    { id: 1, label: "Verify", status: "completed" },
    { id: 2, label: "Technical", status: "current" },
    { id: 3, label: "Product", status: "upcoming" },
    { id: 4, label: "Behavioral", status: "upcoming" },
    { id: 5, label: "Confirm", status: "upcoming" },
  ];

  return (
    <div className="h-screen bg-slate-100 text-slate-800 font-sans flex flex-col overflow-hidden">
      
      {/* Top Navigation Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-800">EchoSphere</span>
        </div>

        {/* Step Progress Bar */}
        <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${step.status === "completed" ? "bg-emerald-500 text-white" 
                    : step.status === "current" ? "bg-blue-600 text-white ring-4 ring-blue-100" 
                    : "bg-slate-100 text-slate-400"}`}
                >
                  {step.status === "completed" ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${step.status === "upcoming" ? "text-slate-400" : "text-slate-700"}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 lg:w-12 h-[2px] mx-2 -mt-4 ${step.status === "completed" ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleEndSession}
          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
          title="End Interview"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content Area - 3 Column Layout */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 lg:p-6 overflow-hidden">
        
        {/* Left Column: Candidate Profile (20%) */}
        <div className="hidden lg:flex flex-col w-[250px] gap-4 flex-shrink-0">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                  {candidateName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 leading-tight">{candidateName}</h3>
                  <div className="flex items-center gap-1 mt-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full w-max">
                    <CheckCircle className="w-3 h-3" />
                    <span className="text-[10px] font-semibold">Verified</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                   <Clock className="w-3 h-3" /> ROLE
                </p>
                <p className="text-sm font-semibold text-slate-700">{targetRole}</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                   LAST INTERVIEW
                </p>
                <p className="text-sm font-semibold text-slate-700">14 Mar 2026</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                   TOTAL SESSIONS
                </p>
                <p className="text-sm font-semibold text-slate-700">5 completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Video Stage (50%) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden relative">
          
          {/* Main AI Video Container */}
          <div className="flex-1 min-h-0 bg-slate-950 relative overflow-hidden">
            
            {/* Anam Video Stream Element — contain so portrait/landscape streams are not cropped */}
            <video
              id="anam-video-element"
              autoPlay
              playsInline
              muted
              className="absolute inset-0 z-0 h-full w-full object-contain object-center bg-slate-950"
            />
            
            {/* Fallback Placeholder (shows if video is not yet streaming) */}
            <div className={`absolute inset-0 z-[1] flex items-center justify-center transition-opacity duration-700 pointer-events-none ${anamStatus === "connected" ? "opacity-0" : "opacity-100"}`}>
              <div className="text-center">
                {anamStatus === "error" ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3">
                      <X className="w-8 h-8 text-rose-400" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Could not connect AI Agent</p>
                    <p className="text-slate-400 text-xs mt-1">Check your network and try again</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3 animate-pulse">
                      <Brain className="w-8 h-8 text-blue-300" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm">Connecting to EchoSphere AI...</p>
                    <p className="text-slate-400 text-xs mt-1">Setting up your AI interviewer</p>
                  </>
                )}
              </div>
            </div>

            {/* AI Name Badge */}
            <div className="absolute top-5 left-5 z-10 bg-slate-800/80 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold">EchoSphere AI • LIVE</span>
            </div>

            {/* Picture in Picture (Candidate Webcam) */}
            <div className="absolute top-5 right-5 z-10 w-40 h-52 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
              {localStream && !videoMuted ? (
                <AgoraVideo
                  stream={localStream}
                  mirror={true}
                  aspect="4:3"
                  className="w-full h-full object-cover"
                  showLabel={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <VideoOff className="w-8 h-8 text-slate-500" />
                </div>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[10px] text-white font-medium">You</span>
                {audioMuted && <MicOff className="w-3 h-3 text-rose-400" />}
              </div>
            </div>

            {/* Floating Call Controls */}
            <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-xl p-2 rounded-full border border-white/20 shadow-2xl">
              <button
                onClick={() => {
                   const nextMuted = !audioMuted;
                   setAudioMuted(nextMuted);
                   const anam = anamClientRef.current;
                   if (anam) {
                     try {
                       // muteInputAudio()/unmuteInputAudio() take no arguments —
                       // call the one that matches the intended state.
                       if (nextMuted) {
                         anam.muteInputAudio?.();
                       } else {
                         anam.unmuteInputAudio?.();
                       }
                     } catch {}
                   }
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  audioMuted ? "bg-white text-slate-700 shadow-md" : "bg-slate-700/80 text-white hover:bg-slate-600"
                }`}
              >
                {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={() => {
                   const nextMuted = !videoMuted;
                   setVideoMuted(nextMuted);
                   if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = !nextMuted);
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  videoMuted ? "bg-white text-slate-700 shadow-md" : "bg-slate-700/80 text-white hover:bg-slate-600"
                }`}
              >
                {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
              <button
                onClick={handleEndSession}
                className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 shadow-lg shadow-rose-500/20"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="h-14 bg-white border-t border-slate-100 flex items-center justify-center gap-3">
             <span className="text-sm font-bold text-blue-900">EchoSphere AI is listening...</span>
             <AudioWaveform className="w-5 h-5 text-blue-600 animate-pulse" />
          </div>
        </div>

        {/* Right Column: Workspaces (30%) */}
        <div className="hidden lg:flex flex-col w-[350px] gap-4 flex-shrink-0 min-h-0">
          
          {/* Top Half: Conversation & Notes */}
          <div className="flex-1 min-h-0 bg-white rounded-3xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-slate-100">
              <button
                onClick={() => setActiveTab("conversation")}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === "conversation" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Conversation
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === "notes" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <FileText className="w-4 h-4" />
                Notes
              </button>
            </div>
            
            {activeTab === "conversation" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold">Live Transcription</span>
                  </div>
                  <button
                    onClick={clearTurns}
                    className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div ref={transcriptListRef} className="flex-1 min-h-0 overflow-y-auto p-5 pb-8">
                  {turns.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <MessageCircle className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs font-medium">Transcription will appear here</p>
                    </div>
                  ) : (
                    <>
                      {turns.map((turn) => (
                        <TranscriptBubble
                          key={turn.id}
                          speaker={turn.speaker}
                          text={turn.text}
                          persona={turn.persona ?? null}
                          isLatest={turn.id === turns[turns.length - 1]?.id}
                        />
                      ))}
                      <div ref={transcriptEndRef} />
                    </>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === "notes" && (
              <div className="flex-1 p-5">
                <textarea 
                  className="w-full h-full resize-none outline-none text-sm text-slate-600 placeholder:text-slate-300"
                  placeholder="Type your interview notes here..."
                />
              </div>
            )}
          </div>

          {/* Bottom Half: Summary / Objectives */}
          <div className="h-[200px] flex-shrink-0 bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-blue-800">
                <ListTodo className="w-5 h-5" />
                <h3 className="font-bold">Interview Summary</h3>
              </div>
              <div className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Updated
              </div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col items-center justify-center text-center gap-3">
               <p className="text-sm font-semibold text-slate-700">Listening for key points...</p>
               <p className="text-xs text-slate-500">
                 I will summarize the detected technical concepts and behavioral traits here as we talk.
               </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
