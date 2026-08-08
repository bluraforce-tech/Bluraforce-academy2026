"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTeacherEducationTarget } from "@/lib/teacher-education-context";
async function teacher() {
  const s = await createClient(),
    {
      data: { user },
    } = await s.auth.getUser();
  if (!user) redirect("/auth/teacher/login");
  return { s, user };
}
export async function createUnit(formData: FormData) {
  const { s } = await teacher(),
    target = await requireTeacherEducationTarget(),
    input = z.string().trim().min(2).max(200).safeParse(formData.get("title"));
  if (!input.success) redirect("/teacher/question-bank?error=unit");
  const { error } = await s.rpc("create_question_bank_unit", {
    p_title: input.data,
    p_description: String(formData.get("description") ?? ""),
    p_education_system: target.educationSystem,
    p_national_grade: target.nationalGrade,
  });
  if (error) {
    console.error("Question Bank unit RPC failed", {
      code: error.code,
      message: error.message,
    });
    redirect(
      `/teacher/question-bank?error=${error.code === "PGRST202" || error.code === "42883" ? "migration" : "unit-save"}`,
    );
  }
  revalidatePath("/teacher/question-bank");
  redirect("/teacher/question-bank?created=unit");
}
export async function deleteUnit(formData: FormData) {
  const { s, user } = await teacher(),
    id = z.string().uuid().safeParse(formData.get("unitId"));
  if (id.success)
    await s
      .from("question_bank_units")
      .delete()
      .eq("id", id.data)
      .eq("teacher_id", user.id);
  revalidatePath("/teacher/question-bank");
  redirect("/teacher/question-bank");
}
export async function addBankQuestion(formData: FormData) {
  const { s, user } = await teacher();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload")));
  } catch {
    redirect("/teacher/question-bank?error=question");
  }
  const schema = z.object({
      unitId: z.string().uuid(),
      text: z.string().trim().max(5000),
      imageUrl: z.union([z.literal(""), z.string().url()]),
      points: z.number().positive(),
      choices: z
        .array(
          z.object({ text: z.string().trim().min(1), isCorrect: z.boolean() }),
        )
        .min(2)
        .refine((x) => x.some((c) => c.isCorrect)),
    }),
    p = schema.safeParse(payload);
  if (!p.success) redirect("/teacher/question-bank?error=question");
  const { data: u } = await s
    .from("question_bank_units")
    .select("id")
    .eq("id", p.data.unitId)
    .eq("teacher_id", user.id)
    .single();
  if (!u) redirect("/teacher/question-bank?error=unit");
  const { count } = await s
      .from("question_bank_questions")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", u.id),
    { data: q, error } = await s
      .from("question_bank_questions")
      .insert({
        unit_id: u.id,
        text: p.data.text,
        image_url: p.data.imageUrl || null,
        points: p.data.points,
        position: (count ?? 0) + 1,
      })
      .select("id")
      .single();
  if (error || !q) redirect("/teacher/question-bank?error=question");
  await s
    .from("question_bank_choices")
    .insert(
      p.data.choices.map((c, i) => ({
        question_id: q.id,
        text: c.text,
        is_correct: c.isCorrect,
        position: i + 1,
      })),
    );
  revalidatePath("/teacher/question-bank");
  redirect("/teacher/question-bank?created=question");
}
export async function createUnitActivity(formData: FormData) {
  const { s } = await teacher(),
    p = z
      .object({
        unitId: z.string().uuid(),
        title: z.string().trim().min(3).max(200),
        kind: z.enum(["self_practice", "homework"]),
        deadline: z.string().optional(),
        assignAll: z.string().optional(),
      })
      .safeParse(Object.fromEntries(formData));
  if (!p.success || (p.data.kind === "homework" && !p.data.deadline))
    redirect("/teacher/question-bank?error=activity");
  const { error } = await s.rpc("create_activity_from_unit", {
    p_unit_id: p.data.unitId,
    p_title: p.data.title,
    p_kind: p.data.kind,
    p_deadline: p.data.deadline
      ? new Date(p.data.deadline).toISOString()
      : null,
    p_assign_all: p.data.assignAll === "on",
    p_student_ids: [],
  });
  if (error) redirect("/teacher/question-bank?error=activity");
  revalidatePath("/teacher/question-bank");
  revalidatePath("/student/teachers");
  redirect("/teacher/question-bank?created=activity");
}
export async function createActivityWithQuestions(formData: FormData) {
  const { s, user } = await teacher();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    redirect("/teacher/question-bank?error=activity");
  }
  const choice = z.object({
      text: z.string().trim().min(1).max(500),
      isCorrect: z.boolean(),
    }),
    newQuestion = z.object({
      text: z.string().trim().max(5000),
      imageUrl: z.union([z.literal(""), z.string().url()]),
      pageImageUrl: z.union([z.literal(""), z.string().url()]).optional(),
      questionNumber: z.number().int().positive(),
      points: z.number().positive().max(1000),
      choices: z
        .array(choice)
        .min(2)
        .refine((v) => v.some((c) => c.isCorrect)),
    }),
    parsed = z
      .object({
        unitId: z.string().uuid(),
        title: z.string().trim().min(3).max(200),
        kind: z.enum(["self_practice", "homework"]),
        deadline: z.string().nullable(),
        assignAll: z.boolean(),
        questionIds: z.array(z.string().uuid()),
        newQuestions: z.array(newQuestion),
        assignmentMode: z.boolean().optional(),
      })
      .refine((v) => v.kind !== "homework" || Boolean(v.deadline))
      .refine((v) => v.questionIds.length + v.newQuestions.length > 0)
      .safeParse(raw);
  if (!parsed.success) redirect("/teacher/question-bank?error=activity");
  const input = parsed.data,
    { data: unit } = await s
      .from("question_bank_units")
      .select("id")
      .eq("id", input.unitId)
      .eq("teacher_id", user.id)
      .single();
  if (!unit) redirect("/teacher/question-bank?error=unit");
  const { data: owned } = input.questionIds.length
    ? await s
        .from("question_bank_questions")
        .select("id")
        .eq("unit_id", unit.id)
        .in("id", input.questionIds)
    : { data: [] };
  if ((owned ?? []).length !== input.questionIds.length)
    redirect("/teacher/question-bank?error=activity");
  const { count } = await s
    .from("question_bank_questions")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", unit.id);
  let position = count ?? 0;
  const ids = [...input.questionIds];
  for (const question of [...input.newQuestions].sort((a,b)=>a.questionNumber-b.questionNumber)) {
    position++;
    const { data: q, error } = await s
      .from("question_bank_questions")
      .insert({
        unit_id: unit.id,
        text: question.text,
        image_url: question.imageUrl || null,
        page_image_url: question.pageImageUrl || null,
        points: question.points,
        position,
      })
      .select("id")
      .single();
    if (error || !q) redirect("/teacher/question-bank?error=question");
    const { error: choicesError } = await s
      .from("question_bank_choices")
      .insert(
        question.choices.map((c, i) => ({
          question_id: q.id,
          text: c.text,
          is_correct: c.isCorrect,
          position: i + 1,
        })),
      );
    if (choicesError) redirect("/teacher/question-bank?error=question");
    ids.push(q.id);
  }
  const { data: activityId, error } = await s.rpc(
    "create_activity_from_questions",
    {
      p_unit_id: unit.id,
      p_question_ids: ids,
      p_title: input.title,
      p_kind: input.kind,
      p_deadline: input.deadline
        ? new Date(input.deadline).toISOString()
        : null,
      p_assign_all: input.assignAll,
      p_student_ids: [],
    },
  );
  if (error || !activityId) redirect("/teacher/question-bank?error=activity");
  const { error: unitLinkError } = await s
    .from("exams")
    .update({ source_unit_id: unit.id })
    .eq("id", activityId)
    .eq("teacher_id", user.id);
  if (unitLinkError) redirect("/teacher/question-bank?error=activity");
  revalidatePath("/teacher/question-bank");
  revalidatePath("/teacher/assignments");
  revalidatePath("/student/teachers");
  redirect(
    input.assignmentMode
      ? "/teacher/assignments?created=1"
      : "/teacher/question-bank?created=activity",
  );
}
