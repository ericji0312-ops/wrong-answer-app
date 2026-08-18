"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import type { AttemptSessionMode, WorkbookProblem } from "@/types/domain";

export interface UnitTypeRate {
  unit: string;
  problem_type: string;
  wrong: number;
  total: number;
  repeatWrongCount: number;
}

export interface HeatmapCell {
  problem_type: string;
  difficulty: string;
  wrong: number;
  total: number;
  repeatWrong: number;
}

export interface WrongRateBreakdown {
  unitTypeRates: UnitTypeRate[];
  typeDifficultyRates: HeatmapCell[];
}

interface SessionRow {
  id: string;
  student_id: string;
  workbook_id: string;
  part: string;
  range_start: number | null;
  range_end: number | null;
  round: number;
  mode: AttemptSessionMode;
  recorded_at: string;
}

async function fetchSessions(
  studentId: string,
  subjectId?: string,
  sinceIso?: string
): Promise<SessionRow[]> {
  let sessionQuery = supabase.from("attempt_sessions").select("*").eq("student_id", studentId);
  if (sinceIso) sessionQuery = sessionQuery.gte("recorded_at", sinceIso);

  if (subjectId) {
    const { data: workbooksForSubject, error: workbooksError } = await supabase
      .from("workbooks")
      .select("id")
      .eq("subject_id", subjectId);
    if (workbooksError) throw new Error(workbooksError.message);
    const workbookIds = (workbooksForSubject ?? []).map((w) => w.id);
    if (workbookIds.length === 0) return [];
    sessionQuery = sessionQuery.in("workbook_id", workbookIds);
  }

  const { data: sessions, error: sessionsError } = await sessionQuery;
  if (sessionsError) throw new Error(sessionsError.message);
  return sessions ?? [];
}

// 'full' 세션은 range_start~range_end 범위에 들어가는 workbook_problems로
// 커버리지를 표현하고, 'retest' 세션은 attempt_session_problems에 저장된
// 문제 목록을 그대로 커버리지로 쓴다 (재시험은 범위가 연속되지 않으므로).
async function coveredProblemsBySessions(
  sessions: SessionRow[],
  allProblemsByWorkbook: Map<string, WorkbookProblem[]>
): Promise<Map<string, WorkbookProblem>> {
  const covered = new Map<string, WorkbookProblem>();

  for (const session of sessions) {
    if (session.mode === "retest") continue;
    const inRange = (allProblemsByWorkbook.get(session.workbook_id) ?? []).filter(
      (p) =>
        p.part === session.part &&
        session.range_start !== null &&
        session.range_end !== null &&
        p.problem_number >= session.range_start &&
        p.problem_number <= session.range_end
    );
    for (const p of inRange) covered.set(p.id, p);
  }

  const retestSessionIds = sessions.filter((s) => s.mode === "retest").map((s) => s.id);
  if (retestSessionIds.length > 0) {
    const { data: linkRows, error: linkError } = await supabase
      .from("attempt_session_problems")
      .select("workbook_problem_id")
      .in("attempt_session_id", retestSessionIds);
    if (linkError) throw new Error(linkError.message);

    const problemById = new Map(
      [...allProblemsByWorkbook.values()].flat().map((p) => [p.id, p])
    );
    for (const row of linkRows ?? []) {
      const p = problemById.get(row.workbook_problem_id);
      if (p) covered.set(p.id, p);
    }
  }

  return covered;
}

// 문제별로 "틀린 것으로 기록된 회차(round)의 distinct 집합"을 계산한다.
// 크기가 2 이상이면 그 문제는 여러 회차에 걸쳐 반복해서 틀린 것이다.
async function computeWrongRoundsByProblem(
  sessions: SessionRow[]
): Promise<Map<string, Set<number>>> {
  const result = new Map<string, Set<number>>();
  if (sessions.length === 0) return result;

  const roundBySessionId = new Map(sessions.map((s) => [s.id, s.round]));
  const { data: wrongRows, error } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id")
    .in(
      "attempt_session_id",
      sessions.map((s) => s.id)
    );
  if (error) throw new Error(error.message);

  for (const row of wrongRows ?? []) {
    if (!row.workbook_problem_id || !row.attempt_session_id) continue;
    const round = roundBySessionId.get(row.attempt_session_id);
    if (round === undefined) continue;
    const set = result.get(row.workbook_problem_id) ?? new Set<number>();
    set.add(round);
    result.set(row.workbook_problem_id, set);
  }

  return result;
}

export async function getWrongRateBreakdown(
  studentId: string,
  subjectId?: string,
  sinceIso?: string
): Promise<WrongRateBreakdown> {
  const periodSessions = await fetchSessions(studentId, subjectId, sinceIso);
  if (periodSessions.length === 0) return { unitTypeRates: [], typeDifficultyRates: [] };

  // 반복오답(여러 회차에 걸쳐 틀림) 판정은 기간 필터와 무관하게 항상 전체
  // 이력 기준으로 한다 — "최근 1개월"로 좁혀도 그 이전에 이미 반복해서
  // 틀린 문제가 반복오답 표시에서 사라지면 안 되기 때문이다.
  const allRoundSessions = sinceIso ? await fetchSessions(studentId, subjectId) : periodSessions;

  const workbookIds = [
    ...new Set([...periodSessions, ...allRoundSessions].map((s) => s.workbook_id)),
  ];
  const { data: allProblems, error: problemsError } = await supabase
    .from("workbook_problems")
    .select("*")
    .in("workbook_id", workbookIds);
  if (problemsError) throw new Error(problemsError.message);

  const allProblemsByWorkbook = new Map<string, WorkbookProblem[]>();
  for (const p of allProblems ?? []) {
    const list = allProblemsByWorkbook.get(p.workbook_id) ?? [];
    list.push(p);
    allProblemsByWorkbook.set(p.workbook_id, list);
  }

  // 같은 문제집·범위를 실수로 두 번 등록(예: 놓친 오답을 나중에 추가 등록)해도
  // 분모가 중복으로 늘어나지 않도록, 세션들이 커버하는 문제를 "세션별 합산"이
  // 아니라 problem id 기준 합집합(distinct)으로 모은다. 오답 여부도 같은
  // 방식으로 problem id 기준 distinct 집합으로 판정한다.
  const coveredProblems = await coveredProblemsBySessions(periodSessions, allProblemsByWorkbook);

  const periodSessionIds = periodSessions.map((s) => s.id);
  const { data: wrongRows, error: wrongError } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id")
    .in("attempt_session_id", periodSessionIds);
  if (wrongError) throw new Error(wrongError.message);

  const wrongProblemIds = new Set(
    (wrongRows ?? [])
      .map((row) => row.workbook_problem_id)
      .filter((id): id is string => id !== null)
  );

  const wrongRoundsByProblem = await computeWrongRoundsByProblem(allRoundSessions);
  const isRepeatWrong = (problemId: string) => (wrongRoundsByProblem.get(problemId)?.size ?? 0) >= 2;

  const unitTypeTotals = new Map<string, number>();
  const unitTypeWrong = new Map<string, number>();
  const unitTypeRepeat = new Map<string, number>();
  const cellTotals = new Map<string, number>();
  const cellWrong = new Map<string, number>();
  const cellRepeat = new Map<string, number>();
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
    if (isRepeatWrong(p.id)) {
      unitTypeRepeat.set(utKey, (unitTypeRepeat.get(utKey) ?? 0) + 1);
      cellRepeat.set(cKey, (cellRepeat.get(cKey) ?? 0) + 1);
    }
  }

  const unitTypeRates: UnitTypeRate[] = [...unitTypeTotals.entries()].map(([key, total]) => {
    const [unit, problem_type] = key.split("||");
    return {
      unit,
      problem_type,
      total,
      wrong: unitTypeWrong.get(key) ?? 0,
      repeatWrongCount: unitTypeRepeat.get(key) ?? 0,
    };
  });

  const typeDifficultyRates: HeatmapCell[] = [...cellTotals.entries()].map(([key, total]) => {
    const [problem_type, difficulty] = key.split("||");
    return {
      problem_type,
      difficulty,
      total,
      wrong: cellWrong.get(key) ?? 0,
      repeatWrong: cellRepeat.get(key) ?? 0,
    };
  });

  return { unitTypeRates, typeDifficultyRates };
}

export interface RepeatWrongProblem {
  problemId: string;
  workbookId: string;
  workbookTitle: string;
  part: string;
  problemNumber: number;
  unit: string;
  problemType: string;
  difficulty: string;
  wrongRounds: number[];
  lastWrongAt: string;
}

// 두 회차 이상에서 반복해서 틀린 문제만 뽑아서, 회차별 이력과 함께 돌려준다.
// 대시보드의 "반복오답" 섹션이 이 함수의 결과를 그대로 리스트로 보여준다.
export async function getRepeatWrongProblems(
  studentId: string,
  subjectId?: string
): Promise<RepeatWrongProblem[]> {
  if (!studentId) return [];

  const sessions = await fetchSessions(studentId, subjectId);
  if (sessions.length === 0) return [];

  const roundBySessionId = new Map(sessions.map((s) => [s.id, s.round]));
  const sessionIds = sessions.map((s) => s.id);

  const { data: wrongRows, error: wrongError } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id, recorded_at")
    .in("attempt_session_id", sessionIds);
  if (wrongError) throw new Error(wrongError.message);

  const roundsByProblem = new Map<string, Set<number>>();
  const lastWrongAtByProblem = new Map<string, string>();
  for (const row of wrongRows ?? []) {
    if (!row.workbook_problem_id || !row.attempt_session_id) continue;
    const round = roundBySessionId.get(row.attempt_session_id);
    if (round === undefined) continue;
    const set = roundsByProblem.get(row.workbook_problem_id) ?? new Set<number>();
    set.add(round);
    roundsByProblem.set(row.workbook_problem_id, set);

    const prevLast = lastWrongAtByProblem.get(row.workbook_problem_id);
    if (!prevLast || new Date(row.recorded_at) > new Date(prevLast)) {
      lastWrongAtByProblem.set(row.workbook_problem_id, row.recorded_at);
    }
  }

  const repeatProblemIds = [...roundsByProblem.entries()]
    .filter(([, rounds]) => rounds.size >= 2)
    .map(([id]) => id);
  if (repeatProblemIds.length === 0) return [];

  const { data: problems, error: problemsError } = await supabase
    .from("workbook_problems")
    .select("id, workbook_id, part, problem_number, unit, problem_type, difficulty")
    .in("id", repeatProblemIds);
  if (problemsError) throw new Error(problemsError.message);

  const workbookIds = [...new Set((problems ?? []).map((p) => p.workbook_id))];
  const { data: workbooks, error: workbooksError } = await supabase
    .from("workbooks")
    .select("id, title")
    .in("id", workbookIds);
  if (workbooksError) throw new Error(workbooksError.message);
  const workbookTitleById = new Map((workbooks ?? []).map((w) => [w.id, w.title]));

  const result: RepeatWrongProblem[] = (problems ?? []).map((p) => ({
    problemId: p.id,
    workbookId: p.workbook_id,
    workbookTitle: workbookTitleById.get(p.workbook_id) ?? "(삭제된 문제집)",
    part: p.part,
    problemNumber: p.problem_number,
    unit: p.unit,
    problemType: p.problem_type,
    difficulty: p.difficulty,
    wrongRounds: [...(roundsByProblem.get(p.id) ?? [])].sort((a, b) => a - b),
    lastWrongAt: lastWrongAtByProblem.get(p.id) ?? "",
  }));

  return result.sort((a, b) => {
    if (b.wrongRounds.length !== a.wrongRounds.length) {
      return b.wrongRounds.length - a.wrongRounds.length;
    }
    return new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime();
  });
}

export interface RoundComparisonRow {
  problemId: string;
  problemNumber: number;
  unit: string;
  problemType: string;
  difficulty: string;
  resultsByRound: Record<number, "wrong" | "correct" | "not_attempted">;
}

export interface RoundComparison {
  rounds: number[];
  rows: RoundComparisonRow[];
}

// 문제집+파트 하나를 골라, 회차별로 각 문제가 맞았는지/틀렸는지/그 회차엔
// 안 풀었는지를 나란히 비교할 수 있게 해준다 (재시험 회차는 일부 문제만
// 커버하므로 "안 풀었음" 상태가 자연스럽게 생긴다).
export async function getRoundComparison(
  studentId: string,
  workbookId: string,
  part: string
): Promise<RoundComparison> {
  if (!studentId || !workbookId) return { rounds: [], rows: [] };

  const { data: sessions, error: sessionsError } = await supabase
    .from("attempt_sessions")
    .select("*")
    .eq("student_id", studentId)
    .eq("workbook_id", workbookId)
    .eq("part", part)
    .order("round", { ascending: true });
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return { rounds: [], rows: [] };

  const { data: allProblems, error: problemsError } = await supabase
    .from("workbook_problems")
    .select("*")
    .eq("workbook_id", workbookId)
    .eq("part", part);
  if (problemsError) throw new Error(problemsError.message);

  const allProblemsByWorkbook = new Map<string, WorkbookProblem[]>([
    [workbookId, allProblems ?? []],
  ]);

  const sessionIds = sessions.map((s) => s.id);
  const { data: wrongRows, error: wrongError } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id")
    .in("attempt_session_id", sessionIds);
  if (wrongError) throw new Error(wrongError.message);

  const wrongProblemIdsBySession = new Map<string, Set<string>>();
  for (const row of wrongRows ?? []) {
    if (!row.attempt_session_id || !row.workbook_problem_id) continue;
    const set = wrongProblemIdsBySession.get(row.attempt_session_id) ?? new Set<string>();
    set.add(row.workbook_problem_id);
    wrongProblemIdsBySession.set(row.attempt_session_id, set);
  }

  const rounds = [...new Set(sessions.map((s) => s.round))].sort((a, b) => a - b);
  const coveredByRound = new Map<number, Set<string>>();
  const wrongByRound = new Map<number, Set<string>>();

  for (const session of sessions) {
    const covered = await coveredProblemsBySessions([session], allProblemsByWorkbook);
    const coveredSet = coveredByRound.get(session.round) ?? new Set<string>();
    for (const id of covered.keys()) coveredSet.add(id);
    coveredByRound.set(session.round, coveredSet);

    const wrongSet = wrongByRound.get(session.round) ?? new Set<string>();
    for (const id of wrongProblemIdsBySession.get(session.id) ?? []) wrongSet.add(id);
    wrongByRound.set(session.round, wrongSet);
  }

  const allProblemIds = new Set<string>();
  for (const set of coveredByRound.values()) {
    for (const id of set) allProblemIds.add(id);
  }

  const problemById = new Map((allProblems ?? []).map((p) => [p.id, p]));

  const rows: RoundComparisonRow[] = [...allProblemIds]
    .map((problemId) => {
      const p = problemById.get(problemId);
      if (!p) return null;
      const resultsByRound: Record<number, "wrong" | "correct" | "not_attempted"> = {};
      for (const round of rounds) {
        const covered = coveredByRound.get(round)?.has(problemId) ?? false;
        if (!covered) {
          resultsByRound[round] = "not_attempted";
        } else {
          resultsByRound[round] = wrongByRound.get(round)?.has(problemId)
            ? "wrong"
            : "correct";
        }
      }
      const row: RoundComparisonRow = {
        problemId,
        problemNumber: p.problem_number,
        unit: p.unit,
        problemType: p.problem_type,
        difficulty: p.difficulty,
        resultsByRound,
      };
      return row;
    })
    .filter((r): r is RoundComparisonRow => r !== null)
    .sort((a, b) => a.problemNumber - b.problemNumber);

  return { rounds, rows };
}

export interface WrongProblemDetail {
  workbookId: string;
  workbookTitle: string;
  part: string;
  problemNumber: number;
  recordedAt: string;
}

export async function getWrongProblemsByTypeDifficulty(
  studentId: string,
  problemType: string,
  difficulty: string,
  subjectId?: string,
  sinceIso?: string
): Promise<WrongProblemDetail[]> {
  if (!studentId) return [];

  const { data: wrongRows, error: wrongError } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id")
    .eq("student_id", studentId)
    .eq("problem_type", problemType)
    .eq("difficulty", difficulty);
  if (wrongError) throw new Error(wrongError.message);
  if (!wrongRows || wrongRows.length === 0) return [];

  const problemIds = [
    ...new Set(wrongRows.map((r) => r.workbook_problem_id).filter((id): id is string => id !== null)),
  ];
  const sessionIds = [
    ...new Set(wrongRows.map((r) => r.attempt_session_id).filter((id): id is string => id !== null)),
  ];
  if (problemIds.length === 0 || sessionIds.length === 0) return [];

  let sessionQuery = supabase.from("attempt_sessions").select("id, recorded_at").in("id", sessionIds);
  if (sinceIso) sessionQuery = sessionQuery.gte("recorded_at", sinceIso);

  const [
    { data: problems, error: problemsError },
    { data: sessions, error: sessionsError },
  ] = await Promise.all([
    supabase.from("workbook_problems").select("id, workbook_id, part, problem_number").in("id", problemIds),
    sessionQuery,
  ]);
  if (problemsError) throw new Error(problemsError.message);
  if (sessionsError) throw new Error(sessionsError.message);

  const problemById = new Map((problems ?? []).map((p) => [p.id, p]));
  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));

  const workbookIds = [...new Set((problems ?? []).map((p) => p.workbook_id))];
  const { data: workbooks, error: workbooksError } = await supabase
    .from("workbooks")
    .select("id, title, subject_id")
    .in("id", workbookIds);
  if (workbooksError) throw new Error(workbooksError.message);

  const allowedWorkbookIds = subjectId
    ? new Set((workbooks ?? []).filter((w) => w.subject_id === subjectId).map((w) => w.id))
    : null;
  const workbookTitleById = new Map((workbooks ?? []).map((w) => [w.id, w.title]));

  const details: WrongProblemDetail[] = [];
  for (const row of wrongRows) {
    if (!row.workbook_problem_id || !row.attempt_session_id) continue;
    const problem = problemById.get(row.workbook_problem_id);
    const session = sessionById.get(row.attempt_session_id);
    if (!problem || !session) continue;
    if (allowedWorkbookIds && !allowedWorkbookIds.has(problem.workbook_id)) continue;

    details.push({
      workbookId: problem.workbook_id,
      workbookTitle: workbookTitleById.get(problem.workbook_id) ?? "(삭제된 문제집)",
      part: problem.part,
      problemNumber: problem.problem_number,
      recordedAt: session.recorded_at,
    });
  }

  return details.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
}

export interface AttemptSessionHistoryItem {
  id: string;
  workbookId: string;
  part: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  round: number;
  mode: AttemptSessionMode;
  recordedAt: string;
  wrongCount: number;
  wrongProblemNumbers: number[];
}

export async function getAttemptSessionHistory(
  studentId: string
): Promise<AttemptSessionHistoryItem[]> {
  if (!studentId) return [];

  const { data: sessions, error: sessionsError } = await supabase
    .from("attempt_sessions")
    .select("*")
    .eq("student_id", studentId)
    .order("recorded_at", { ascending: false });

  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: wrongRows, error: wrongError } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id")
    .in("attempt_session_id", sessionIds);

  if (wrongError) throw new Error(wrongError.message);

  const problemIds = [
    ...new Set(
      (wrongRows ?? [])
        .map((row) => row.workbook_problem_id)
        .filter((id): id is string => id !== null)
    ),
  ];

  const { data: problems, error: problemsError } =
    problemIds.length > 0
      ? await supabase.from("workbook_problems").select("id, problem_number").in("id", problemIds)
      : { data: [], error: null };
  if (problemsError) throw new Error(problemsError.message);

  const problemNumberById = new Map((problems ?? []).map((p) => [p.id, p.problem_number]));

  const wrongCounts = new Map<string, number>();
  const wrongNumbersBySession = new Map<string, number[]>();
  for (const row of wrongRows ?? []) {
    if (!row.attempt_session_id) continue;
    wrongCounts.set(row.attempt_session_id, (wrongCounts.get(row.attempt_session_id) ?? 0) + 1);
    const problemNumber = row.workbook_problem_id
      ? problemNumberById.get(row.workbook_problem_id)
      : undefined;
    if (problemNumber !== undefined) {
      const list = wrongNumbersBySession.get(row.attempt_session_id) ?? [];
      list.push(problemNumber);
      wrongNumbersBySession.set(row.attempt_session_id, list);
    }
  }

  return sessions.map((s) => ({
    id: s.id,
    workbookId: s.workbook_id,
    part: s.part,
    rangeStart: s.range_start,
    rangeEnd: s.range_end,
    round: s.round,
    mode: s.mode,
    recordedAt: s.recorded_at,
    wrongCount: wrongCounts.get(s.id) ?? 0,
    wrongProblemNumbers: (wrongNumbersBySession.get(s.id) ?? []).sort((a, b) => a - b),
  }));
}

// 등록을 잘못 했을 때(범위를 잘못 잡았거나 틀린 문제를 잘못 체크한 경우) 되돌릴
// 수 있도록 등록 이력 자체를 지운다. wrong_answers.attempt_session_id는 on
// delete set null이라 세션만 지우면 이 세션 때문에 생긴 오답 행이 세션 없이
// 고아로 남는다 — 사진 없는 문제집 기반 오답은 세션이 없으면 아무 의미가
// 없으므로 세션을 지울 때 관련 오답 행도 함께 지운다. attempt_session_problems는
// on delete cascade라 세션을 지우면 자동으로 함께 삭제된다.
export async function deleteAttemptSession(sessionId: string) {
  const { error: wrongError } = await supabase
    .from("wrong_answers")
    .delete()
    .eq("attempt_session_id", sessionId);
  if (wrongError) throw new Error(wrongError.message);

  const { error: sessionError } = await supabase
    .from("attempt_sessions")
    .delete()
    .eq("id", sessionId);
  if (sessionError) throw new Error(sessionError.message);

  revalidatePath("/dashboard");
  revalidatePath("/register");
}

// 학생이 이 문제집(+파트)을 몇 회독째 등록하는지 자동으로 제안한다. 기존
// 최대 회차 + 1이며, 처음 등록하는 경우 1이 된다.
export async function getNextRoundNumber(
  studentId: string,
  workbookId: string,
  part: string
): Promise<number> {
  if (!studentId || !workbookId) return 1;

  const { data, error } = await supabase
    .from("attempt_sessions")
    .select("round")
    .eq("student_id", studentId)
    .eq("workbook_id", workbookId)
    .eq("part", part)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return (data?.round ?? 0) + 1;
}

export interface PreviouslyWrongProblem {
  problemId: string;
  problemNumber: number;
  unit: string;
  problemType: string;
  difficulty: string;
  timesWrong: number;
  lastWrongRound: number;
}

// "오답만 재시험" 등록 모드에서, 이 학생이 이 문제집(+파트)에서 지금까지
// 틀렸던 문제 목록을 체크리스트로 보여주기 위해 쓴다.
export async function getPreviouslyWrongProblems(
  studentId: string,
  workbookId: string,
  part: string
): Promise<PreviouslyWrongProblem[]> {
  if (!studentId || !workbookId) return [];

  const { data: sessions, error: sessionsError } = await supabase
    .from("attempt_sessions")
    .select("id, round")
    .eq("student_id", studentId)
    .eq("workbook_id", workbookId)
    .eq("part", part);
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return [];

  const roundBySessionId = new Map(sessions.map((s) => [s.id, s.round]));
  const sessionIds = sessions.map((s) => s.id);

  const { data: wrongRows, error: wrongError } = await supabase
    .from("wrong_answers")
    .select("attempt_session_id, workbook_problem_id")
    .in("attempt_session_id", sessionIds);
  if (wrongError) throw new Error(wrongError.message);

  const statsByProblem = new Map<string, { timesWrong: number; lastWrongRound: number }>();
  for (const row of wrongRows ?? []) {
    if (!row.workbook_problem_id || !row.attempt_session_id) continue;
    const round = roundBySessionId.get(row.attempt_session_id) ?? 0;
    const stat = statsByProblem.get(row.workbook_problem_id) ?? { timesWrong: 0, lastWrongRound: 0 };
    stat.timesWrong += 1;
    stat.lastWrongRound = Math.max(stat.lastWrongRound, round);
    statsByProblem.set(row.workbook_problem_id, stat);
  }
  if (statsByProblem.size === 0) return [];

  const { data: problems, error: problemsError } = await supabase
    .from("workbook_problems")
    .select("id, problem_number, unit, problem_type, difficulty")
    .in("id", [...statsByProblem.keys()]);
  if (problemsError) throw new Error(problemsError.message);

  return (problems ?? [])
    .map((p) => {
      const stat = statsByProblem.get(p.id)!;
      return {
        problemId: p.id,
        problemNumber: p.problem_number,
        unit: p.unit,
        problemType: p.problem_type,
        difficulty: p.difficulty,
        timesWrong: stat.timesWrong,
        lastWrongRound: stat.lastWrongRound,
      };
    })
    .sort((a, b) => a.problemNumber - b.problemNumber);
}

export interface SaveWorkbookWrongAnswersInput {
  studentId: string;
  workbookId: string;
  part: string;
  rangeStart: number;
  rangeEnd: number;
  wrongProblemNumbers: number[];
  round: number;
}

export async function saveWorkbookWrongAnswers({
  studentId,
  workbookId,
  part,
  rangeStart,
  rangeEnd,
  wrongProblemNumbers,
  round,
}: SaveWorkbookWrongAnswersInput) {
  if (!studentId) throw new Error("학생을 선택해주세요.");
  if (!workbookId) throw new Error("문제집을 선택해주세요.");
  if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd) || rangeStart > rangeEnd) {
    throw new Error("풀이 범위를 올바르게 입력해주세요.");
  }
  if (!Number.isInteger(round) || round < 1) {
    throw new Error("회차를 올바르게 입력해주세요.");
  }

  const { data: session, error: sessionError } = await supabase
    .from("attempt_sessions")
    .insert({
      student_id: studentId,
      workbook_id: workbookId,
      part,
      range_start: rangeStart,
      range_end: rangeEnd,
      round,
      mode: "full",
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
    .eq("part", part)
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

export interface SaveRetestWrongAnswersInput {
  studentId: string;
  workbookId: string;
  part: string;
  round: number;
  attemptedProblemIds: string[];
  stillWrongProblemIds: string[];
}

// "오답만 재시험" 모드: 과거 오답 목록 중 이번에 실제로 다시 풀어본 문제들
// (attemptedProblemIds)을 attempt_session_problems에 커버리지로 기록하고,
// 그중 이번에도 틀린 문제(stillWrongProblemIds)만 wrong_answers에 새로 남긴다.
export async function saveRetestWrongAnswers({
  studentId,
  workbookId,
  part,
  round,
  attemptedProblemIds,
  stillWrongProblemIds,
}: SaveRetestWrongAnswersInput) {
  if (!studentId) throw new Error("학생을 선택해주세요.");
  if (!workbookId) throw new Error("문제집을 선택해주세요.");
  if (attemptedProblemIds.length === 0) throw new Error("재시험할 문제를 선택해주세요.");
  if (!Number.isInteger(round) || round < 1) throw new Error("회차를 올바르게 입력해주세요.");

  const { data: session, error: sessionError } = await supabase
    .from("attempt_sessions")
    .insert({
      student_id: studentId,
      workbook_id: workbookId,
      part,
      range_start: null,
      range_end: null,
      round,
      mode: "retest",
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const linkRows = attemptedProblemIds.map((problemId) => ({
    attempt_session_id: session.id,
    workbook_problem_id: problemId,
  }));
  const { error: linkError } = await supabase.from("attempt_session_problems").insert(linkRows);
  if (linkError) throw new Error(linkError.message);

  if (stillWrongProblemIds.length > 0) {
    const { data: wrongProblems, error: problemsError } = await supabase
      .from("workbook_problems")
      .select("*")
      .in("id", stillWrongProblemIds);
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
  }

  revalidatePath("/dashboard");
  revalidatePath("/register");
}
