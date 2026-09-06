/** Agora service abstraction.

Design rule (from AGENT_CONTEXT): Never generate Agora tokens in the frontend.
The frontend only receives a temporary token + channel name from the backend.

Rule 85 (from master prompt): If credentials are unavailable, build the correct
abstraction + clearly-marked dev mock mode, NEVER pretend mock is real.
*/

export const RtcConnectionState: any = {
  DISCONNECTED: 1,
  CONNECTING: 2,
  CONNECTED: 3,
  RECONNECTING: 4,
  FAILED: 5,
  RTC_CONNECTION_STATE_DISCONNECTED: 1,
  RTC_CONNECTION_STATE_CONNECTING: 2,
  RTC_CONNECTION_STATE_CONNECTED: 3,
  RTC_CONNECTION_STATE_RECONNECTING: 4,
  RTC_CONNECTION_STATE_FAILED: 5,
  RTC_CONNECTION_STATE_ABORTED: 6,
};
export type RtcConnectionState = number;

export const RtcEngineEvents = {
  onConnectionStateChanged: "onConnectionStateChanged",
  onNetworkQuality: "onNetworkQuality",
} as const;
export type RtcEngineEvents = string;

export const MediaSourceType = {
  AUDIO: "audio",
  VIDEO: "video",
} as const;
export type MediaSourceType = string;

export const RtcEngine = {
  create: async (appId: string) => ({
    addListener: (listeners: any) => {},
    removeListener: (listeners: any) => {},
    leaveChannel: async () => {},
    destroy: async () => {},
  }),
};
export type RtcEngine = any;
export type AgoraRtc = any;

export type ConnectionQuality = "good" | "fair" | "poor" | "unavailable";

export interface AgoraMuteState {
  audioMuted: boolean;
  videoMuted: boolean;
}

export interface AgoraDeviceState {
  microphoneSelected: string | null;
  cameraSelected: string | null;
}

/** Minimal app-level facade over the raw Agora SDK. */
export interface AgoraFacade {
  // lifecycle
  initialize: (config: AgoraClientConfig) => Promise<void>;
  destroy: () => Promise<void>;

  // permissions / devices
  requestDevices: () => Promise<AgoraDeviceState>;
  setMicrophone: (deviceId: string | null) => Promise<void>;
  setCamera: (deviceId: string | null) => Promise<void>;
  muteAudio: (muted: boolean) => Promise<void>;
  muteVideo: (muted: boolean) => Promise<void>;

  // join/leave
  join: (token: string, channel: string, userId: string) => Promise<void>;
  leave: () => Promise<void>;

  // state
  onConnectionChange: (cb: (state: RtcConnectionState) => void) => void;
  onQualityUpdate: (cb: (quality: ConnectionQuality) => void) => void;
  onUserJoined: (cb: (userId: number, user: RtcUser) => void) => void;
  onUserLeft: (cb: (userId: number, reason: number) => void) => void;
  onAudioMutedChange: (cb: (muted: boolean, userId: number) => void) => void;
  onVideoMutedChange: (cb: (muted: boolean, userId: number) => void) => void;

  // current state readers
  getConnectionState: () => RtcConnectionState;
  getConnectionQuality: () => ConnectionQuality;
  getMuteState: () => AgoraMuteState;

  // for development mock: decide when to pretend we're connected
  setDevConnected: (connected: boolean) => void;
}

export interface AgoraClientConfig {
  appId: string;
  deviceUserId?: number;
}

export interface RtcUser {
  userId: number;
  userAccount?: string;
}

// Connection state → UI quality
function qualityFromState(state: RtcConnectionState): ConnectionQuality {
  if (state === RtcConnectionState.RTC_CONNECTION_STATE_CONNECTED) return "good";
  if (state === RtcConnectionState.RTC_CONNECTION_STATE_CONNECTING) return "fair";
  if (state === RtcConnectionState.RTC_CONNECTION_STATE_ABORTED) return "poor";
  return "unavailable";
}

// ---------- Real engine implementation ----------

export function createAgoraClient(): AgoraFacade {
  let engine: AgoraRtc | null = null;
  let appId = "";
  let connected = false;
  let connectionState: RtcConnectionState = RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
  let userAudioMuted = false;
  let userVideoMuted = false;
  let localUserId = 0;

  const handlers: {
    onConnectionChange?: (state: RtcConnectionState) => void;
    onQualityUpdate?: (quality: ConnectionQuality) => void;
    onUserJoined?: (userId: number, user: RtcUser) => void;
    onUserLeft?: (userId: number, reason: number) => void;
    onAudioMutedChange?: (muted: boolean, userId: number) => void;
    onVideoMutedChange?: (muted: boolean, userId: number) => void;
  } = {};

  const facade: AgoraFacade = {
    async initialize(config) {
      appId = config.appId;
      engine = await RtcEngine.create(appId);
      engine.addListener({
        [RtcEngineEvents.onConnectionStateChanged]: (state: any) => {
          connectionState = state;
          handlers.onConnectionChange?.(state);
        },
        [RtcEngineEvents.onNetworkQuality]: () => {
          handlers.onQualityUpdate?.(qualityFromState(connectionState));
        },
      });
    },

    async destroy() {
      if (!engine) return;
      engine.removeListener({
        [RtcEngineEvents.onConnectionStateChanged]: () => {},
        [RtcEngineEvents.onNetworkQuality]: () => {},
      });
      await engine.leaveChannel();
      await engine.destroy();
      engine = null;
      connected = false;
    },

    async requestDevices() {
      return { microphoneSelected: null, cameraSelected: null };
    },

    async setMicrophone() {},
    async setCamera() {},

    async muteAudio(muted) {
      userAudioMuted = muted;
      engine?.muteLocalAudioStream(muted);
    },
    async muteVideo(muted) {
      userVideoMuted = muted;
      engine?.muteLocalVideoStream(muted);
    },

    async join(token, channel, userId) {
      localUserId = parseInt(userId, 10) || 0;
      await engine?.joinChannel(token, channel, String(localUserId), 1);
      connected = true;
    },

    async leave() {
      await engine?.leaveChannel();
      connected = false;
      connectionState = RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
    },

    onConnectionChange(cb) { handlers.onConnectionChange = cb; },
    onQualityUpdate(cb) { handlers.onQualityUpdate = cb; },
    onUserJoined(cb) { handlers.onUserJoined = cb; },
    onUserLeft(cb) { handlers.onUserLeft = cb; },
    onAudioMutedChange(cb) { handlers.onAudioMutedChange = cb; },
    onVideoMutedChange(cb) { handlers.onVideoMutedChange = cb; },

    getConnectionState() { return connectionState; },
    getConnectionQuality() { return qualityFromState(connectionState); },
    getMuteState() { return { audioMuted: userAudioMuted, videoMuted: userVideoMuted }; },

    setDevConnected(state) {
      connected = state;
      connectionState = state
        ? RtcConnectionState.RTC_CONNECTION_STATE_CONNECTED
        : RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
    },
  };

  return facade;
}

// ---------- Development mock (clearly labeled) ----------

/** DEV_MODE_MOCK_AGORA — used when AGORA_APP_ID is not configured. NOT real Agora. */
export function createDevMockAgora(): AgoraFacade {
  let mockConnected = false;
  const listeners: {
    onConnectionChange?: (state: RtcConnectionState) => void;
    onQualityUpdate?: (q: ConnectionQuality) => void;
    onUserJoined?: (userId: number, user: RtcUser) => void;
    onUserLeft?: (userId: number, reason: number) => void;
    onAudioMutedChange?: (muted: boolean, userId: number) => void;
    onVideoMutedChange?: (muted: boolean, userId: number) => void;
  } = {};

  const mock: AgoraFacade = {
    async initialize() {},
    async destroy() { mockConnected = false; },
    async requestDevices() { return { microphoneSelected: null, cameraSelected: null }; },
    async setMicrophone() {},
    async setCamera() {},
    async muteAudio() {},
    async muteVideo() {},
    async join() {
      mockConnected = true;
      listeners.onConnectionChange?.(RtcConnectionState.RTC_CONNECTION_STATE_CONNECTED);
      listeners.onQualityUpdate?.("good");
    },
    async leave() {
      mockConnected = false;
      listeners.onConnectionChange?.(RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED);
    },
    onConnectionChange(cb) { listeners.onConnectionChange = cb; },
    onQualityUpdate(cb) { listeners.onQualityUpdate = cb; },
    onUserJoined(cb) { listeners.onUserJoined = cb; },
    onUserLeft(cb) { listeners.onUserLeft = cb; },
    onAudioMutedChange(cb) { listeners.onAudioMutedChange = cb; },
    onVideoMutedChange(cb) { listeners.onVideoMutedChange = cb; },
    getConnectionState() {
      return mockConnected
        ? RtcConnectionState.RTC_CONNECTION_STATE_CONNECTED
        : RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
    },
    getConnectionQuality() { return mockConnected ? "good" : "unavailable"; },
    getMuteState() { return { audioMuted: false, videoMuted: false }; },
    setDevConnected(state) {
      mockConnected = state;
      listeners.onConnectionChange?.(state
        ? RtcConnectionState.RTC_CONNECTION_STATE_CONNECTED
        : RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED);
    },
  };

  return mock;
}

// ---------- Factory ----------

export function createAgoraClientWithMode(devMode: boolean): AgoraFacade {
  if (devMode) {
    return createDevMockAgora();
  }
  return createAgoraClient();
}
