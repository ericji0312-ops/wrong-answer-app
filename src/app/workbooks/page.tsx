import { getSubjects } from "@/app/actions/subjects";
import { getWorkbooks } from "@/app/actions/workbooks";
import WorkbookManager from "@/components/WorkbookManager";

// 문제집 PDF 전체를 Gemini로 분석하는 서버 액션이 (문제 수가 많으면) 로컬에서도
// 50초 넘게 걸려서, Vercel 기본 서버리스 타임아웃(Hobby 10초)에 걸려 중간에
// 끊기고 "PDF 분석 중 오류가 발생했습니다"로 보였다. 이 라우트에서 실행되는
// 서버 액션의 제한 시간을 늘려준다 (Hobby 플랜 최대치인 60초).
export const maxDuration = 60;

export default async function WorkbooksPage() {
  const [subjects, workbooks] = await Promise.all([getSubjects(), getWorkbooks()]);
  return <WorkbookManager subjects={subjects} workbooks={workbooks} />;
}
