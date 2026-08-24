import { getStudents } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getStudentSubjectMap } from "@/app/actions/studentSubjects";
import Dashboard from "@/components/Dashboard";

// 실측 결과 오답 44건 기준 gemini-3.7-flash 리포트 생성이 약 58초 걸렸다
// (추론 모델이라 문제 분류용 모델보다 느림). 여유를 두고 넉넉히 잡는다.
export const maxDuration = 120;

export default async function DashboardPage() {
  const [students, subjects, studentSubjectMap] = await Promise.all([
    getStudents(),
    getSubjects(),
    getStudentSubjectMap(),
  ]);
  return <Dashboard students={students} subjects={subjects} studentSubjectMap={studentSubjectMap} />;
}
