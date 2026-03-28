"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, UserProject, type Job, type ProjectsListResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
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
  Video,
  MoreVertical,
  Trash2,
  Play,
  Music,
  AlertCircle,
  ChevronDown,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { TextShimmer } from "@/components/ui/text-shimmer";

// ============================================
// Utility Functions
// ============================================

/**
 * Poll processing jobs (transcribe + head-tracking) until all complete or fail.
 */
async function pollProcessingJobs(
  jobIds: string[],
  onProgress: (percent: number, message: string) => void,
): Promise<void> {
  const maxPolls = 300;
  for (let i = 0; i < maxPolls; i++) {
    const jobs: Job[] = await Promise.all(jobIds.map(id => api.getJob(id)));

    const allDone = jobs.every(j => j.status === 'complete' || j.status === 'failed');
    const anyFailed = jobs.find(j => j.status === 'failed');

    if (anyFailed) {
      throw new Error(`Processing failed: ${anyFailed.progressMessage || anyFailed.type}`);
    }

    if (allDone) return;

    const avgProgress = Math.round(jobs.reduce((sum, j) => sum + (j.progress || 0), 0) / jobs.length);
    const activeJob = jobs.find(j => j.status === 'processing');
    const message = activeJob?.progressMessage || 'Processing...';
    onProgress(avgProgress, message);

    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Processing timed out');
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
      return { label: "Ready", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
    case "processing":
    case "rendering":
    case "generating":
      return { label: "Processing", className: "bg-amber-500/15 text-amber-400 border-amber-500/25 animate-pulse" };
    case "uploading":
      return { label: "Uploading", className: "bg-blue-500/15 text-blue-400 border-blue-500/25 animate-pulse" };
    case "failed":
      return { label: "Failed", className: "bg-red-500/15 text-red-400 border-red-500/25" };
    default:
      return { label: status, className: "bg-white/[0.06] text-white/50" };
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
      <DialogContent className="sm:max-w-md bg-[rgba(28,28,35,0.9)] backdrop-blur-2xl border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.5)] rounded-2xl text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white/95">Delete project?</DialogTitle>
        </DialogHeader>
        <p className="text-white/50">
          <span className="font-normal text-white/90">&ldquo;{projectName}&rdquo;</span> will be permanently deleted. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end mt-4">
          <LiquidButton variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting} className="border-white/[0.1] text-white/70">
            Cancel
          </LiquidButton>
          <LiquidButton variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </LiquidButton>
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
        <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/15 flex items-center justify-center">
          <Video className="w-8 h-8 text-[#8B5CF6]/60" />
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

function VideoThumbnail({ projectId }: { projectId: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/15 flex items-center justify-center">
          <Video className="w-8 h-8 text-[#8B5CF6]/60" />
        </div>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
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
      className={`group block glass-card cursor-pointer ${isBooting ? "opacity-70" : ""} ${className || ""}`}
    >
      {/* Thumbnail Area */}
      <div className="aspect-video bg-gradient-to-br from-violet-950/40 to-purple-950/30 relative overflow-hidden">
        {project.thumbnailKey ? (
          <ThumbnailImage projectId={project.id} alt={projectName} hasVideoKey={!!project.videoKey} />
        ) : project.projectType === 'audio' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-950/30 to-purple-950/20">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/15 flex items-center justify-center">
              <Music className="w-8 h-8 text-violet-400/60" />
            </div>
          </div>
        ) : project.videoKey ? (
          <VideoThumbnail projectId={project.id} alt={projectName} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/15 flex items-center justify-center">
              <Video className="w-8 h-8 text-[#8B5CF6]/60" />
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-normal border backdrop-blur-xl ${status.className}`}>
          {status.label}
        </div>

        {/* Booting Overlay */}
        {isBooting && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Play Button Overlay (on hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center">
            <Play className="w-6 h-6 text-[#8B5CF6] ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Three Dot Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[rgba(28,28,35,0.9)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-xl" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400 hover:bg-white/[0.06] focus:bg-white/[0.06] cursor-pointer rounded-lg"
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
        <h3 className="font-normal text-white/90 truncate mb-1">{projectName}</h3>
        <p className="text-sm text-white/40">
          {formatDate(project.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Main Dashboard Page
// ============================================

type SortBy = 'createdAt' | 'updatedAt' | 'title' | 'status';
type SortOrder = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'rendering', label: 'Rendering' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'title', label: 'Title' },
];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bootingProjectId, setBootingProjectId] = useState<string | null>(null);

  // Pagination & filtering state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Chat state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const greeting = (
    <TextShimmer
      as="span"
      duration={3}
      className="[--base-color:theme(colors.white/0.3)] [--base-gradient-color:theme(colors.white/0.9)]"
    >
      What would you like to create?
    </TextShimmer>
  );

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.getCurrentUserProjects({
        page,
        limit: 12,
        sortBy,
        sortOrder,
        ...(statusFilter && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery }),
      });
      setProjects(data.items);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, statusFilter, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await api.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      fetchProjects(); // Re-fetch to update counts and pagination
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
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

  // Handle chat send — create project from attached file + brief
  const handleChatSend = useCallback(async (message: string, files: File[]) => {
    if (files.length === 0 && !message.trim()) return;
    if (files.length === 0) return;

    const file = files[0];
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      const title = (message.trim() || file.name.replace(/\.[^/.]+$/, "")).slice(0, 255);

      setProcessingMessage("Creating project...");
      const { projectId } = await api.createProject(file.name, title, message);
      if (message.trim()) {
        sessionStorage.setItem(`project-brief-${projectId}`, message.trim());
      }

      setProcessingMessage("Uploading media...");
      await api.uploadViaProxy(projectId, file, (pct) => {
        setUploadProgress(pct);
      });
      setUploadProgress(100);

      setProcessingMessage("Transcribing...");
      const processResult = await api.processProject(projectId);

      await pollProcessingJobs([processResult.transcribeJobId], () => {
        setProcessingMessage("Transcribing...");
      });

      setProcessingMessage("Setting up workspace...");
      const result = await api.createSandbox(projectId);

      if (result.status !== 'ready') {
        for (let i = 0; i < 90; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const status = await api.getSandboxStatus(projectId);
          if (status.status === 'ready') break;
        }
      }

      setProcessingMessage("Opening editor...");
      router.push(`/project/${projectId}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setIsProcessing(false);
      setProcessingMessage("");
      setUploadProgress(0);
    }
  }, [router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
          <p className="text-white/40">Loading your projects...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-normal mb-2 text-white/90">Something went wrong</h2>
        <p className="text-white/40 mb-6">{error}</p>
        <LiquidButton onClick={fetchProjects}>Try Again</LiquidButton>
      </div>
    );
  }

  const hasProjects = total > 0 || projects.length > 0;
  const hasActiveFilters = statusFilter !== '' || searchQuery !== '';

  return (
    <div className={hasProjects ? "h-screen overflow-y-auto snap-y snap-mandatory" : "h-screen"}>
      {/* Slide 1: AI Chat */}
      <div className="h-screen snap-start snap-always shrink-0 flex items-center justify-center relative">
        <AnimatedAIChat
          greeting={greeting}
          onSend={handleChatSend}
          isProcessing={isProcessing}
          processingMessage={processingMessage}
          uploadProgress={uploadProgress}
          compact={false}
          placeholder="Describe your creative vision..."
        />

        {/* Scroll hint arrow */}
        {hasProjects && (
          <button
            onClick={() => document.getElementById("projects-grid")?.scrollIntoView({ behavior: "smooth" })}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/25 hover:text-white/60 transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Slide 2: Projects Grid */}
      {hasProjects && (
        <div id="projects-grid" className="h-screen px-4 md:px-6 lg:px-8 pt-10 pb-12 snap-start snap-always shrink-0 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto w-full">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6 px-2">
              <div>
                <h2 className="text-lg font-normal text-white/80">Recent Projects</h2>
                <p className="text-sm text-white/35 mt-0.5">
                  {total} project{total !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Filters & Sort Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6 px-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-colors"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/70 focus:outline-none focus:border-white/20 cursor-pointer appearance-none pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.3)%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#1c1c23] text-white">
                    {opt.value ? opt.label : 'All Statuses'}
                  </option>
                ))}
              </select>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/70 hover:bg-white/[0.06] transition-colors">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                    <span className="text-white/40">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[rgba(28,28,35,0.95)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-xl">
                  {SORT_OPTIONS.map(opt => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => toggleSort(opt.value as SortBy)}
                      className="text-white/70 hover:bg-white/[0.06] focus:bg-white/[0.06] cursor-pointer rounded-lg"
                    >
                      {opt.label}
                      {sortBy === opt.value && (
                        <span className="ml-auto text-white/40">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearchInput(''); setSearchQuery(''); setStatusFilter(''); setPage(1); }}
                  className="flex items-center gap-1 px-2.5 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* Grid */}
            {projects.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={setDeleteTarget}
                    onOpen={handleOpenProject}
                    isBooting={bootingProjectId === project.id}
                    className={`animate-fade-in-up stagger-${Math.min(index + 1, 6)}`}
                  />
                ))}
              </div>
            ) : hasActiveFilters ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="w-10 h-10 text-white/15 mb-3" />
                <p className="text-white/40 text-sm">No projects match your filters</p>
                <button
                  onClick={() => { setSearchInput(''); setSearchQuery(''); setStatusFilter(''); setPage(1); }}
                  className="mt-3 text-sm text-[#8B5CF6] hover:text-[#8B5CF6]/80 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : null}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1]) > 1) acc.push('dots');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'dots' ? (
                      <span key={`dots-${i}`} className="px-1 text-white/20">...</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                          page === item
                            ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                            : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/80'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
