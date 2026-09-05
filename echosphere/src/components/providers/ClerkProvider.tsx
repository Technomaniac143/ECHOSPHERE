"use client"

import { ClerkProvider as ClerkNextjsProvider } from "@clerk/nextjs"
import { ReactNode } from "react"

export function ClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkNextjsProvider>{children}</ClerkNextjsProvider>
  )
}
