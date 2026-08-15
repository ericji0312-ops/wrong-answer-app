import { getSubjects } from "@/app/actions/subjects";
import { getWorkbooks } from "@/app/actions/workbooks";
import WorkbookManager from "@/components/WorkbookManager";

// 문제집 PDF 전체를 Gemini로 분석하는 서버 액션은 스캔본처럼 이미지 위주인
// 경우 60초를 넘기기도 해서(실측 67초), 60초로는 여전히 중간에 끊겼다.
// 여유를 두고 더 길게 잡는다.
export const maxDuration = 180;

export default async function WorkbooksPage() {
  const [subjects, workbooks] = await Promise.all([getSubjects(), getWorkbooks()]);
  return <WorkbookManager subjects={subjects} workbooks={workbooks} />;
}
