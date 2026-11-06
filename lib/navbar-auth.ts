import type { ProfileRole } from "./supabase/database";

export type NavbarAuthView =
  | "loading"
  | "anonymous"
  | "customer"
  | "admin"
  | "unverified";

export function getNavbarAuthView(
  isReady: boolean,
  userId: string | null,
  profileUserId: string | null,
  role: ProfileRole | null,
): NavbarAuthView {
  if (!isReady) return "loading";
  if (!userId) return "anonymous";
  if (userId !== profileUserId) return "unverified";
  if (role === "admin") return "admin";
  if (role === "customer") return "customer";
  return "unverified";
}
