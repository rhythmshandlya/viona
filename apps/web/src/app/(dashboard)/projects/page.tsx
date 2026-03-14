"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { api, UserProject } from "@/lib/api";
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload, JobErrorPayload } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Plus,
  Video,
  Clock,
  Calendar,
  MoreVertical,
  Trash2,
  Upload,
  FileVideo,
  FileAudio,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Play,
  Music,
} from "lucide-react";

// ============================================
// Types
// ============================================

type UploadState = "idle" | "uploading" | "processing" | "complete" | "error";

// ============================================
// Utility Functions
// ============================================

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case "ready":
    case "completed":
      return { label: "Ready", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
    case "processing":
    case "rendering":
    case "generating":
      return { label: "Processing", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse" };
    case "uploading":
      return { label: "Uploading", className: "bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse" };
    case "failed":
      return { label: "Failed", className: "bg-red-500/10 text-red-600 border-red-500/20" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

// ============================================
// Delete Confirmation Dialog
// ============================================

function DeleteDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md shadow-card-hover">
        <DialogHeader>
          <DialogTitle className="text-xl">Delete project?</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">"{projectName}"</span> will be permanently deleted. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Thumbnails
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ThumbnailImage({ projectId, alt, hasVideoKey }: { projectId: string; alt: string; hasVideoKey: boolean }) {
  const [error, setError] = useState(false);

  if (error && hasVideoKey) {
    return <VideoThumbnail projectId={projectId} alt={alt} />;
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Video className="w-8 h-8 text-primary/60" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={api.getThumbnailUrl(projectId)}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
}

function VideoThumbnail({ projectId, alt }: { projectId: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Video className="w-8 h-8 text-primary/60" />
        </div>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      <video
        src={`${API_URL}/api/projects/${projectId}/video`}
        muted
        playsInline
        preload="metadata"
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoadedData={(e) => {
          (e.target as HTMLVideoElement).currentTime = 1;
        }}
        onSeeked={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
}

// ============================================
// Project Card
// ============================================

function ProjectCard({
  project,
  onDelete,
  onOpen,
  isBooting,
  className,
}: {
  project: UserProject;
  onDelete: (project: UserProject) => void;
  onOpen: (projectId: string) => void;
  isBooting: boolean;
  className?: string;
}) {
  const status = getStatusConfig(project.status);
  const projectName = project.title || project.videoKey?.split("/").pop() || `Project ${project.id.slice(0, 8)}`;

  return (
    <div
      onClick={() => !isBooting && onOpen(project.id)}
      className={`group block bg-white rounded-2xl shadow-card cursor-pointer overflow-hidden ${isBooting ? "opacity-70" : ""} ${className || ""}`}
    >
      {/* Thumbnail Area */}
      <div className="aspect-video bg-gradient-to-br from-violet-50 to-purple-50 relative overflow-hidden">
        {project.thumbnailKey ? (
          <ThumbnailImage projectId={project.id} alt={projectName} hasVideoKey={!!project.videoKey} />
        ) : project.projectType === 'audio' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Music className="w-8 h-8 text-violet-500/60" />
            </div>
          </div>
        ) : project.videoKey ? (
          <VideoThumbnail projectId={project.id} alt={projectName} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Video className="w-8 h-8 text-primary/60" />
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium border ${status.className}`}>
          {status.label}
        </div>

        {/* Booting Overlay */}
        {isBooting && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Play Button Overlay (on hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center">
            <Play className="w-6 h-6 text-primary ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Three Dot Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white shadow-sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="shadow-card-hover" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(project);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground truncate mb-1">{projectName}</h3>
        <p className="text-sm text-muted-foreground">
          {formatDate(project.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Upload Zone Component
// ============================================

function UploadZone({
  projectName,
  onProjectNameChange,
  description,
  onDescriptionChange,
  onFileDrop,
  uploadState,
  progress,
  statusMessage,
  error,
  onReset,
  inline = false,
}: {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  onFileDrop: (file: File) => void;
  uploadState: UploadState;
  progress: number;
  statusMessage: string;
  error: string | null;
  onReset: () => void;
  inline?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onFileDrop(file);
      }
    },
    [onFileDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"],
      "video/webm": [".webm"],
      "audio/mpeg": [".mp3"],
      "audio/mp4": [".m4a"],
      "audio/wav": [".wav"],
      "audio/ogg": [".ogg"],
      "audio/flac": [".flac"],
    },
    maxFiles: 1,
    disabled: uploadState !== "idle",
  });

  // Auto-focus the name input
  useEffect(() => {
    if (uploadState === "idle" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [uploadState]);

  return (
    <div className={`space-y-6 ${inline ? "" : ""}`}>
      {/* Project Name Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Project name</label>
        <Input
          ref={inputRef}
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="Untitled Project"
          className="text-lg h-12 bg-background border-border/50 focus:border-primary"
          disabled={uploadState === "complete"}
        />
      </div>

      {/* Creative Brief */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Creative brief <span className="text-muted-foreground/50">(optional)</span></label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe your vision — what style, mood, and scenes you want. Or leave blank and chat with AI after upload."
          className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-border/50 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          disabled={uploadState === "complete"}
        />
      </div>

      {/* Drop Zone */}
      {uploadState === "idle" ? (
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center
            transition-all duration-300 cursor-pointer group bg-white shadow-card
            ${isDragActive
              ? "border-primary bg-primary/5 scale-[1.02] shadow-card-hover"
              : "border-border hover:border-primary/50 hover:shadow-card-hover"
            }
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            <div className={`
              w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isDragActive ? "bg-primary/20 scale-110" : "bg-primary/10 group-hover:bg-primary/15"}
            `}>
              <Upload className={`w-10 h-10 transition-colors ${isDragActive ? "text-primary" : "text-primary/60 group-hover:text-primary"}`} />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {isDragActive ? "Drop your file here" : "Drag & drop your video or audio"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse • MP4, MOV, WebM, MP3, M4A, WAV
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card p-8 space-y-6">
          {/* File Preview */}
          <div className="flex items-center gap-4">
            <div className={`
              w-14 h-14 rounded-xl flex items-center justify-center
              ${uploadState === "error" ? "bg-red-500/10" : uploadState === "complete" ? "bg-emerald-500/10" : "bg-primary/10"}
            `}>
              {uploadState === "uploading" || uploadState === "processing" ? (
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              ) : uploadState === "complete" ? (
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              ) : uploadState === "error" ? (
                <AlertCircle className="w-7 h-7 text-red-500" />
              ) : (
                <FileVideo className="w-7 h-7 text-primary/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {uploadState === "uploading" && "Uploading video..."}
                {uploadState === "processing" && "Processing..."}
                {uploadState === "complete" && "Ready!"}
                {uploadState === "error" && "Upload failed"}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {error || statusMessage}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {(uploadState === "uploading" || uploadState === "processing") && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          )}

          {/* Error Actions */}
          {uploadState === "error" && (
            <Button variant="outline" onClick={onReset} className="w-full">
              Try Again
            </Button>
          )}

          {/* Complete Message */}
          {uploadState === "complete" && (
            <p className="text-sm text-muted-foreground text-center">
              Opening editor...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Job monitoring: WebSocket + HTTP polling fallback
// ============================================

/**
 * Starts monitoring jobs via WebSocket events with HTTP polling fallback.
 * Returns a cleanup function that stops polling and removes the WS handler.
 */
function startJobMonitor(opts: {
  projectId: string;
  jobIds: string[];
  totalJobs: number;
  jobProgressRef: React.MutableRefObject<Record<string, number>>;
  setProgress: (p: number) => void;
  setStatusMessage: (m: string) => void;
  onAllComplete: () => void;
  onError: (error: string) => void;
}): () => void {
  const { projectId, jobIds, totalJobs, jobProgressRef, setProgress, setStatusMessage, onAllComplete, onError } = opts;
  const completedJobs = new Set<string>();
  let cleaned = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    if (pollTimer) clearInterval(pollTimer);
    removeHandler();
  }

  function checkAllComplete() {
    if (completedJobs.size >= totalJobs) {
      cleanup();
      onAllComplete();
      return true;
    }
    return false;
  }

  // --- WebSocket handler (primary) ---
  const removeHandler = wsClient.addHandler((message: WSMessage) => {
    if (cleaned) return;

    if (message.type === "job:progress") {
      const payload = message.payload as JobProgressPayload;
      jobProgressRef.current[payload.jobId] = payload.progress;
      const values = Object.values(jobProgressRef.current);
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / totalJobs);
      setProgress(avg);
      if (payload.message) {
        setStatusMessage(payload.message);
      }
    } else if (message.type === "job:complete") {
      const payload = message.payload as JobCompletePayload;
      completedJobs.add(payload.jobId);
      jobProgressRef.current[payload.jobId] = 100;

      if (!checkAllComplete()) {
        setStatusMessage("Finishing up...");
      }
    } else if (message.type === "job:error") {
      const payload = message.payload as JobErrorPayload;
      cleanup();
      onError(payload.error);
    }
  });

  // Subscribe to job events
  for (const jid of jobIds) {
    wsClient.subscribeToJob(jid);
  }

  // --- HTTP polling fallback ---
  // Catches cases where WS events are missed (subscription race, reconnect, etc.)
  async function pollJobs() {
    if (cleaned) return;
    try {
      for (const jid of jobIds) {
        if (completedJobs.has(jid)) continue;
        const job = await api.getJob(jid);

        if (job.status === "complete") {
          completedJobs.add(jid);
          jobProgressRef.current[jid] = 100;
          if (checkAllComplete()) return;
          setStatusMessage("Finishing up...");
        } else if (job.status === "failed") {
          cleanup();
          onError(job.error || "Job failed");
          return;
        } else {
          // Update progress from HTTP if higher than what we have
          const current = jobProgressRef.current[jid] || 0;
          if (job.progress > current) {
            jobProgressRef.current[jid] = job.progress;
            const values = Object.values(jobProgressRef.current);
            const avg = Math.round(values.reduce((a, b) => a + b, 0) / totalJobs);
            setProgress(avg);
            if (job.progressMessage) {
              setStatusMessage(job.progressMessage);
            }
          }
        }
      }

      // Fallback: if all tracked jobs are done but checkAllComplete hasn't
      // fired (e.g., totalJobs mismatch), check project status directly
      if (!cleaned && completedJobs.size > 0 && completedJobs.size < totalJobs) {
        try {
          const project = await api.getProject(projectId);
          if (project.status === "ready") {
            cleanup();
            onAllComplete();
          }
        } catch {
          // Project status check is best-effort
        }
      }
    } catch (err) {
      // Log polling errors — silent swallowing can hide auth/network issues
      console.warn("Job poll error (will retry):", err);
    }
  }

  // Run first poll immediately, then every 3 seconds
  pollJobs();
  pollTimer = setInterval(pollJobs, 3000);

  return cleanup;
}

// ============================================
// New Project Modal
// ============================================

function NewProjectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resetState = () => {
    setProjectName("");
    setDescription("");
    setUploadState("idle");
    setProgress(0);
    setStatusMessage("");
    setError(null);
  };

  const handleFileDrop = useCallback(
    async (file: File) => {
      setUploadState("uploading");
      setProgress(0);
      setError(null);
      setStatusMessage("Creating project...");

      try {
        const title = projectName.trim() || file.name.replace(/\.[^/.]+$/, "");
        const { projectId } = await api.createProject(file.name, title, description);
        if (description.trim()) {
          sessionStorage.setItem(`project-brief-${projectId}`, description.trim());
        }
        setStatusMessage("Uploading video...");

        await api.uploadViaProxy(projectId, file, (uploadProgress) => {
          setProgress(uploadProgress);
        });

        setStatusMessage("Setting up workspace...");
        setUploadState("processing");
        setProgress(0);

        // Create sandbox and wait for it to be ready
        const result = await api.createSandbox(projectId);

        if (result.status !== 'ready') {
          // Poll for readiness
          for (let i = 0; i < 90; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const status = await api.getSandboxStatus(projectId);
            if (status.status === 'ready') break;
            setProgress(Math.min(90, Math.round((i / 90) * 100)));
          }
        }

        setUploadState("complete");
        setStatusMessage("Ready!");
        setProgress(100);

        setTimeout(() => {
          onOpenChange(false);
          resetState();
          router.push(`/project/${projectId}`);
        }, 500);
      } catch (err) {
        setUploadState("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [projectName, description, router, onOpenChange]
  );

  const handleClose = (open: boolean) => {
    if (!open && uploadState !== "uploading" && uploadState !== "processing") {
      resetState();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl shadow-card-hover" showCloseButton={uploadState === "idle" || uploadState === "error"}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">New Project</DialogTitle>
        </DialogHeader>
        <UploadZone
          projectName={projectName}
          onProjectNameChange={setProjectName}
          description={description}
          onDescriptionChange={setDescription}
          onFileDrop={handleFileDrop}
          uploadState={uploadState}
          progress={progress}
          statusMessage={statusMessage}
          error={error}
          onReset={resetState}
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Empty State
// ============================================

function EmptyState() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resetState = () => {
    setProjectName("");
    setDescription("");
    setUploadState("idle");
    setProgress(0);
    setStatusMessage("");
    setError(null);
  };

  const handleFileDrop = useCallback(
    async (file: File) => {
      setUploadState("uploading");
      setProgress(0);
      setError(null);
      setStatusMessage("Creating project...");

      try {
        const title = projectName.trim() || file.name.replace(/\.[^/.]+$/, "");
        const { projectId } = await api.createProject(file.name, title, description);
        if (description.trim()) {
          sessionStorage.setItem(`project-brief-${projectId}`, description.trim());
        }
        setStatusMessage("Uploading video...");

        await api.uploadViaProxy(projectId, file, (uploadProgress) => {
          setProgress(uploadProgress);
        });

        setStatusMessage("Setting up workspace...");
        setUploadState("processing");
        setProgress(0);

        // Create sandbox and wait for it to be ready
        const result = await api.createSandbox(projectId);

        if (result.status !== 'ready') {
          // Poll for readiness
          for (let i = 0; i < 90; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const status = await api.getSandboxStatus(projectId);
            if (status.status === 'ready') break;
            setProgress(Math.min(90, Math.round((i / 90) * 100)));
          }
        }

        setUploadState("complete");
        setStatusMessage("Ready!");
        setProgress(100);

        setTimeout(() => {
          resetState();
          router.push(`/project/${projectId}`);
        }, 500);
      } catch (err) {
        setUploadState("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [projectName, description, router]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 md:px-8 lg:px-12 py-12">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in-up">
        <Sparkles className="w-4 h-4" />
        Get started
      </div>

      <h1 className="text-4xl font-bold mb-4 animate-fade-in-up stagger-1">
        Create your first project
      </h1>
      <p className="text-muted-foreground text-lg max-w-md mb-8 animate-fade-in-up stagger-2">
        Upload a video or audio file and let AI generate stunning visuals
      </p>

      {/* Upload Zone */}
      <div className="w-full max-w-lg animate-fade-in-up stagger-3">
        <UploadZone
          projectName={projectName}
          onProjectNameChange={setProjectName}
          description={description}
          onDescriptionChange={setDescription}
          onFileDrop={handleFileDrop}
          uploadState={uploadState}
          progress={progress}
          statusMessage={statusMessage}
          error={error}
          onReset={resetState}
          inline
        />
      </div>
    </div>
  );
}

// ============================================
// Main Dashboard Page
// ============================================

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bootingProjectId, setBootingProjectId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.getCurrentUserProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await api.deleteProject(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenProject = useCallback(async (projectId: string) => {
    if (bootingProjectId) return;
    setBootingProjectId(projectId);

    try {
      const result = await api.createSandbox(projectId);

      if (result.status === 'ready') {
        router.push(`/project/${projectId}`);
        return;
      }

      // Poll for readiness
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await api.getSandboxStatus(projectId);
        if (status.status === 'ready') {
          router.push(`/project/${projectId}`);
          return;
        }
      }

      throw new Error('Sandbox failed to start in time');
    } catch (err) {
      console.error('Failed to open project:', err);
    } finally {
      setBootingProjectId(null);
    }
  }, [bootingProjectId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6 md:px-8 lg:px-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 md:px-8 lg:px-12 py-12">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={fetchProjects}>Try Again</Button>
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState />;
  }

  // Helper to get stagger class based on index
  const getStaggerClass = (index: number) => {
    const staggerNum = Math.min(index + 1, 6);
    return `stagger-${staggerNum}`;
  };

  return (
    <div className="container py-12 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => setIsNewProjectOpen(true)}
          size="lg"
          className="bg-primary hover:bg-primary/90 gap-2"
        >
          <Plus className="h-5 w-5" />
          New Project
        </Button>
      </div>

      {/* Project Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={setDeleteTarget}
            onOpen={handleOpenProject}
            isBooting={bootingProjectId === project.id}
            className={`animate-fade-in-up ${getStaggerClass(index)}`}
          />
        ))}
      </div>

      {/* New Project Modal */}
      <NewProjectModal open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen} />

      {/* Delete Confirmation */}
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        projectName={deleteTarget?.title || deleteTarget?.videoKey?.split("/").pop() || "this project"}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
