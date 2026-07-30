import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.rpc("submit_exam_attempt", {
    p_attempt_id: attemptId,
  });
  if (error) {
    console.error("Unable to submit exam after leaving tab", {
      attemptId,
      userId: user.id,
      code: error.code,
      message: error.message,
    });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ signedOut: true, submitted: !error });
}
