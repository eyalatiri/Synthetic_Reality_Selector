import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /auth/signout - POST (not GET) so a stray <img>/link can't log people out.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // 303 so the browser follows the redirect with GET.
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
