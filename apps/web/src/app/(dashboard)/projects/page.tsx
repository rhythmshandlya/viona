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
  CheckCircle,
  AlertCircle,
  Sparkles,
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
      <DialogContent className="sm:max-w-md">
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
// Project Card
// ============================================

function ProjectCard({
  project,
  onDelete,
  style,
}: {
  project: UserProject;
  onDelete: (project: UserProject) => void;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const status = getStatusConfig(project.status);
  const projectName = project.title || project.videoKey?.split("/").pop() || `Project ${project.id.slice(0, 8)}`;

  return (
    <div
      className="group relative bg-card rounded-2xl border border-border/50 overflow-hidden transition-all duration-300 hover:border-border hover:shadow-lg hover:-translate-y-1 cursor-pointer"
      style={style}
      onClick={() => router.push(`/project/${project.id}`)}
    >
      {/* Thumbnail Area */}
      <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted relative overflow-hidden">
        {project.thumbnailKey ? (
          <img
            src={api.getThumbnailUrl(project.id)}
            alt={projectName}
            className="w-full h-full object-cover"
          />
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

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* Three Dot Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white shadow-sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={(e) => {
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
        <h3 className="font-semibold text-foreground truncate mb-2">{projectName}</h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(project.durationMs)}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(project.createdAt)}
          </div>
        </div>
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

      {/* Drop Zone */}
      {uploadState === "idle" ? (
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center
            transition-all duration-300 cursor-pointer group
            ${isDragActive
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30"
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
                {isDragActive ? "Drop your video here" : "Drag & drop your video"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse • MP4, MOV, WebM
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card p-8 space-y-6">
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
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const jobProgressRef = useRef<Record<string, number>>({});

  const resetState = () => {
    setProjectName("");
    setUploadState("idle");
    setProgress(0);
    setStatusMessage("");
    setError(null);
    jobProgressRef.current = {};
  };

  const handleFileDrop = useCallback(
    async (file: File) => {
      setUploadState("uploading");
      setProgress(0);
      setError(null);
      setStatusMessage("Creating project...");

      try {
        // Use filename as fallback title
        const title = projectName.trim() || file.name.replace(/\.[^/.]+$/, "");

        // Step 1: Create project
        const { projectId } = await api.createProject(file.name, title);
        setStatusMessage("Uploading video...");

        // Step 2: Upload file
        await api.uploadViaProxy(projectId, file, (uploadProgress) => {
          setProgress(uploadProgress);
        });

        setStatusMessage("Processing video...");
        setUploadState("processing");
        setProgress(0);

        // Step 3: Connect WebSocket and start processing
        wsClient.connect(projectId);

        const completedJobs = new Set<string>();
        const totalJobs = 2;

        const removeHandler = wsClient.addHandler((message: WSMessage) => {
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

            if (completedJobs.size >= totalJobs) {
              setUploadState("complete");
              setStatusMessage("Processing complete!");
              setProgress(100);
              removeHandler();

              setTimeout(() => {
                onOpenChange(false);
                resetState();
                router.push(`/project/${payload.projectId}`);
              }, 800);
            } else {
              setStatusMessage("Finishing up...");
            }
          } else if (message.type === "job:error") {
            const payload = message.payload as JobErrorPayload;
            setUploadState("error");
            setError(payload.error);
            removeHandler();
          }
        });

        // Step 4: Start processing
        const { transcribeJobId, enhanceJobId } = await api.processProject(projectId);
        wsClient.subscribeToJob(transcribeJobId);
        wsClient.subscribeToJob(enhanceJobId);
      } catch (err) {
        setUploadState("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [projectName, router, onOpenChange]
  );

  const handleClose = (open: boolean) => {
    if (!open && uploadState !== "uploading" && uploadState !== "processing") {
      resetState();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl" showCloseButton={uploadState === "idle" || uploadState === "error"}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">New Project</DialogTitle>
        </DialogHeader>
        <UploadZone
          projectName={projectName}
          onProjectNameChange={setProjectName}
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
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const jobProgressRef = useRef<Record<string, number>>({});

  const resetState = () => {
    setProjectName("");
    setUploadState("idle");
    setProgress(0);
    setStatusMessage("");
    setError(null);
    jobProgressRef.current = {};
  };

  const handleFileDrop = useCallback(
    async (file: File) => {
      setUploadState("uploading");
      setProgress(0);
      setError(null);
      setStatusMessage("Creating project...");

      try {
        const title = projectName.trim() || file.name.replace(/\.[^/.]+$/, "");
        const { projectId } = await api.createProject(file.name, title);
        setStatusMessage("Uploading video...");

        await api.uploadViaProxy(projectId, file, (uploadProgress) => {
          setProgress(uploadProgress);
        });

        setStatusMessage("Processing video...");
        setUploadState("processing");
        setProgress(0);

        wsClient.connect(projectId);

        const completedJobs = new Set<string>();
        const totalJobs = 2;

        const removeHandler = wsClient.addHandler((message: WSMessage) => {
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

            if (completedJobs.size >= totalJobs) {
              setUploadState("complete");
              setStatusMessage("Processing complete!");
              setProgress(100);
              removeHandler();

              setTimeout(() => {
                router.push(`/project/${payload.projectId}`);
              }, 800);
            } else {
              setStatusMessage("Finishing up...");
            }
          } else if (message.type === "job:error") {
            const payload = message.payload as JobErrorPayload;
            setUploadState("error");
            setError(payload.error);
            removeHandler();
          }
        });

        const { transcribeJobId, enhanceJobId } = await api.processProject(projectId);
        wsClient.subscribeToJob(transcribeJobId);
        wsClient.subscribeToJob(enhanceJobId);
      } catch (err) {
        setUploadState("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [projectName, router]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-xl mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Get started
        </div>
        <h1 className="text-3xl font-bold mb-3">Create your first project</h1>
        <p className="text-muted-foreground text-lg">
          Upload a video and let AI generate stunning visuals
        </p>
      </div>

      {/* Upload Zone */}
      <div className="w-full">
        <UploadZone
          projectName={projectName}
          onProjectNameChange={setProjectName}
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
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
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

  return (
    <div className="container py-10 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setIsNewProjectOpen(true)} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          New Project
        </Button>
      </div>

      {/* Project Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={setDeleteTarget}
            style={{
              animationDelay: `${index * 50}ms`,
              animation: "fadeInUp 0.4s ease-out forwards",
              opacity: 0,
            }}
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

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
