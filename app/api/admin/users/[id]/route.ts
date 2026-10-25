import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { toUserDTO, type UserRow } from "@/lib/admin/types";
import { asRecord, badRequest, notFound } from "@/lib/admin/api-utils";
import { MIN_PASSWORD_LENGTH, userApiError } from "@/lib/admin/user-api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return notFound(`User ${id} not found`);
    return NextResponse.json(toUserDTO(data as UserRow));
  } catch (error) {
    return userApiError(error);
  }
}

// PATCH /api/admin/users/:id - edit name/department, change role, suspend or
// reactivate, and/or reset the password. Any subset of fields is accepted.
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = asRecord(await req.json());
    const isSelf = id === guard.admin.id;

    const patch: Record<string, unknown> = {};
    if (typeof body.fullName === "string") patch.full_name = body.fullName.trim();
    if (typeof body.department === "string") patch.department = body.department.trim();

    if (body.role === "admin" || body.role === "employee") {
      if (isSelf && body.role !== "admin") return badRequest("You can't remove your own administrator role.");
      patch.role = body.role;
    }
    if (body.status === "Active" || body.status === "Suspended") {
      if (isSelf && body.status === "Suspended") return badRequest("You can't suspend your own account.");
      patch.status = body.status;
    }

    const password = typeof body.password === "string" && body.password ? body.password : null;
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (Object.keys(patch).length === 0 && !password) return badRequest("No updatable fields provided");

    // Profile first: the protect_last_admin trigger can veto the change, and
    // we want that to happen before we touch auth.users.
    let row: UserRow | null = null;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabaseAdmin.from("profiles").update(patch).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return notFound(`User ${id} not found`);
      row = data as UserRow;
    }

    // Mirror status into Supabase Auth (a ban also blocks token refresh) and
    // apply a password reset if one was supplied.
    const authUpdate: { ban_duration?: string; password?: string } = {};
    if (patch.status) authUpdate.ban_duration = patch.status === "Suspended" ? "876000h" : "none";
    if (password) authUpdate.password = password;
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
      if (error) throw error;
    }

    if (!row) {
      const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return notFound(`User ${id} not found`);
      row = data as UserRow;
    }
    return NextResponse.json(toUserDTO(row));
  } catch (error) {
    return userApiError(error);
  }
}

// DELETE /api/admin/users/:id - removes the auth user; the profile row goes
// with it via ON DELETE CASCADE. Conversations they created are kept
// (conversations.creator_user is plain text, not a foreign key).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    if (id === guard.admin.id) return badRequest("You can't delete your own account.");

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return notFound(`User ${id} not found`);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return userApiError(error);
  }
}
