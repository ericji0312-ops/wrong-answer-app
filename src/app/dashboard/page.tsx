import { getStudents } from "@/app/actions/students";
import { getUnitTags } from "@/app/actions/unitTags";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const [students, unitTags] = await Promise.all([getStudents(), getUnitTags()]);
  return <Dashboard students={students} unitTags={unitTags} />;
}
