import { getUnitTags } from "@/app/actions/unitTags";
import TagManager from "@/components/TagManager";

export default async function TagsPage() {
  const tags = await getUnitTags();
  return <TagManager tags={tags} />;
}
