"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranscript, useAgora, useInterview, useWhiteboard, useInterrupt, AGORA_DEV_MODE } from "@/hooks";
import { sessionApi } from "@/lib/api/client";
import { PERSONAS, type PersonaKey, type InterviewPhase } from "@/types";
import { AgoraVideo, AgoraStatusBar } from "@/components/agora/AgoraVideo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ChevronLeft,
  MessageCircle,
  Mic,
  MicOff,
  Volume2,
  Send,
  Users,
  RotateCcw,
  SkipForward,
  Brain,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Speakerphone,
  Headphones,
} from "lucide-react";
import Link from "next/link";

// ---------- Persona avatar SVG ----------
function PersonaAvatar({ persona, size = "lg" }: { persona: PersonaKey; size?: "sm" | "md" | "lg" }) {
  const meta = PERSONAS[persona];
  const sizes = { sm: 36, md: 48, lg: 64 };
  const s = sizes[size];
  const initials = meta.name.charAt(0);

  return (
    <div
      className="relative flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: s, height: s, backgroundColor: meta.color, boxShadow: `0 0 0 3px ${meta.color}33, 0 4px 12px rgba(0,0,0,0.3)` }}
    >
      <span
        className="text-white font-bold"
        style={{ fontSize: s * 0.38 }}
      >
        {initials}
      </span>
      {/* Speaking ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent animate-pulse"
        style={{ borderColor: `${meta.color}80` }}
      />
    </div>
  );
}

// ---------- Transcript bubble ----------
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
    <div
      className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-2.5 last:mb-0`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isAgent
            ? "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50"
            : "bg-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-600/20"
        } ${isLatest ? "ring-2 ring-blue-500/30" : ""}`}
      >
        {isAgent && meta && (
          <div className="flex items-center gap-2 mb-1">
            <PersonaAvatar persona={persona} size="sm" />
            <span
              className="text-[11px] font-semibold"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

// ---------- Persona handoff banner ----------
function PersonaHandoffBanner({
  currentPersona,
  previousPersona,
  onDismiss,
}: {
  currentPersona: PersonaKey;
  previousPersona?: PersonaKey;
  onDismiss: () => void;
}) {
  const meta = PERSONAS[currentPersona];

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-500"
      style={{ marginTop: "-5rem" }}
    >
      <div
        className="bg-slate-900/95 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl border border-white/10 flex items-center gap-3 min-w-[300px]"
        onClick={onDismiss}
      >
        <RotateCcw className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <div className="flex items-center gap-2.5">
          <PersonaAvatar persona={currentPersona} size="sm" />
          <div>
            <p className="text-xs text-slate-400">Now interviewing with</p>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              {meta.name}
              <span style={{ color: meta.color }} className="text-[11px] font-medium">
                {meta.label}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------- Main session page ----------
export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { turns, listening, speaking, thinking, push, markSpeaking, markThinking } = useTranscript();
  const {
    connected,
    quality,
    muteState,
    devMode,
    loading,
    initialize,
    requestDevices,
    muteAudio,
    muteVideo,
    join,
    leave,
  } = useAgora(true);

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
        router.push(`/interview/session/${sessionId}/results`);
      }
    },
  });

  const { state: whiteboard, persona: currentPersona, refresh: refreshWhiteboard } = useWhiteboard(sessionId);
  const { suppressAi, raise: raiseInterrupt, release: releaseInterrupt } = useInterrupt({
    onInterrupt: () => {
      // Signal to backend that candidate interrupted
    },
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showHandoff, setShowHandoff] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("Hi there! I'm Alex, your technical interviewer. Let's start with a warm-up — tell me about a technical project you're most proud of and why.");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [candidateName, setCandidateName] = useState("Candidate");

  // Mock questions for each persona
  const QUESTIONS: Record<PersonaKey, string[]> = {
    technical: [
      "Let's start with a warm-up — tell me about a technical project you're most proud of and why.",
      "Imagine you need to design a URL shortening service like bit.ly. Walk me through your approach.",
      "You mentioned using Redis earlier. How would you handle cache invalidation in a high-traffic system?",
      "Here's a coding problem: given an array of integers, find the longest subarray with sum equal to zero. How would you approach this?",
    ],
    product: [
      "Thanks for joining me. I'd like to start by understanding how you prioritize features when everything seems urgent.",
      "Imagine you're building a new feature for a social media app. How do you decide what to build first?",
      "You mentioned user research. Can you walk me through a time when user feedback changed your product direction?",
      "Let's talk about trade-offs. When would you choose a slower but simpler solution over a complex one?",
    ],
    hiring_manager: [
      "Hi, I'm Daniel. Let's talk about your career — what drives you to take on new challenges?",
      "Tell me about a time you had to lead a project without formal authority. How did you get buy-in?",
      "You've worked in multiple team sizes. What do you find most challenging about transitioning between them?",
      "If you joined our team and noticed a process that wasn't working, what would you do?",
    ],
    behavioral: [
      "Hi, I'm Sophia. Let's dive into your experiences. Tell me about a time you failed at something important.",
      "Describe a situation where you had to work with a difficult team member. How did you handle it?",
      "Tell me about a time you had to learn something new under pressure. What was your approach?",
      "Give me an example of when you went above and beyond for a project or team.",
    ],
    customer: [
      "Hey there! I'm Jordan, and I'm playing the role of a frustrated customer. I've been waiting for my order for two weeks and nobody has updated me. What do you say?",
      "I just tried to use your app and it crashed three times. I'm really annoyed. How do you handle this?",
      "I want to cancel my subscription but your cancellation process is incredibly complicated. What do you do?",
      "I found a bug that caused me to lose data. I'm not happy. How do you respond?",
    ],
  };

  // Initialize
  useEffect(() => {
    const init = async () => {
      await initialize();
      await requestDevices();
      try {
        const session = await sessionApi.get(sessionId);
        if (session.data.setup?.company) {
          // Extract candidate name from profile if available
        }
      } catch {}
      startTimer(durationMinutes);
      setPhaseState("calibration");
    };
    init();
  }, [sessionId, initialize, requestDevices, startTimer, setPhaseState, durationMinutes]);

  // Request camera/mic for the session
  useEffect(() => {
    const requestMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        setLocalStream(stream);
      } catch {}
    };
    if (phase !== "completed" && phase !== "lobby") {
      requestMedia();
    }
    return () => {
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
    };
  }, [phase, localStream]);

  // Advance to next question / persona
  const advanceQuestion = useCallback(() => {
    const personaQ = QUESTIONS[currentPersona];
    if (!personaQ) return;
    const nextIdx = (questionIndex + 1) % personaQ.length;
    if (nextIdx === 0) {
      // Rotate to next persona
      const personas: PersonaKey[] = ["technical", "product", "hiring_manager", "behavioral"];
      const currIdx = personas.indexOf(currentPersona);
      const nextPersona = personas[(currIdx + 1) % personas.length];
      setCurrentQuestion(QUESTIONS[nextPersona][0]);
      setQuestionIndex(0);
      setShowHandoff(true);
      setTimeout(() => setShowHandoff(false), 4000);
      // Push handoff turn
      push({
        id: `${Date.now()}-handoff`,
        speaker: "agent",
        persona: nextPersona,
        text: `${PERSONAS[nextPersona].name}: Hi again! I'm ${PERSONAS[nextPersona].name}, your ${PERSONAS[nextPersona].label.toLowerCase()}. Let's continue.`,
        tsStart: new Date().toISOString(),
      });
    } else {
      setCurrentQuestion(personaQ[nextIdx]);
      setQuestionIndex(nextIdx);
    }
  }, [currentPersona, questionIndex, push]);

  // Auto-advance after a delay (simulate AI listening then next question)
  useEffect(() => {
    if (turns.length > 0 && turns[turns.length - 1].speaker === "candidate") {
      const t = setTimeout(() => {
        markSpeaking("agent", true);
        setTimeout(() => {
          markSpeaking("agent", false);
          push({
            id: `${Date.now()}`,
            speaker: "agent",
            persona: currentPersona,
            text: currentQuestion,
            tsStart: new Date().toISOString(),
          });
          setQuestionIndex((q) => q); // keep current question index
        }, 2000);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [turns.length, push, markSpeaking, currentPersona, currentQuestion]);

  const handleEndSession = async () => {
    try {
      await sessionApi.end(sessionId);
      setPhaseState("completed");
    } catch {
      router.push("/interview");
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentPersonaMeta = PERSONAS[currentPersona];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Persona handoff banner */}
      {showHandoff && (
        <PersonaHandoffBanner
          currentPersona={currentPersona}
          previousPersona={currentPersona}
          onDismiss={() => setShowHandoff(false)}
        />
      )}

      {/* Top bar */}
      <header className="h-14 border-b border-white/5 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="text-sm font-semibold text-white hidden sm:block">EchoSphere</span>
          </div>
          <div className="h-5 w-px bg-white/10 mx-1" />
          <span className="text-xs text-slate-400 hidden sm:block">
            {currentPersonaMeta.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-mono font-bold bg-slate-800/80 border ${
              remainingSeconds <= 60 ? "border-rose-500/40 text-rose-400" : "border-slate-700/50 text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {formatTime(remainingSeconds)}
          </div>

          {/* Transcript toggle */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-1.5 rounded-lg transition-all ${
              showTranscript ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
            title="Toggle transcript"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          {/* End session */}
          {status === "in_progress" && (
            <button
              onClick={handleEndSession}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="End session"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          )}

          {devMode && (
            <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
              Dev
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: AI Interviewer section */}
        <div className="flex-1 flex flex-col min-h-0 lg:max-w-[45%]">
          {/* Interviewer card */}
          <div className="flex-1 flex flex-col p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <PersonaAvatar persona={currentPersona} size="md" />
                <div>
                  <h2 className="text-base font-bold text-white">{currentPersonaMeta.name}</h2>
                  <p
                    className="text-xs font-medium"
                    style={{ color: currentPersonaMeta.color }}
                  >
                    {currentPersonaMeta.label}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-slate-700 text-slate-300 text-[10px] px-2 py-0.5"
              >
                Persona {["technical", "product", "hiring_manager", "behavioral"].indexOf(currentPersona) + 1} of 4
              </Badge>
            </div>

            {/* Question display */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Speaking
                </span>
              </div>

              {/* Current question */}
              <div className="mb-4">
                <div
                  className={`text-lg leading-relaxed transition-opacity ${
                    thinking ? "text-slate-400 italic" : "text-white"
                  }`}
                >
                  {thinking ? (
                    <span className="animate-pulse">Analyzing your response...</span>
                  ) : (
                    currentQuestion
                  )}
                </div>
              </div>

              {/* Speaking / listening indicators */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  {speaking ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-blue-300">Interviewer speaking</span>
                    </>
                  ) : listening ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-300">Listening to you</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                      <span className="text-slate-500">Awaiting response</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Question controls */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                onClick={advanceQuestion}
              >
                <SkipForward className="w-3 h-3 mr-1" />
                Next question
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-300 text-xs"
                onClick={refreshWhiteboard}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Live transcript (collapsible) */}
          {showTranscript && (
            <div className="border-t border-white/5 bg-slate-900/80 backdrop-blur-sm max-h-[260px] overflow-y-auto">
              <div className="sticky top-0 bg-slate-900/80 backdrop-blur-sm px-4 lg:px-6 py-2.5 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">Live Transcript</span>
                  <Badge variant="outline" className="border-slate-700 text-slate-500 text-[10px] px-1.5 py-0">
                    {turns.length} turns
                  </Badge>
                </div>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 lg:p-6 space-y-1">
                {turns.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Transcript will appear here as the interview progresses.
                  </p>
                ) : (
                  turns.map((turn) => (
                    <TranscriptBubble
                      key={turn.id}
                      speaker={turn.speaker}
                      text={turn.text}
                      persona={turn.persona ?? null}
                      isLatest={turn.id === turns[turns.length - 1]?.id}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Candidate video + controls */}
        <div className="w-full lg:w-[55%] flex flex-col bg-slate-900/30 p-3 lg:p-4">
          {/* Video section */}
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-slate-900 border border-white/5">
            {localStream && !muteState.videoMuted ? (
              <AgoraVideo
                stream={localStream}
                mirror={true}
                aspect="16:9"
                className="w-full h-full object-cover"
                showLabel={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900/80">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <Headphones className="w-10 h-10 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-400">Camera off</p>
                  <p className="text-xs text-slate-600 mt-1">Enable camera to appear on screen</p>
                </div>
              </div>
            )}

            {/* Agora overlay badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <AgoraStatusBar
                audioMuted={muteState.audioMuted}
                videoMuted={muteState.videoMuted}
                quality={quality}
                screenSharing={false}
                onToggleMic={async () => {
                  const next = !muteState.audioMuted;
                  await muteAudio(next);
                  if (localStream) {
                    localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
                  }
                }}
                onToggleVideo={async () => {
                  const next = !muteState.videoMuted;
                  await muteVideo(next);
                  if (localStream) {
                    localStream.getVideoTracks().forEach((t) => (t.enabled = !next));
                  }
                }}
                onToggleScreen={() => {}}
              />
            </div>

            {/* Candidate name overlay */}
            <div className="absolute bottom-3 left-3">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">C</span>
                </div>
                <span className="text-xs text-white/80 font-medium">{candidateName || "Candidate"}</span>
              </div>
            </div>

            {/* Recording indicator */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] text-slate-300 uppercase tracking-wider font-medium">Recording</span>
            </div>
          </div>

          {/* Bottom controls bar */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Current persona indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-white/5">
                <PersonaAvatar persona={currentPersona} size="sm" />
                <div className="text-xs">
                  <p className="text-white font-medium leading-tight">{currentPersonaMeta.name}</p>
                  <p
                    className="leading-tight"
                    style={{ color: currentPersonaMeta.color }}
                  >
                    {currentPersonaMeta.label}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-white/5">
                <div className="flex -space-x-1">
                  {(["technical", "product", "hiring_manager", "behavioral"] as PersonaKey[]).map((p, i) => {
                    const isActive = p === currentPersona;
                    return (
                      <div
                        key={p}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isActive
                            ? "ring-2 ring-white/50 scale-110"
                            : "opacity-50"
                        }`}
                        style={{
                          backgroundColor: PERSONAS[p].color,
                          color: "#fff",
                        }}
                      >
                        {PERSONAS[p].name.charAt(0)}
                      </div>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-500 ml-1.5">
                  {["technical", "product", "hiring_manager", "behavioral"].indexOf(currentPersona) + 1}/4
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Interrupt button */}
              <button
                onClick={raiseInterrupt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                <Send className="w-3 h-3" />
                Interrupt
              </button>

              {/* Mic status */}
              <button
                onClick={async () => {
                  const next = !muteState.audioMuted;
                  await muteAudio(next);
                  if (localStream) {
                    localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
                  }
                }}
                className={`p-2 rounded-lg transition-all ${
                  muteState.audioMuted
                    ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                }`}
                title={muteState.audioMuted ? "Unmute" : "Mute"}
              >
                {muteState.audioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dev mode toast */}
      {devMode && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-400 flex items-center gap-2 shadow-lg">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            Dev mode — Agora is simulated
          </div>
        </div>
      )}
    </div>
  );
}
