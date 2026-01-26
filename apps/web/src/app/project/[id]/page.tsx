"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useReelifyStore } from "@/store/use-reelify-store";
import ReelifyEditor from "@/features/reelify-editor";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { project, isLoading, error, loadProject, designComboData } = useReelifyStore();

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <a href="/upload" className="text-primary underline">
            Upload a new video
          </a>
        </div>
      </div>
    );
  }

  if (!project || !designComboData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Preparing editor...</span>
        </div>
      </div>
    );
  }

  return <ReelifyEditor projectId={projectId} initialData={designComboData} />;
}
