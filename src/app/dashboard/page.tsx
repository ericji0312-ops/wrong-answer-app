import { getStudents } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getStudentSubjectMap } from "@/app/actions/studentSubjects";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const [students, subjects, studentSubjectMap] = await Promise.all([
    getStudents(),
    getSubjects(),
    getStudentSubjectMap(),
  ]);
  return <Dashboard students={students} subjects={subjects} studentSubjectMap={studentSubjectMap} />;
}
