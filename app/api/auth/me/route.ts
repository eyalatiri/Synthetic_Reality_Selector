import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";

// GET /api/auth/me - the current user's id/role, for client components
// (e.g. the Users page uses it to hide "delete"/"demote" on your own row).
export async function GET() {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    id: session.id,
    email: session.email,
    fullName: session.fullName,
    role: session.role,
  });
}
