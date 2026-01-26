"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Upload, FileVideo, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload, JobErrorPayload } from "@/lib/ws";

type UploadState =
  | "idle"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setSelectedFile(file);
    setState("uploading");
    setProgress(0);
    setError(null);
    setStatusMessage("Creating project...");

    try {
      // Step 1: Create project and get presigned URL
      const { projectId, uploadUrl } = await api.createProject(file.name);
      setStatusMessage("Uploading video...");

      // Step 2: Upload file to MinIO
      await api.uploadToPresignedUrl(uploadUrl, file, (uploadProgress) => {
        setProgress(uploadProgress);
      });

      setStatusMessage("Starting transcription...");
      setState("processing");
      setProgress(0);

      // Step 3: Connect WebSocket and start processing
      wsClient.connect(projectId);

      // Set up message handler
      const removeHandler = wsClient.addHandler((message: WSMessage) => {
        if (message.type === "job:progress") {
          const payload = message.payload as JobProgressPayload;
          setProgress(payload.progress);
          if (payload.message) {
            setStatusMessage(payload.message);
          }
        } else if (message.type === "job:complete") {
          const payload = message.payload as JobCompletePayload;
          setState("complete");
          setStatusMessage("Processing complete!");
          setProgress(100);
          removeHandler();

          // Redirect to editor after short delay
          setTimeout(() => {
            router.push(`/project/${payload.projectId}`);
          }, 1500);
        } else if (message.type === "job:error") {
          const payload = message.payload as JobErrorPayload;
          setState("error");
          setError(payload.error);
          removeHandler();
        }
      });

      // Step 4: Start processing
      const { jobId } = await api.processProject(projectId);
      wsClient.subscribeToJob(jobId);

    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [router]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"],
      "video/webm": [".webm"],
    },
    maxFiles: 1,
    disabled: state !== "idle",
  });

  const resetUpload = () => {
    setState("idle");
    setProgress(0);
    setStatusMessage("");
    setError(null);
    setSelectedFile(null);
    wsClient.disconnect();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Reelify</h1>
          <p className="text-muted-foreground text-lg">
            Upload your video to add animated subtitles
          </p>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-xl p-12 text-center
            transition-all duration-200 cursor-pointer
            ${isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }
            ${state !== "idle" ? "pointer-events-none opacity-50" : ""}
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            {state === "idle" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-medium">
                    {isDragActive ? "Drop your video here" : "Drag & drop your video"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (MP4, MOV, WebM)
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <FileVideo className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-full">
                  {selectedFile?.name}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {state !== "idle" && (
          <div className="space-y-4 p-6 bg-card rounded-xl border">
            <div className="flex items-center gap-3">
              {state === "uploading" || state === "processing" ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : state === "complete" ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              <span className="font-medium">
                {state === "uploading" && "Uploading..."}
                {state === "processing" && "Processing..."}
                {state === "complete" && "Complete!"}
                {state === "error" && "Error"}
              </span>
            </div>

            <Progress value={progress} className="h-2" />

            <p className="text-sm text-muted-foreground">
              {error || statusMessage}
            </p>

            {state === "error" && (
              <Button variant="outline" onClick={resetUpload}>
                Try Again
              </Button>
            )}

            {state === "complete" && (
              <p className="text-sm text-muted-foreground">
                Redirecting to editor...
              </p>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-card border">
            <p className="text-2xl font-bold text-primary">1</p>
            <p className="text-sm text-muted-foreground">Upload video</p>
          </div>
          <div className="p-4 rounded-lg bg-card border">
            <p className="text-2xl font-bold text-primary">2</p>
            <p className="text-sm text-muted-foreground">Auto-transcribe</p>
          </div>
          <div className="p-4 rounded-lg bg-card border">
            <p className="text-2xl font-bold text-primary">3</p>
            <p className="text-sm text-muted-foreground">Edit & export</p>
          </div>
        </div>
      </div>
    </div>
  );
}
