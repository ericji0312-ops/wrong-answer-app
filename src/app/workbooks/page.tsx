import { getSubjects } from "@/app/actions/subjects";
import { getWorkbooks } from "@/app/actions/workbooks";
import WorkbookManager from "@/components/WorkbookManager";

export default async function WorkbooksPage() {
  const [subjects, workbooks] = await Promise.all([getSubjects(), getWorkbooks()]);
  return <WorkbookManager subjects={subjects} workbooks={workbooks} />;
}
