"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReelifyNavbarProps {
  projectName: string;
  onSave: () => void;
  onExport: () => void;
  isSaving?: boolean;
}

const ReelifyNavbar = ({
  projectName,
  onSave,
  onExport,
  isSaving = false,
}: ReelifyNavbarProps) => {
  const router = useRouter();

  return (
    <div className="flex h-14 items-center justify-between border-b border-border/80 bg-background px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/upload")}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-primary">
            Reelify
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {projectName}
          </span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>

        <Button
          size="sm"
          onClick={onExport}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
};

export default ReelifyNavbar;
