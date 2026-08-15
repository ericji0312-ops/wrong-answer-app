import { getStudents } from "@/app/actions/students";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const students = await getStudents();
  return <Dashboard students={students} />;
}
