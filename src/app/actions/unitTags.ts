"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import type { UnitTag } from "@/types/domain";

export async function getUnitTags(subjectId?: string): Promise<UnitTag[]> {
  let query = supabase
    .from("unit_tags")
    .select("*")
    .order("unit", { ascending: true })
    .order("problem_type", { ascending: true });

  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data ?? [];
}

// 들여쓰기 아웃라인 텍스트를 파싱한다:
//   이차함수
//   - 이차함수의 최댓값·최솟값 활용
//   - 이차함수와 직선의 위치관계
// 들여쓰기/기호 없이 시작하는 줄은 단원, "-"(또는 "*", "•")로 시작하는 줄은
// 직전 단원에 속하는 세부 유형으로 취급한다.
function parseUnitTagsText(text: string): { unit: string; problem_type: string }[] {
  const result: { unit: string; problem_type: string }[] = [];
  let currentUnit = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const bulletMatch = line.match(/^[-*•]\s*(.+)$/);
    if (bulletMatch) {
      const problemType = bulletMatch[1].trim();
      if (currentUnit && problemType) {
        result.push({ unit: currentUnit, problem_type: problemType });
      }
    } else {
      currentUnit = line.replace(/[:：]\s*$/, "").trim();
    }
  }

  return result;
}

export interface UploadUnitTagsState {
  error?: string;
  addedCount?: number;
}

export async function uploadUnitTags(
  _prevState: UploadUnitTagsState,
  formData: FormData
): Promise<UploadUnitTagsState> {
  const subjectId = formData.get("subjectId");
  if (typeof subjectId !== "string" || subjectId.length === 0) {
    return { error: "과목을 먼저 선택해주세요." };
  }

  const text = formData.get("text");
  if (typeof text !== "string" || text.trim().length === 0) {
    return { error: "붙여넣을 분류 항목 텍스트를 입력해주세요." };
  }

  const parsed = parseUnitTagsText(text);
  if (parsed.length === 0) {
    return {
      error:
        "인식된 항목이 없습니다. 단원명 줄 아래에 \"- 세부유형\" 형태로 입력해주세요.",
    };
  }

  const { error } = await supabase
    .from("unit_tags")
    .upsert(
      parsed.map((tag) => ({ ...tag, subject_id: subjectId })),
      { onConflict: "subject_id,unit,problem_type", ignoreDuplicates: true }
    );

  if (error) return { error: "저장 중 오류가 발생했습니다." };

  revalidatePath("/tags");
  revalidatePath("/register");
  return { addedCount: parsed.length };
}

export async function deleteUnitTag(id: string) {
  const { error } = await supabase.from("unit_tags").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tags");
  revalidatePath("/register");
}
