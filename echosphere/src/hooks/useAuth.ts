"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PersonaKey } from "@/types";

/**
 * Lightweight auth state bridge between server markers and client components.
 *
 * In production this should be backed by Clerk's client SDK (useAuth / useUser).
 * Here we keep a thin client-facing hook that reads from a server-injected context
 * marker (window.__CLERK_USER__) or falls back to a dev guest session so pages can
 * render without errors while credentials are configured.
 */
export function useAuth() {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string | null;
    role: "student" | "hr_admin";
    imageUrl?: string | null;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const marker = (typeof window !== "undefined" ? window.__CLERK_USER__ : null) as
      | { id: string; email: string; name: string | null; role: "student" | "hr_admin"; imageUrl?: string | null }
      | null
      | undefined;

    if (marker) {
      setUser(
        marker as {
          id: string;
          email: string;
          name: string | null;
          role: "student" | "hr_admin";
          imageUrl?: string | null;
        },
      );
    } else {
      // Dev guest: treat as student so the candidate UI can be explored.
      setUser({
        id: "dev-guest",
        email: "guest@echosphere.dev",
        name: "Demo Candidate",
        role: "student",
        imageUrl: null,
      });
    }
    setLoading(false);
  }, []);

  return { user, loading, mounted, isOrg: user?.role === "hr_admin", isCandidate: user?.role === "student" };
}

/**
 * Small wrapper used by AuthButton / login pages to trigger Clerk flows.
 * Real implementation calls Clerk client methods; dev path opens a mock flow.
 */
export async function signInWithGoogle(): Promise<void> {
  if (typeof window === "undefined") return;
  const clerkPublishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (clerkPublishable) {
    // In real usage: window.Clerk.client?.signIn?.create?.({ strategy: "oauth_google" })
    // For now we rely on the <ClerkProvider>-based SignIn page; this helper is the
    // affordance the landing CTA wires to.
    const existing = window.Clerk?.client;
    if (existing?.signIn) {
      await existing.signIn.create({ strategy: "oauth_google" });
      return;
    }
  }
  // Dev fallback: just store a marker so the app behaves like signed in.
  window.__CLERK_USER__ = {
    id: `google-${Date.now()}`,
    email: "demo@echosphere.dev",
    name: "Demo Candidate",
    role: "student",
    imageUrl: null,
  };
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const existing = window.Clerk?.client;
    if (existing?.signUp) {
      await existing.signUp.create({
        emailAddress: email,
        password,
      });
      return;
    }
  }
  window.__CLERK_USER__ = {
    id: `signup-${Date.now()}`,
    email,
    name: email.split("@")[0],
    role: "student",
    imageUrl: null,
  };
}
