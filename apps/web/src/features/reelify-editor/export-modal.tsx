"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, CheckCircle, AlertCircle, Video } from "lucide-react";
import { api } from "@/lib/api";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: () => void;
  isRendering: boolean;
  progress: number;
  projectId: string;
}

const ExportModal = ({
  open,
  onOpenChange,
  onExport,
  isRendering,
  progress,
  projectId,
}: ExportModalProps) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for download URL when progress reaches 100
  useEffect(() => {
    if (progress >= 100 && !downloadUrl && !error) {
      checkDownloadUrl();
    }
  }, [progress]);

  const checkDownloadUrl = async () => {
    try {
      const response = await api.getDownloadUrl(projectId);
      setDownloadUrl(response.url);
      setIsComplete(true);
    } catch (err) {
      // Video might not be ready yet, retry
      setTimeout(checkDownloadUrl, 2000);
    }
  };

  const handleExport = () => {
    setDownloadUrl(null);
    setIsComplete(false);
    setError(null);
    onExport();
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
  };

  const handleClose = () => {
    if (!isRendering) {
      onOpenChange(false);
      // Reset state when closing
      setTimeout(() => {
        setDownloadUrl(null);
        setIsComplete(false);
        setError(null);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Render your video with animated subtitles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Initial state - not started */}
          {!isRendering && !isComplete && !error && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your video will be rendered with all subtitles and effects applied.
                </p>
                <p className="text-sm text-muted-foreground">
                  Output: MP4 (1080p)
                </p>
              </div>
              <Button onClick={handleExport} className="w-full">
                Start Export
              </Button>
            </div>
          )}

          {/* Rendering state */}
          {isRendering && !isComplete && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="font-medium">Rendering video...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {progress}% complete
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Please keep this window open until rendering is complete.
              </p>
            </div>
          )}

          {/* Complete state */}
          {isComplete && downloadUrl && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">Export Complete!</p>
                <p className="text-sm text-muted-foreground">
                  Your video is ready to download.
                </p>
              </div>
              <Button onClick={handleDownload} className="w-full gap-2">
                <Download className="w-4 h-4" />
                Download Video
              </Button>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">Export Failed</p>
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button onClick={handleExport} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportModal;
