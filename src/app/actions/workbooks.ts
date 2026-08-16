"use server";

import { revalidatePath } from "next/cache";
import { supabase, WORKBOOK_PDF_BUCKET } from "@/lib/supabaseClient";
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
    .order("part_order", { ascending: true })
    .order("problem_number", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// PDF는 브라우저에서 workbook-pdfs 버킷으로 직접 업로드된 뒤, 여기서는 그
// 경로만 받아 서버 쪽에서 내려받는다. Vercel 서버리스 함수는 요청 본문이
// 약 4.5MB를 넘으면 플랫폼 레벨에서 413으로 막아버려서, 스캔본 같은 큰
// PDF를 서버 액션에 직접(FormData로) 실어 보낼 수 없기 때문이다.
export async function parseWorkbookPdfFromStorage(
  subjectId: string,
  storagePath: string
): Promise<{ problems: ParsedWorkbookProblem[] }> {
  const {
    data: { publicUrl },
  } = supabase.storage.from(WORKBOOK_PDF_BUCKET).getPublicUrl(storagePath);

  try {
    const fileResponse = await fetch(publicUrl);
    if (!fileResponse.ok) {
      throw new Error("업로드된 PDF를 불러오지 못했습니다.");
    }
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    const allowedTags = await getUnitTags(subjectId);
    const { problems } = await parseWorkbookPdf(buffer, allowedTags);
    return { problems };
  } catch (error) {
    console.error("parseWorkbookPdf failed", error);
    throw error;
  } finally {
    await supabase.storage.from(WORKBOOK_PDF_BUCKET).remove([storagePath]);
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
      part: p.part,
      part_order: p.part_order,
      problem_number: p.problem_number,
      unit: p.unit,
      problem_type: p.problem_type,
      difficulty: p.difficulty,
    })),
    { onConflict: "workbook_id,part,problem_number" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/workbooks");
  revalidatePath("/register");
}

export async function updateWorkbookProblem(
  id: string,
  patch: { part: string; problem_number: number; unit: string; problem_type: string; difficulty: string }
) {
  const unit = patch.unit.trim();
  const problemType = patch.problem_type.trim();
  if (!unit || !problemType) {
    throw new Error("단원과 세부 유형을 입력해주세요.");
  }
  if (!Number.isInteger(patch.problem_number)) {
    throw new Error("문제 번호를 올바르게 입력해주세요.");
  }

  const { error } = await supabase
    .from("workbook_problems")
    .update({
      part: patch.part.trim(),
      problem_number: patch.problem_number,
      unit,
      problem_type: problemType,
      difficulty: patch.difficulty,
    })
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
