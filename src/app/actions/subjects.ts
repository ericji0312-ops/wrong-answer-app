"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import type { Subject } from "@/types/domain";

export async function getSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface AddSubjectState {
  error?: string;
}

export async function addSubject(
  _prevState: AddSubjectState,
  formData: FormData
): Promise<AddSubjectState> {
  const name = formData.get("name");

  if (typeof name !== "string" || name.trim().length === 0) {
    return { error: "과목명을 입력해주세요." };
  }

  const { error } = await supabase.from("subjects").insert({ name: name.trim() });

  if (error) {
    if (error.code === "23505") return { error: "이미 등록된 과목명입니다." };
    return { error: "과목 등록 중 오류가 발생했습니다." };
  }

  revalidatePath("/subjects");
  revalidatePath("/students");
  revalidatePath("/tags");
  revalidatePath("/workbooks");
  revalidatePath("/register");
  return {};
}

export async function deleteSubject(subjectId: string) {
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) throw new Error(error.message);
  revalidatePath("/subjects");
  revalidatePath("/students");
  revalidatePath("/tags");
  revalidatePath("/workbooks");
  revalidatePath("/register");
}
