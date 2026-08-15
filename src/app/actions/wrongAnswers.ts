"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

export interface UnitTypeRate {
  unit: string;
  problem_type: string;
  wrong: number;
  total: number;
}

export interface HeatmapCell {
  problem_type: string;
  difficulty: string;
  wrong: number;
  total: number;
}

export interface WrongRateBreakdown {
  unitTypeRates: UnitTypeRate[];
  typeDifficultyRates: HeatmapCell[];
}

export async function getWrongRateBreakdown(
  studentId: string,
  sinceIso?: string
): Promise<WrongRateBreakdown> {
  let sessionQuery = supabase
    .from("attempt_sessions")
    .select("*")
    .eq("student_id", studentId);
  if (sinceIso) sessionQuery = sessionQuery.gte("recorded_at", sinceIso);

  const { data: sessions, error: sessionsError } = await sessionQuery;
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0)
    return { unitTypeRates: [], typeDifficultyRates: [] };

  const sessionIds = sessions.map((s) => s.id);
  const workbookIds = [...new Set(sessions.map((s) => s.workbook_id))];

  const [{ data: allProblems, error: problemsError }, { data: wrongRows, error: wrongError }] =
    await Promise.all([
      supabase.from("workbook_problems").select("*").in("workbook_id", workbookIds),
      supabase
        .from("wrong_answers")
        .select("attempt_session_id, workbook_problem_id")
        .in("attempt_session_id", sessionIds),
    ]);

  if (problemsError) throw new Error(problemsError.message);
  if (wrongError) throw new Error(wrongError.message);

  // 같은 문제집·범위를 실수로 두 번 등록(예: 놓친 오답을 나중에 추가 등록)해도
  // 분모가 중복으로 늘어나지 않도록, 세션들이 커버하는 문제를 "세션별 합산"이
  // 아니라 problem id 기준 합집합(distinct)으로 모은다. 오답 여부도 같은
  // 방식으로 problem id 기준 distinct 집합으로 판정한다.
  const coveredProblems = new Map<string, (typeof allProblems)[number]>();
  for (const session of sessions) {
    const inRange = (allProblems ?? []).filter(
      (p) =>
        p.workbook_id === session.workbook_id &&
        p.problem_number >= session.range_start &&
        p.problem_number <= session.range_end
    );
    for (const p of inRange) {
      coveredProblems.set(p.id, p);
    }
  }

  const wrongProblemIds = new Set(
    (wrongRows ?? [])
      .map((row) => row.workbook_problem_id)
      .filter((id): id is string => id !== null)
  );

  const unitTypeTotals = new Map<string, number>();
  const unitTypeWrong = new Map<string, number>();
  const cellTotals = new Map<string, number>();
  const cellWrong = new Map<string, number>();
  const unitTypeKey = (unit: string, type: string) => `${unit}||${type}`;
  const cellKey = (type: string, difficulty: string) => `${type}||${difficulty}`;

  for (const p of coveredProblems.values()) {
    const utKey = unitTypeKey(p.unit, p.problem_type);
    unitTypeTotals.set(utKey, (unitTypeTotals.get(utKey) ?? 0) + 1);
    const cKey = cellKey(p.problem_type, p.difficulty);
    cellTotals.set(cKey, (cellTotals.get(cKey) ?? 0) + 1);

    if (wrongProblemIds.has(p.id)) {
      unitTypeWrong.set(utKey, (unitTypeWrong.get(utKey) ?? 0) + 1);
      cellWrong.set(cKey, (cellWrong.get(cKey) ?? 0) + 1);
    }
  }

  const unitTypeRates: UnitTypeRate[] = [...unitTypeTotals.entries()].map(([key, total]) => {
    const [unit, problem_type] = key.split("||");
    return { unit, problem_type, total, wrong: unitTypeWrong.get(key) ?? 0 };
  });

  const typeDifficultyRates: HeatmapCell[] = [...cellTotals.entries()].map(([key, total]) => {
    const [problem_type, difficulty] = key.split("||");
    return { problem_type, difficulty, total, wrong: cellWrong.get(key) ?? 0 };
  });

  return { unitTypeRates, typeDifficultyRates };
}

export interface SaveWorkbookWrongAnswersInput {
  studentId: string;
  workbookId: string;
  rangeStart: number;
  rangeEnd: number;
  wrongProblemNumbers: number[];
}

export async function saveWorkbookWrongAnswers({
  studentId,
  workbookId,
  rangeStart,
  rangeEnd,
  wrongProblemNumbers,
}: SaveWorkbookWrongAnswersInput) {
  if (!studentId) throw new Error("학생을 선택해주세요.");
  if (!workbookId) throw new Error("문제집을 선택해주세요.");
  if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd) || rangeStart > rangeEnd) {
    throw new Error("풀이 범위를 올바르게 입력해주세요.");
  }

  const { data: session, error: sessionError } = await supabase
    .from("attempt_sessions")
    .insert({
      student_id: studentId,
      workbook_id: workbookId,
      range_start: rangeStart,
      range_end: rangeEnd,
    })
    .select()
    .single();

  if (sessionError) throw new Error(sessionError.message);
  if (wrongProblemNumbers.length === 0) {
    revalidatePath("/dashboard");
    return;
  }

  const { data: wrongProblems, error: problemsError } = await supabase
    .from("workbook_problems")
    .select("*")
    .eq("workbook_id", workbookId)
    .in("problem_number", wrongProblemNumbers);

  if (problemsError) throw new Error(problemsError.message);

  const rows = (wrongProblems ?? []).map((p) => ({
    student_id: studentId,
    workbook_problem_id: p.id,
    attempt_session_id: session.id,
    unit: p.unit,
    problem_type: p.problem_type,
    difficulty: p.difficulty,
    is_verified: true,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("wrong_answers").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/dashboard");
}
