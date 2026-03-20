import { Editor } from "@/features/editor-v2";
import { AutoRecoverErrorBoundary } from "@/components/AutoRecoverErrorBoundary";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AutoRecoverErrorBoundary name="Editor" maxRetries={3} retryDelay={800}>
      <Editor projectId={id} />
    </AutoRecoverErrorBoundary>
  );
}
