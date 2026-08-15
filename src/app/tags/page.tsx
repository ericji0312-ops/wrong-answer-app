import { getUnitTags } from "@/app/actions/unitTags";
import { getSubjects } from "@/app/actions/subjects";
import TagManager from "@/components/TagManager";

export default async function TagsPage() {
  const [tags, subjects] = await Promise.all([getUnitTags(), getSubjects()]);
  return <TagManager tags={tags} subjects={subjects} />;
}
