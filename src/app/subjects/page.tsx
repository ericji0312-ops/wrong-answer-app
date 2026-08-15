import { getSubjects } from "@/app/actions/subjects";
import SubjectManager from "@/components/SubjectManager";

export default async function SubjectsPage() {
  const subjects = await getSubjects();
  return <SubjectManager subjects={subjects} />;
}
