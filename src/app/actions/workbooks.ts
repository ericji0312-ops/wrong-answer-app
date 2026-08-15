"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import { parseWorkbookPdf, type ParsedWorkbookProblem } from "@/lib/gemini";
import { getUnitTags } from "@/app/actions/unitTags";
import type { Workbook, WorkbookProblem } from "@/types/domain";

export async function getWorkbooks(subjectId?: string): Promise<Workbook[]> {
  let query = supabase.from("workbooks").select("*").order("title", { ascending: true });
  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createWorkbook(subjectId: string, title: string): Promise<Workbook> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("문제집 제목을 입력해주세요.");

  const { data, error } = await supabase
    .from("workbooks")
    .insert({ subject_id: subjectId, title: trimmed })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/workbooks");
  revalidatePath("/register");
  return data;
}

export async function deleteWorkbook(id: string) {
  const { error } = await supabase.from("workbooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/workbooks");
  revalidatePath("/register");
}

export async function getWorkbookProblems(workbookId: string): Promise<WorkbookProblem[]> {
  const { data, error } = await supabase
    .from("workbook_problems")
    .select("*")
    .eq("workbook_id", workbookId)
    .order("problem_number", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function parseWorkbookPdfUpload(
  subjectId: string,
  formData: FormData
): Promise<{ problems: ParsedWorkbookProblem[] }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("PDF 파일을 선택해주세요.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const allowedTags = await getUnitTags(subjectId);
  try {
    const { problems } = await parseWorkbookPdf(buffer, allowedTags);
    return { problems };
  } catch (error) {
    console.error("parseWorkbookPdf failed", error);
    throw error;
  }
}

export async function saveWorkbookProblems(
  workbookId: string,
  problems: ParsedWorkbookProblem[]
) {
  if (problems.length === 0) return;

  const { error } = await supabase.from("workbook_problems").upsert(
    problems.map((p) => ({
      workbook_id: workbookId,
      problem_number: p.problem_number,
      unit: p.unit,
      problem_type: p.problem_type,
      difficulty: p.difficulty,
    })),
    { onConflict: "workbook_id,problem_number" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/workbooks");
  revalidatePath("/register");
}

export async function updateWorkbookProblem(
  id: string,
  patch: { unit: string; problem_type: string; difficulty: string }
) {
  const unit = patch.unit.trim();
  const problemType = patch.problem_type.trim();
  if (!unit || !problemType) {
    throw new Error("단원과 세부 유형을 입력해주세요.");
  }

  const { error } = await supabase
    .from("workbook_problems")
    .update({ unit, problem_type: problemType, difficulty: patch.difficulty })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/workbooks");
  revalidatePath("/register");
}

export async function deleteWorkbookProblem(id: string) {
  const { error } = await supabase.from("workbook_problems").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/workbooks");
  revalidatePath("/register");
}
