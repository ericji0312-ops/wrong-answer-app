"use server";

import { supabase } from "@/lib/supabaseClient";
import { fetchSessions } from "@/app/actions/wrongAnswers";
import { generateWeaknessReport, type WeaknessReportEntry } from "@/lib/gemini";

export interface StudentWeaknessReportResult {
  report?: string;
  empty?: boolean;
}

export async function generateStudentWeaknessReport(
  studentId: string,
  studentName: string,
  subjectId?: string,
  sinceIso?: string
): Promise<StudentWeaknessReportResult> {
  if (!studentId) return { empty: true };

  const sessions = await fetchSessions(studentId, subjectId, sinceIso);
  if (sessions.length === 0) return { empty: true };

  const { data: wrongRows, error } = await supabase
    .from("wrong_answers")
    .select("unit, problem_type, difficulty, reason_note, recorded_at")
    .in(
      "attempt_session_id",
      sessions.map((s) => s.id)
    );
  if (error) throw new Error(error.message);
  if (!wrongRows || wrongRows.length === 0) return { empty: true };

  const entries: WeaknessReportEntry[] = wrongRows.map((r) => ({
    unit: r.unit,
    problemType: r.problem_type,
    difficulty: r.difficulty ?? "",
    reason: r.reason_note,
    recordedAt: r.recorded_at,
  }));

  const report = await generateWeaknessReport(studentName, entries);
  return { report };
}
