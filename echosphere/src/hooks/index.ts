"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  createAgoraClient,
  createAgoraClientWithMode,
  type AgoraFacade,
  type AgoraMuteState,
  type AgoraDeviceState,
  type ConnectionQuality,
  type RtcUser,
} from "@/lib/agora/client";
import type { PersonaKey } from "@/types";

export type { ConnectionQuality, AgoraFacade, AgoraMuteState, AgoraDeviceState, RtcUser };

export const AGORA_DEV_MODE = !process.env.AGORA_APP_ID;

export function useAgora(
  enabled = true,
  {
    onReady,
    onConnect,
    onDisconnect,
    onError,
  }: {
    onReady?: () => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (err: Error) => void;
  } = {},
) {
  const [facade, setFacade] = useState<AgoraFacade | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [quality, setQuality] = useState<ConnectionQuality>("unavailable");
  const [muteState, setMuteState] = useState<AgoraMuteState>({ audioMuted: false, videoMuted: false });
  const [deviceState, setDeviceState] = useState<AgoraDeviceState>({ microphoneSelected: null, cameraSelected: null });
  const [error, setError] = useState<string | null>(null);
  const [joinedUsers, setJoinedUsers] = useState<Map<number, RtcUser>>(new Map());
  const facadeRef = useRef<AgoraFacade | null>(null);
  const usersRef = useRef<Map<number, RtcUser>>(new Map());

  const devMode = AGORA_DEV_MODE;

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const instance = createAgoraClientWithMode(devMode);
      facadeRef.current = instance;
      setFacade(instance);

      await instance.initialize({ appId: process.env.AGORA_APP_ID ?? "", deviceUserId: 1 });
      setLoading(false);
      onReady?.();
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : "Failed to initialize Agora";
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  }, [devMode, onReady, onError]);

  useEffect(() => {
    if (!facade) return;

    facade.onConnectionChange((state: number) => {
      const isConnected =
        state === 3 /* RTC_CONNECTION_STATE_CONNECTED */;
      setConnected(isConnected);
      if (isConnected) onConnect?.();
      else onDisconnect?.();
    });

    facade.onQualityUpdate((q: ConnectionQuality) => setQuality(q));
    facade.onUserJoined((userId: number, user: RtcUser) => {
      const next = new Map(usersRef.current);
      next.set(userId, user);
      usersRef.current = next;
      setJoinedUsers(new Map(next));
    });
    facade.onUserLeft((userId: number) => {
      const next = new Map(usersRef.current);
      next.delete(userId);
      usersRef.current = next;
      setJoinedUsers(new Map(next));
    });
    facade.onAudioMutedChange((muted: boolean) => setMuteState((prev) => ({ ...prev, audioMuted: muted })));
    facade.onVideoMutedChange((muted: boolean) => setMuteState((prev) => ({ ...prev, videoMuted: muted })));
  }, [facade, onConnect, onDisconnect]);

  const requestDevices = useCallback(async () => {
    if (!facade) return;
    const state = await facade.requestDevices();
    setDeviceState(state);
  }, [facade]);

  const setMicrophone = useCallback(async (deviceId: string | null) => {
    if (!facade) return;
    await facade.setMicrophone(deviceId);
    setDeviceState((prev) => ({ ...prev, microphoneSelected: deviceId }));
  }, [facade]);

  const setCamera = useCallback(async (deviceId: string | null) => {
    if (!facade) return;
    await facade.setCamera(deviceId);
    setDeviceState((prev) => ({ ...prev, cameraSelected: deviceId }));
  }, [facade]);

  const muteAudio = useCallback(async (muted: boolean) => {
    if (!facade) return;
    await facade.muteAudio(muted);
    setMuteState((prev) => ({ ...prev, audioMuted: muted }));
  }, [facade]);

  const muteVideo = useCallback(async (muted: boolean) => {
    if (!facade) return;
    await facade.muteVideo(muted);
    setMuteState((prev) => ({ ...prev, videoMuted: muted }));
  }, [facade]);

  const join = useCallback(
    async (token: string, channel: string, userId: string) => {
      setLoading(true);
      setError(null);
      try {
        if (!facade) throw new Error("Agora not initialized");
        await facade.join(token, channel, userId);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        const message = err instanceof Error ? err.message : "Failed to join channel";
        setError(message);
        onError?.(err instanceof Error ? err : new Error(message));
      }
    },
    [facade, onError],
  );

  const leave = useCallback(async () => {
    if (!facade) return;
    await facade.leave();
  }, [facade]);

  const restart = useCallback(async () => {
    if (facadeRef.current) {
      await facadeRef.current.destroy();
      facadeRef.current = null;
      setFacade(null);
      setConnected(false);
      setQuality("unavailable");
      usersRef.current.clear();
      setJoinedUsers(new Map());
    }
    await initialize();
  }, [initialize]);

  return {
    facade,
    loading,
    connected,
    quality,
    muteState,
    deviceState,
    error,
    joinedUsers,
    devMode,
    initialize,
    requestDevices,
    setMicrophone,
    setCamera,
    muteAudio,
    muteVideo,
    join,
    leave,
    restart,
  };
}

// ---------- Transcript / live-captions hook ----------

export function useTranscript() {
  const [turns, setTurns] = useState<Array<{
    id: string;
    speaker: "candidate" | "agent";
    persona?: PersonaKey | null;
    text: string;
    tsStart: string;
    tsEnd?: string | null;
  }>>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const pendingRef = useRef<string[]>([]);

  const push = useCallback((turn: typeof turns[0]) => {
    setTurns((prev) => {
      pendingRef.current.push(turn.id);
      return [...prev, turn];
    });
  }, []);

  const markSpeaking = useCallback((speaker: "candidate" | "agent", on: boolean) => {
    if (speaker === "candidate") setListening(on ? true : (() => {
      setListening(false); return false;
    })());
    if (speaker === "agent") setSpeaking(on);
  }, []);

  const markThinking = useCallback((on: boolean) => setThinking(on), []);

  return { turns, listening, speaking, thinking, push, markSpeaking, markThinking };
}

// ---------- Whiteboard state hook ----------

export function useWhiteboard(sessionId: string) {
  const [state, setState] = useState<import("@/types").WhiteboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [persona, setPersona] = useState<PersonaKey>("technical");
  const [difficulty, setDifficulty] = useState<Record<string, { level: string; reason?: string }>>({});
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [openThreads, setOpenThreads] = useState<Array<{ id: string; description: string; assignedPersonaHint?: string }>>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/whiteboard`);
      const json = await res.json();
      const wb = json.data as import("@/types").WhiteboardState | undefined;
      if (wb) {
        setState(wb);
        setPersona(wb.currentPersona ?? "technical");
        setDifficulty(wb.difficultyState ?? {});
        setStrengths(wb.strengths ?? []);
        setWeaknesses(wb.weaknesses ?? []);
        setOpenThreads(wb.openThreads ?? []);
      }
    } catch {
      // keep last known state; don't blow up the interview UI
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [sessionId, refresh]);

  return { state, loading, persona, difficulty, strengths, weaknesses, openThreads, refresh };
}

// ---------- Interview phase + timer hook ----------

export function useInterview(
  sessionId: string,
  {
    onPhaseChange,
    onComplete,
  }: {
    onPhaseChange?: (phase: import("@/types").InterviewPhase) => void;
    onComplete?: () => void;
  } = {},
) {
  const [phase, setPhase] = useState<import("@/types").InterviewPhase>("lobby");
  const [status, setStatus] = useState<import("@/types").SessionStatus>("lobby");
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback((minutes: number) => {
    setDurationMinutes(minutes);
    setRemainingSeconds(minutes * 60);
  }, []);

  useEffect(() => {
    if (phase === "processing") {
      // briefly show processing state then move to completed
      const t = setTimeout(() => {
        setPhase("completed");
        setStatus("completed");
        onComplete?.();
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (["in_progress"].includes(status) && remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (remainingSeconds === 0 && status === "in_progress") {
      // time's up: end session automatically
      setPhase("ending");
      setStatus("completed");
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status, remainingSeconds]);

  const setPhaseState = useCallback(
    (nextPhase: import("@/types").InterviewPhase, nextStatus?: import("@/types").SessionStatus) => {
      setPhase(nextPhase);
      if (nextStatus) setStatus(nextStatus);
      onPhaseChange?.(nextPhase);
    },
    [onPhaseChange],
  );

  const decrement = useCallback(() => {
    setRemainingSeconds((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    phase,
    status,
    remainingSeconds,
    durationMinutes,
    startTimer,
    setPhaseState,
    setStatus,
    decrement,
  };
}

// ---------- Interrupt handling (barge-in) ----------

export function useInterrupt(
  {
    onInterrupt,
  }: { onInterrupt?: () => void } = {},
) {
  const [suppressAi, setSuppressAi] = useState(false);
  const interruptedRef = useRef(false);

  const raise = useCallback(() => {
    if (suppressAi) return;
    setSuppressAi(true);
    interruptedRef.current = true;
    onInterrupt?.();
  }, [suppressAi, onInterrupt]);

  const release = useCallback(() => {
    setSuppressAi(false);
    interruptedRef.current = false;
  }, []);

  const isInterrupted = interruptedRef.current;

  return { suppressAi, interrupted: isInterrupted, raise, release };
}

// ---------- Preparation countdown timer ----------

export function usePreparationTimer(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (remaining <= 0) {
      setExpired(true);
      return;
    }
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const reset = useCallback(() => {
    setRemaining(seconds);
    setExpired(false);
  }, [seconds]);

  const start = useCallback(() => {
    setRemaining(seconds);
  }, [seconds]);

  return { remaining, expired, reset, start };
}
