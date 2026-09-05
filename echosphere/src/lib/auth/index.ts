import { auth, clerkClient } from "@clerk/nextjs/server";
import type { UserRole } from "@/types";

/**
 * Thin Clerk helpers so the rest of the app isn't spread across raw Clerk calls.
 * These return typed shapes we use internally; they do not expose any secret key.
 */

export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  imageUrl?: string | null;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  // Role lives in metadata (set during signup / org onboarding).
  // Fallback to "student" for backwards compatibility.
  const role: UserRole = (user.publicMetadata?.role as UserRole) ?? "student";

  return {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    name: user.firstName ? `${user.firstName} ${user.lastName}`.trim() : user.username ?? null,
    role,
    imageUrl: user.imageUrl ?? null,
  };
}

export async function requireAuth(): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  imageUrl?: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  imageUrl?: string | null;
}> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Minimal front-end helpers (used in client components).
 * These read from localStorage / Clerks's client state rather than server secrets.
 */
export function getPublishableKey(): string {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
}

/**
 * Whether the current session is an organization (hr_admin) session.
 * Useful for early redirects in middleware/server components.
 */
export function isOrgRole(role: UserRole): boolean {
  return role === "hr_admin";
}

export function isCandidateRole(role: UserRole): boolean {
  return role === "student";
}
