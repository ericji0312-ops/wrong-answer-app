"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabase, WRONG_ANSWER_BUCKET } from "@/lib/supabaseClient";
import { analyzeWrongAnswer, classifyWrongAnswer } from "@/lib/gemini";
import { getUnitTags } from "@/app/actions/unitTags";
import type { ClassificationResult, Difficulty, WrongAnswer } from "@/types/domain";
import { DIFFICULTIES } from "@/types/domain";

export interface ClassifyState {
  error?: string;
  imageUrl?: string;
  rawResponse?: string;
  result?: ClassificationResult;
}

export async function classifyUpload(
  _prevState: ClassifyState,
  formData: FormData
): Promise<ClassifyState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "사진 또는 PDF 파일을 선택해주세요." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(WRONG_ANSWER_BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return { error: "파일 업로드 중 오류가 발생했습니다." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(WRONG_ANSWER_BUCKET).getPublicUrl(path);

  try {
    const allowedTags = await getUnitTags();
    const { result, rawResponse } = await classifyWrongAnswer(
      buffer,
      file.type || "image/jpeg",
      allowedTags
    );
    return { imageUrl: publicUrl, result, rawResponse };
  } catch {
    return {
      error: "AI 분류 중 오류가 발생했습니다. 단원/유형을 직접 입력해주세요.",
      imageUrl: publicUrl,
    };
  }
}

export interface SaveWrongAnswerState {
  error?: string;
  success?: boolean;
}

export async function saveWrongAnswer(
  _prevState: SaveWrongAnswerState,
  formData: FormData
): Promise<SaveWrongAnswerState> {
  const studentId = formData.get("studentId");
  const imageUrl = formData.get("imageUrl");
  const unit = formData.get("unit");
  const problemType = formData.get("problemType");
  const difficulty = formData.get("difficulty");
  const rawResponse = formData.get("rawResponse");
  const analysisPointsRaw = formData.get("analysisPoints");

  if (typeof studentId !== "string" || studentId.length === 0) {
    return { error: "학생을 선택해주세요." };
  }
  if (typeof imageUrl !== "string" || imageUrl.length === 0) {
    return { error: "먼저 사진을 업로드하고 분류해주세요." };
  }
  if (typeof unit !== "string" || unit.trim().length === 0) {
    return { error: "단원을 입력해주세요." };
  }
  if (typeof problemType !== "string" || problemType.trim().length === 0) {
    return { error: "세부 유형을 입력해주세요." };
  }
  if (typeof difficulty !== "string" || !DIFFICULTIES.includes(difficulty as Difficulty)) {
    return { error: "난이도를 선택해주세요." };
  }

  let analysisPoints: string[] | null = null;
  if (typeof analysisPointsRaw === "string" && analysisPointsRaw.length > 0) {
    try {
      const parsed = JSON.parse(analysisPointsRaw);
      if (Array.isArray(parsed)) {
        const points = parsed.filter(
          (p): p is string => typeof p === "string" && p.trim().length > 0
        );
        analysisPoints = points.length > 0 ? points : null;
      }
    } catch {
      analysisPoints = null;
    }
  }

  const { error } = await supabase.from("wrong_answers").insert({
    student_id: studentId,
    image_url: imageUrl,
    unit: unit.trim(),
    problem_type: problemType.trim(),
    difficulty,
    ai_raw_response: typeof rawResponse === "string" ? rawResponse : null,
    analysis_points: analysisPoints,
    is_verified: true,
  });

  if (error) return { error: "저장 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getWrongAnswers(studentId: string): Promise<WrongAnswer[]> {
  const { data, error } = await supabase
    .from("wrong_answers")
    .select("*")
    .eq("student_id", studentId)
    .order("recorded_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateWrongAnswerClassification(
  id: string,
  unit: string,
  problemType: string,
  difficulty: Difficulty
) {
  const trimmedUnit = unit.trim();
  const trimmedType = problemType.trim();
  if (!trimmedUnit || !trimmedType) {
    throw new Error("단원과 세부 유형을 입력해주세요.");
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new Error("난이도를 선택해주세요.");
  }

  const { error } = await supabase
    .from("wrong_answers")
    .update({ unit: trimmedUnit, problem_type: trimmedType, difficulty })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function reclassifyWrongAnswer(
  imageUrl: string
): Promise<{ result: ClassificationResult; rawResponse: string }> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("원본 사진을 불러오지 못했습니다.");
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  const allowedTags = await getUnitTags();
  return classifyWrongAnswer(buffer, mimeType, allowedTags);
}

export async function analyzeWrongAnswerDeep(
  imageUrl: string
): Promise<{ points: string[]; rawResponse: string }> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("원본 사진을 불러오지 못했습니다.");
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  return analyzeWrongAnswer(buffer, mimeType);
}

export async function getAllWrongAnswers(): Promise<WrongAnswer[]> {
  const { data, error } = await supabase
    .from("wrong_answers")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
