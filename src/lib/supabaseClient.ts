import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. .env.local을 확인하세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const WRONG_ANSWER_BUCKET = "wrong-answers";
export const WORKBOOK_PDF_BUCKET = "workbook-pdfs";
