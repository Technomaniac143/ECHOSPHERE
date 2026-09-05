"""Auth integration for EchoSphere frontend."""
import { ClerkProvider, auth } from "@clerk/nextjs";
import { ReactNode } from "react";

export { ClerkProvider, auth };

export function AuthProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}

export const USER_ROLE = {
  STUDENT: "student",
  HR_ADMIN: "hr_admin",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
