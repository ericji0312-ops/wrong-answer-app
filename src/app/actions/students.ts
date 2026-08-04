"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import type { Student } from "@/types/domain";

export async function getStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface AddStudentState {
  error?: string;
}

export async function addStudent(
  _prevState: AddStudentState,
  formData: FormData
): Promise<AddStudentState> {
  const name = formData.get("name");
  const grade = formData.get("grade");
  const level = formData.get("level");

  if (typeof name !== "string" || name.trim().length === 0) {
    return { error: "학생 이름을 입력해주세요." };
  }

  const { error } = await supabase.from("students").insert({
    name: name.trim(),
    grade: typeof grade === "string" && grade.length > 0 ? grade : null,
    level: typeof level === "string" && level.length > 0 ? level : null,
  });

  if (error) return { error: "학생 등록 중 오류가 발생했습니다." };

  revalidatePath("/students");
  revalidatePath("/register");
  return {};
}

export async function deleteStudent(studentId: string) {
  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) throw new Error(error.message);
  revalidatePath("/students");
  revalidatePath("/register");
}
