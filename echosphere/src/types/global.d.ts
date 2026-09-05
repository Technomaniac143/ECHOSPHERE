// Global type declarations for window extensions used by EchoSphere.
// These bridge the gap between Next.js SSR and browser-only globals.

declare global {
  interface Window {
    /** Agora RTC engine instance (set after initialization in useAgora). */
    AgoraRtcEngine?: unknown;
    /** Clerk user object injected by ClerkProvider during SSR/hydration. */
    Clerk?: unknown;
    /** Clerk user ID injected for server-component hydration. */
    __CLERK_USER__?: string | null;
    /** Overrides API base URL for dev proxying (set by _app or middleware). */
    __NEXT_PUBLIC_API_URL__?: string;
  }
}

export {};
