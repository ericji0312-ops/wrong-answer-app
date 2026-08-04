import { getStudents } from "@/app/actions/students";
import { getUnitTags } from "@/app/actions/unitTags";
import RegisterForm from "@/components/RegisterForm";

export default async function RegisterPage() {
  const [students, unitTags] = await Promise.all([getStudents(), getUnitTags()]);
  return <RegisterForm students={students} unitTags={unitTags} />;
}
