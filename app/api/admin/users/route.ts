import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { toUserDTO, type UserRow } from "@/lib/admin/types";
import { asRecord, badRequest } from "@/lib/admin/api-utils";
import { MIN_PASSWORD_LENGTH, isValidEmail, userApiError } from "@/lib/admin/user-api";

// GET /api/admin/users - every profile, newest first.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { data, error } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json((data as UserRow[]).map(toUserDTO));
  } catch (error) {
    return userApiError(error);
  }
}

// POST /api/admin/users - create a user with a temporary password.
// Creates the auth.users row (service role, email pre-confirmed so they can
// sign in immediately), then sets role/name/department on the profile that
// the handle_new_user() trigger just created (always as 'employee').
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let createdUserId: string | null = null;
  try {
    const body = asRecord(await req.json());

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(email)) return badRequest("A valid `email` is required");

    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const department = typeof body.department === "string" ? body.department.trim() : "";
    const role = body.role === "admin" ? "admin" : "employee";

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError) throw createError;
    createdUserId = created.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, email, role, full_name: fullName, department, status: "Active" })
      .select("*")
      .single();
    if (profileError) throw profileError;

    return NextResponse.json(toUserDTO(profile as UserRow), { status: 201 });
  } catch (error) {
    // Don't leave an orphaned auth user (with the wrong role) behind.
    if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
    return userApiError(error);
  }
}
