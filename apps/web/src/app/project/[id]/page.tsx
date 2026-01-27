import { Editor } from "@/features/editor-v2";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Editor projectId={id} />;
}
