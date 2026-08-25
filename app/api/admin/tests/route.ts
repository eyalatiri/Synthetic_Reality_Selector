import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toTestDTO, type TestRow } from "@/lib/admin/types";
import { badRequest, serverError, asRecord } from "@/lib/admin/api-utils";

// GET /api/admin/tests — for the /admin/testing "Testing lab" page.
// Running a test (asking the questions, grading the responses) is the AI
// part; this route only manages the test-case records themselves.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("tests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json((data as TestRow[]).map(toTestDTO));
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/admin/tests — register a new test case (e.g. "create scenario
// test" before wiring it up to actually run against a persona).
export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());

    const name = body.name;
    if (typeof name !== "string" || !name.trim()) return badRequest("`name` is required");
    if (!["Scenario", "Regression", "Smoke"].includes(body.type as string)) {
      return badRequest("`type` must be 'Scenario', 'Regression', or 'Smoke'");
    }

    const { data, error } = await supabaseAdmin
      .from("tests")
      .insert({
        name,
        conversation_id: typeof body.conversationId === "string" ? body.conversationId : null,
        type: body.type,
        total_questions: typeof body.totalQuestions === "number" ? body.totalQuestions : 0,
        status: typeof body.status === "string" ? body.status : "Running",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(toTestDTO(data as TestRow), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
