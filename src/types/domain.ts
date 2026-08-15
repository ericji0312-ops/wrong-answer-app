export interface Student {
  id: string;
  name: string;
  grade: string | null;
  level: string | null;
  created_at: string;
}

export type Difficulty = "하" | "중" | "상" | "최상";

export const DIFFICULTIES: Difficulty[] = ["하", "중", "상", "최상"];

export interface WrongAnswer {
  id: string;
  student_id: string;
  image_url: string | null;
  unit: string;
  problem_type: string;
  difficulty: Difficulty | null;
  ai_raw_response: string | null;
  analysis_points: string[] | null;
  is_verified: boolean;
  recorded_at: string;
  workbook_problem_id: string | null;
  attempt_session_id: string | null;
}

export interface UnitTag {
  id: string;
  subject_id: string;
  unit: string;
  problem_type: string;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export interface Workbook {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
}

export interface WorkbookProblem {
  id: string;
  workbook_id: string;
  problem_number: number;
  unit: string;
  problem_type: string;
  difficulty: Difficulty;
  created_at: string;
}

export interface AttemptSession {
  id: string;
  student_id: string;
  workbook_id: string;
  range_start: number;
  range_end: number;
  recorded_at: string;
}
