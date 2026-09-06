"use client";

/**
 * useAuth — reads the Clerk user from window.__CLERK_USER__.
 *
 * No dev-guest fallback. If no user is authenticated, `user` is null.
 * Pages are responsible for redirecting unauthenticated users to /auth/*.
 */

import { useEffect, useState } from "react";

declare global {
  interface Window {
    __CLERK_USER__?: {
      id: string;
      email: string;
      name: string | null;
      role: "student" | "hr_admin";
      imageUrl?: string | null;
    } | null;
    Clerk?: {
      client?: {
        signIn?: { create: (args: unknown) => Promise<unknown> };
        signUp?: { create: (args: unknown) => Promise<unknown> };
      };
    };
  }
}

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: "student" | "hr_admin";
  imageUrl?: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const marker =
      typeof window !== "undefined" ? (window.__CLERK_USER__ ?? null) : null;

    // Strictly typed: null means "not signed in"
    setUser(marker ?? null);
    setLoading(false);
  }, []);

  return {
    user,
    loading,
    mounted,
    isOrg: user?.role === "hr_admin",
    isCandidate: user?.role === "student",
  };
}

/**
 * Trigger Clerk Google OAuth sign-in.
 * Throws if Clerk is not loaded; callers must handle the error.
 */
export async function signInWithGoogle(): Promise<void> {
  if (typeof window === "undefined") return;

  const clerk = window.Clerk;
  if (!clerk?.client?.signIn) {
    throw new Error(
      "Clerk is not loaded. Ensure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set to a valid key."
    );
  }

  await clerk.client.signIn.create({ strategy: "oauth_google" });
}

/**
 * Trigger Clerk email + password sign-up.
 * Throws on failure; callers must handle the error.
 */
export async function signUpWithEmail(email: string, password: string): Promise<void> {
  if (typeof window === "undefined") return;

  const clerk = window.Clerk;
  if (!clerk?.client?.signUp) {
    throw new Error(
      "Clerk is not loaded. Ensure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set to a valid key."
    );
  }

  await clerk.client.signUp.create({ emailAddress: email, password });
}
