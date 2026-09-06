"use client"

import { ClerkProvider as ClerkNextjsProvider } from "@clerk/nextjs"
import { ReactNode } from "react"

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""

// Clerk requires a real key that starts with "pk_test_" or "pk_live_" and
// contains a valid host (the base64 segment decodes to a Clerk Frontend API URL).
// If the key is a placeholder / mock, skip ClerkProvider entirely so that
// the dev-guest fallback in useAuth.ts kicks in without JS errors.
function isRealClerkKey(key: string): boolean {
  if (!key.startsWith("pk_test_") && !key.startsWith("pk_live_")) return false
  try {
    const payload = key.split("_")[2] ?? ""
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    // A valid Clerk Frontend API hostname contains at least one dot
    return decoded.includes(".")
  } catch {
    return false
  }
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!isRealClerkKey(PUBLISHABLE_KEY)) {
    // Dev mode: no real Clerk key — render children directly.
    // The useAuth hook already provides a dev-guest user in this case.
    return <>{children}</>
  }

  return (
    <ClerkNextjsProvider publishableKey={PUBLISHABLE_KEY}>
      {children}
    </ClerkNextjsProvider>
  )
}
