import { Editor } from "@/features/editor-v2";

export default async function Page({
  params
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id } = await params;
  const [projectId] = id;

  return <Editor projectId={projectId} />;
}
