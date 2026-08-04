import { getStudents } from "@/app/actions/students";
import StudentManager from "@/components/StudentManager";

export default async function StudentsPage() {
  const students = await getStudents();
  return <StudentManager students={students} />;
}
