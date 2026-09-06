import type { IAgoraRTCClient, IMicrophoneAudioTrack, ICameraVideoTrack, IRemoteUser } from "agora-rtc-sdk-ng";

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

export type ConnectionQuality = "good" | "fair" | "poor" | "unavailable";

export interface AgoraMuteState {
  audioMuted: boolean;
  videoMuted: boolean;
}

export interface AgoraDeviceState {
  microphoneSelected: string | null;
  cameraSelected: string | null;
}

export interface AgoraFacade {
  initialize: (config: AgoraClientConfig) => Promise<void>;
  destroy: () => Promise<void>;
  requestDevices: () => Promise<AgoraDeviceState>;
  setMicrophone: (deviceId: string | null) => Promise<void>;
  setCamera: (deviceId: string | null) => Promise<void>;
  muteAudio: (muted: boolean) => Promise<void>;
  muteVideo: (muted: boolean) => Promise<void>;
  join: (token: string, channel: string, userId: string) => Promise<void>;
  leave: () => Promise<void>;
  onConnectionChange: (cb: (state: RtcConnectionState) => void) => void;
  onQualityUpdate: (cb: (quality: ConnectionQuality) => void) => void;
  onUserJoined: (cb: (userId: number, user: RtcUser) => void) => void;
  onUserLeft: (cb: (userId: number, reason: number) => void) => void;
  onAudioMutedChange: (cb: (muted: boolean, userId: number) => void) => void;
  onVideoMutedChange: (cb: (muted: boolean, userId: number) => void) => void;
  getConnectionState: () => RtcConnectionState;
  getConnectionQuality: () => ConnectionQuality;
  getMuteState: () => AgoraMuteState;
  setDevConnected: (connected: boolean) => void;
}

export interface AgoraClientConfig {
  appId: string;
  deviceUserId?: number;
}

export interface RtcUser {
  userId: number;
  userAccount?: string;
  audioTrack?: any;
  videoTrack?: any;
}

export function createAgoraClient(): AgoraFacade {
  let client: IAgoraRTCClient | null = null;
  let localAudioTrack: IMicrophoneAudioTrack | null = null;
  let localVideoTrack: ICameraVideoTrack | null = null;
  let connectionState: RtcConnectionState = RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
  let connectionQuality: ConnectionQuality = "unavailable";
  let userAudioMuted = false;
  let userVideoMuted = false;

  const handlers: {
    onConnectionChange?: (state: RtcConnectionState) => void;
    onQualityUpdate?: (quality: ConnectionQuality) => void;
    onUserJoined?: (userId: number, user: RtcUser) => void;
    onUserLeft?: (userId: number, reason: number) => void;
    onAudioMutedChange?: (muted: boolean, userId: number) => void;
    onVideoMutedChange?: (muted: boolean, userId: number) => void;
  } = {};

  const mapConnectionState = (state: string): RtcConnectionState => {
    switch (state) {
      case "CONNECTED": return RtcConnectionState.RTC_CONNECTION_STATE_CONNECTED;
      case "CONNECTING": return RtcConnectionState.RTC_CONNECTION_STATE_CONNECTING;
      case "DISCONNECTED": return RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
      case "DISCONNECTING": return RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
      case "RECONNECTING": return RtcConnectionState.RTC_CONNECTION_STATE_RECONNECTING;
      default: return RtcConnectionState.RTC_CONNECTION_STATE_DISCONNECTED;
    }
  };

  const facade: AgoraFacade = {
    async initialize(config) {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      
      client.on("connection-state-change", (curState, revState, reason) => {
        connectionState = mapConnectionState(curState);
        handlers.onConnectionChange?.(connectionState);
      });

      client.on("network-quality", (stats) => {
        let q: ConnectionQuality = "good";
        if (stats.uplinkNetworkQuality >= 4 || stats.downlinkNetworkQuality >= 4) q = "poor";
        else if (stats.uplinkNetworkQuality === 3 || stats.downlinkNetworkQuality === 3) q = "fair";
        connectionQuality = q;
        handlers.onQualityUpdate?.(q);
      });

      client.on("user-published", async (user: IRemoteUser, mediaType: "audio" | "video") => {
        if (!client) return;
        await client.subscribe(user, mediaType);
        
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
        
        if (mediaType === "video") {
            // Note: In Next.js/React, video playback is usually handled by the UI (e.g. assigning the track to a div).
            // But if we want to auto-play it, we could pass an element ID, though usually we just pass the track down.
            // user.videoTrack?.play("some-element-id");
        }
        
        const rtcUser: RtcUser = {
          userId: Number(user.uid),
          audioTrack: user.audioTrack,
          videoTrack: user.videoTrack,
        };
        handlers.onUserJoined?.(Number(user.uid), rtcUser);
      });

      client.on("user-unpublished", (user: IRemoteUser, mediaType: "audio" | "video") => {
        // Agora Web SDK handles unsubscription automatically
      });

      client.on("user-left", (user: IRemoteUser, reason: string) => {
        handlers.onUserLeft?.(Number(user.uid), 0);
      });
    },

    async destroy() {
      await this.leave();
      client = null;
    },

    async requestDevices() {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      if (!localAudioTrack) {
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await localAudioTrack.setMuted(userAudioMuted);
      }
      if (!localVideoTrack) {
        localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await localVideoTrack.setMuted(userVideoMuted);
      }
      return { microphoneSelected: null, cameraSelected: null };
    },

    async setMicrophone(deviceId) {
      if (localAudioTrack && deviceId) {
        await localAudioTrack.setDevice(deviceId);
      }
    },
    async setCamera(deviceId) {
      if (localVideoTrack && deviceId) {
        await localVideoTrack.setDevice(deviceId);
      }
    },

    async muteAudio(muted) {
      userAudioMuted = muted;
      if (localAudioTrack) {
        await localAudioTrack.setMuted(muted);
      }
    },
    async muteVideo(muted) {
      userVideoMuted = muted;
      if (localVideoTrack) {
        await localVideoTrack.setMuted(muted);
      }
    },

    async join(token, channel, userId) {
      if (!client) throw new Error("Initialize first");
      
      const numericUserId = parseInt(userId, 10) || 0;
      await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID || "", channel, token, numericUserId);
      
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      if (!localAudioTrack) localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      if (!localVideoTrack) localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      
      await localAudioTrack.setMuted(userAudioMuted);
      await localVideoTrack.setMuted(userVideoMuted);
      
      await client.publish([localAudioTrack, localVideoTrack]);
    },

    async leave() {
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        localAudioTrack = null;
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        localVideoTrack = null;
      }
      if (client) {
        await client.leave();
      }
    },

    onConnectionChange(cb) { handlers.onConnectionChange = cb; },
    onQualityUpdate(cb) { handlers.onQualityUpdate = cb; },
    onUserJoined(cb) { handlers.onUserJoined = cb; },
    onUserLeft(cb) { handlers.onUserLeft = cb; },
    onAudioMutedChange(cb) { handlers.onAudioMutedChange = cb; },
    onVideoMutedChange(cb) { handlers.onVideoMutedChange = cb; },

    getConnectionState() { return connectionState; },
    getConnectionQuality() { return connectionQuality; },
    getMuteState() { return { audioMuted: userAudioMuted, videoMuted: userVideoMuted }; },

    setDevConnected(state) {}
  };

  return facade;
}

export function createDevMockAgora(): AgoraFacade {
  return createAgoraClient();
}

export function createAgoraClientWithMode(devMode: boolean): AgoraFacade {
  return createAgoraClient();
}
