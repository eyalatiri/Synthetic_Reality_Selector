import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HOME_BY_ROLE, safeNextPath, type UserRole } from "@/lib/auth/roles";

// GET /auth/continue - the ONE place that decides where a freshly signed-in
// user lands. The sign-in page and the SSO callback both end up here.
//
//   employee -> /experience           (never sees the role chooser)
//   admin    -> ?next if given, else /select-role (pick /experience or /admin)
//   suspended / no profile -> signed out, back to /?error=suspended
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/", req.url));

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "Active") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/?error=suspended", req.url));
  }

  await supabaseAdmin.from("profiles").update({ last_sign_in_at: new Date().toISOString() }).eq("id", user.id);

  const role = profile.role as UserRole;
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  // Employees ignore ?next on purpose: their only destination is /experience.
  const destination = role === "admin" && next ? next : HOME_BY_ROLE[role];

  return NextResponse.redirect(new URL(destination, req.url));
}
