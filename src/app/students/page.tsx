import { getStudents } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getStudentSubjectMap } from "@/app/actions/studentSubjects";
import StudentManager from "@/components/StudentManager";

export default async function StudentsPage() {
  const [students, subjects, studentSubjectMap] = await Promise.all([
    getStudents(),
    getSubjects(),
    getStudentSubjectMap(),
  ]);
  return (
    <StudentManager
      students={students}
      subjects={subjects}
      studentSubjectMap={studentSubjectMap}
    />
  );
}
