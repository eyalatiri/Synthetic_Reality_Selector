import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { UserRole, UserStatus } from "./roles";

export type SessionProfile = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
};

/** The signed-in user + their profile, or null. Re-validates the JWT with Supabase (getUser, not getSession). */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, status, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!data || data.status !== "Active") return null;

  return {
    id: data.id,
    email: data.email,
    role: data.role as UserRole,
    status: data.status as UserStatus,
    fullName: data.full_name ?? "",
  };
}

/**
 * Defence in depth for sensitive route handlers. proxy.ts already blocks
 * non-admins from /api/admin/*, but the user-management endpoints re-check
 * so they stay safe even if the proxy matcher is ever changed or bypassed.
 *
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 *   guard.admin.id // the caller
 */
export async function requireAdmin(): Promise<
  { ok: true; admin: SessionProfile } | { ok: false; response: NextResponse }
> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (session.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Administrator access required" }, { status: 403 }) };
  }
  return { ok: true, admin: session };
}
