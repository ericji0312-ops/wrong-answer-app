export interface Student {
  id: string;
  name: string;
  grade: string | null;
  level: string | null;
  created_at: string;
}

export interface WrongAnswer {
  id: string;
  student_id: string;
  image_url: string;
  unit: string;
  problem_type: string;
  ai_raw_response: string | null;
  is_verified: boolean;
  recorded_at: string;
}

export interface ClassificationResult {
  unit: string;
  problem_type: string;
}

export interface UnitTag {
  id: string;
  unit: string;
  problem_type: string;
  created_at: string;
}
