import { getStudents } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getStudentSubjectMap } from "@/app/actions/studentSubjects";
import { getWorkbooks } from "@/app/actions/workbooks";
import RegisterForm from "@/components/RegisterForm";

export default async function RegisterPage() {
  const [students, subjects, studentSubjectMap, workbooks] = await Promise.all([
    getStudents(),
    getSubjects(),
    getStudentSubjectMap(),
    getWorkbooks(),
  ]);
  return (
    <RegisterForm
      students={students}
      subjects={subjects}
      studentSubjectMap={studentSubjectMap}
      workbooks={workbooks}
    />
  );
}
