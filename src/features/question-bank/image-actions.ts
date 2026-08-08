"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadQuestionImage } from "@/lib/question-image-storage";
import { addBankQuestion, createActivityWithQuestions } from "./actions";
async function teacher() {
  const supabase = await createClient("teacher"),
    {
      data: { user },
    } = await supabase.auth.getUser();
  if (!user) redirect("/auth/teacher/login");
  return { supabase, user };
}
export async function addBankQuestionWithUploadedImage(formData: FormData) {
  const { supabase, user } = await teacher();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(formData.get("payload")));
  } catch {
    redirect("/teacher/question-bank?error=question");
  }
  try {
    payload.imageUrl =
      (await uploadQuestionImage(
        supabase,
        user.id,
        formData.get("questionImage"),
      )) ?? payload.imageUrl;
  } catch {
    redirect("/teacher/question-bank?error=image");
  }
  formData.set("payload", JSON.stringify(payload));
  return addBankQuestion(formData);
}
export async function createActivityWithUploadedQuestions(formData: FormData) {
  const { supabase, user } = await teacher();
  let payload: {
    newQuestions?: Array<{ imageUrl?: string; pageImageUrl?:string; imageGroupIndex?: number }>;
  };
  try {
    payload = JSON.parse(String(formData.get("payload")));
  } catch {
    redirect("/teacher/question-bank?error=activity");
  }
  try {
    const groupIds = [
        ...new Set(
          (payload.newQuestions ?? []).flatMap((question) =>
            question.imageGroupIndex === undefined
              ? []
              : [question.imageGroupIndex],
          ),
        ),
      ],
      images = new Map<number, string>();
    for (const groupId of groupIds) {
      const image = await uploadQuestionImage(
        supabase,
        user.id,
        formData.get(`questionGroupImage_${groupId}`),
      );
      if (image) images.set(groupId, image);
    }
    const groupIndexes=new Map<number,number>();
    for (const question of payload.newQuestions ?? [])if(question.imageGroupIndex!==undefined){const index=groupIndexes.get(question.imageGroupIndex)??0;groupIndexes.set(question.imageGroupIndex,index+1);question.pageImageUrl=images.get(question.imageGroupIndex)??"";question.imageUrl=await uploadQuestionImage(supabase,user.id,formData.get(`questionImage_${question.imageGroupIndex}_${index}`))??question.imageUrl??"";}
  } catch {
    redirect("/teacher/question-bank?error=image");
  }
  formData.set("payload", JSON.stringify(payload));
  return createActivityWithQuestions(formData);
}
