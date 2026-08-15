"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

export async function getSubjectIdsForStudent(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("student_subjects")
    .select("subject_id")
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.subject_id);
}

export async function getStudentSubjectMap(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from("student_subjects").select("*");
  if (error) throw new Error(error.message);

  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const list = map[row.student_id] ?? [];
    list.push(row.subject_id);
    map[row.student_id] = list;
  }
  return map;
}

export async function setStudentSubjects(studentId: string, subjectIds: string[]) {
  const { error: deleteError } = await supabase
    .from("student_subjects")
    .delete()
    .eq("student_id", studentId);
  if (deleteError) throw new Error(deleteError.message);

  if (subjectIds.length > 0) {
    const { error: insertError } = await supabase
      .from("student_subjects")
      .insert(subjectIds.map((subjectId) => ({ student_id: studentId, subject_id: subjectId })));
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/students");
  revalidatePath("/register");
}
