import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/callback - OAuth (Microsoft Entra ID / "azure" provider) returns
// here with ?code=...; exchange it for a session cookie, then hand off to
// /auth/continue for the role-based redirect. First-time SSO users get an
// 'employee' profile automatically (see handle_new_user() in migration 0006);
// an admin promotes them from /admin/users if needed.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/auth/continue", req.url));
  }
  return NextResponse.redirect(new URL("/?error=auth", req.url));
}
