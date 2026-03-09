'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { youtubeApi, YouTubeStreamInfo, YouTubeClipJob } from '@/lib/api';
import { Loader2, Play, Pause, Youtube, Download, AlertCircle, Monitor, Smartphone, Frame, Film, Camera } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FrameStyle = 'none' | 'phone' | 'laptop' | 'browser' | 'polaroid' | 'film';

const FRAME_OPTIONS: { value: FrameStyle; label: string; icon: typeof Monitor; description: string }[] = [
  { value: 'none', label: 'No Frame', icon: Frame, description: 'Raw video without decoration' },
  { value: 'browser', label: 'Browser', icon: Monitor, description: 'Chrome window for web content' },
  { value: 'phone', label: 'Phone', icon: Smartphone, description: 'iPhone mockup for mobile apps' },
  { value: 'laptop', label: 'Laptop', icon: Monitor, description: 'MacBook display for desktop' },
  { value: 'polaroid', label: 'Polaroid', icon: Camera, description: 'Vintage photo style' },
  { value: 'film', label: 'Film Strip', icon: Film, description: '35mm cinematic look' },
];

interface YouTubeClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClipAdded: (clip: {
    clipUrl: string;
    clipId: string;
    sourceUrl: string;
    sourceTitle: string;
    duration: number;
    thumbnail: string;
    startSeconds: number;
    endSeconds: number;
    frameStyle?: FrameStyle;
  }) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return Number(timeStr) || 0;
}

export function YouTubeClipModal({ isOpen, onClose, onClipAdded }: YouTubeClipModalProps) {
  const [url, setUrl] = useState('');
  const [streamInfo, setStreamInfo] = useState<YouTubeStreamInfo | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 30]);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('browser');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamUrlRef = useRef<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setStreamInfo(null);
      setRange([0, 30]);
      setFrameStyle('browser');
      setError(null);
      setIsPlaying(false);
      setIsExtracting(false);
      setExtractProgress(0);
      streamUrlRef.current = null;
    }
  }, [isOpen]);

  // Loop video within selected range
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamInfo) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= range[1]) {
        video.currentTime = range[0];
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [range, streamInfo]);

  const handleLoadVideo = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const info = await youtubeApi.getStreamInfo(url);
      setStreamInfo(info);
      streamUrlRef.current = youtubeApi.getProxyUrl(info.tokenId);

      // Set initial range (first 30 seconds or full duration if shorter)
      const endTime = Math.min(30, info.duration);
      setRange([0, endTime]);
    } catch (err: any) {
      setError(err.message || 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.currentTime = range[0];
      video.play();
      setIsPlaying(true);
    }
  };

  const handleRangeChange = (newRange: number[]) => {
    setRange([newRange[0], newRange[1]]);

    // Update video position to start of selection
    const video = videoRef.current;
    if (video && video.currentTime < newRange[0]) {
      video.currentTime = newRange[0];
    }
  };

  const handleExtract = async () => {
    if (!streamInfo) return;

    setIsExtracting(true);
    setExtractProgress(0);
    setError(null);

    try {
      // Start extraction job
      const { jobId } = await youtubeApi.extractClip(
        url,
        range[0],
        range[1]
      );

      // Poll for completion
      const result = await youtubeApi.pollUntilComplete(jobId, (progress) => {
        setExtractProgress(progress);
      });

      // Pass clip to parent
      // Convert relative clipUrl to absolute URL using the proxy endpoint
      onClipAdded({
        clipUrl: youtubeApi.getClipUrl(result.clipUrl!),
        clipId: result.clipId!,
        sourceUrl: url,
        sourceTitle: result.sourceTitle || streamInfo.title,
        duration: result.duration!,
        thumbnail: result.thumbnail || streamInfo.thumbnail,
        startSeconds: range[0],
        endSeconds: range[1],
        frameStyle,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to extract clip');
    } finally {
      setIsExtracting(false);
    }
  };

  const clipDuration = range[1] - range[0];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Add YouTube Clip
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadVideo()}
              disabled={isLoading || isExtracting}
            />
            <Button
              onClick={handleLoadVideo}
              disabled={!url.trim() || isLoading || isExtracting}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Load'
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Video Preview */}
          {streamInfo && streamUrlRef.current && (
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={streamUrlRef.current}
                  className="w-full h-full"
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onError={() => setError('Failed to load video stream. Try a different URL.')}
                />

                {/* Video title overlay */}
                <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent">
                  <p className="text-white text-sm font-medium truncate">
                    {streamInfo.title}
                  </p>
                  <p className="text-white/70 text-xs">
                    {streamInfo.channel}
                  </p>
                </div>
              </div>

              {/* Range Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Selection: {formatTime(range[0])} - {formatTime(range[1])}</span>
                  <span>Duration: {formatTime(clipDuration)}</span>
                </div>

                <Slider
                  min={0}
                  max={streamInfo.duration}
                  step={0.1}
                  value={range}
                  onValueChange={handleRangeChange}
                  className="py-4"
                />

                {/* Time inputs */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Start:</label>
                    <Input
                      className="w-20 h-8 text-sm"
                      value={formatTime(range[0])}
                      onChange={(e) => {
                        const t = parseTime(e.target.value);
                        if (t < range[1]) setRange([t, range[1]]);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">End:</label>
                    <Input
                      className="w-20 h-8 text-sm"
                      value={formatTime(range[1])}
                      onChange={(e) => {
                        const t = parseTime(e.target.value);
                        if (t > range[0] && t <= streamInfo.duration) setRange([range[0], t]);
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    className="ml-auto"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Preview
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Frame Style Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Frame Style</label>
                <Select value={frameStyle} onValueChange={(v) => setFrameStyle(v as FrameStyle)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a frame style" />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAME_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground ml-1">— {option.description}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Extract Progress */}
              {isExtracting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Downloading clip...</span>
                    <span>{extractProgress}%</span>
                  </div>
                  <Progress value={extractProgress} />
                </div>
              )}

              {/* Extract Button */}
              <Button
                className="w-full"
                onClick={handleExtract}
                disabled={isExtracting || clipDuration <= 0 || clipDuration > 600}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Add {formatTime(clipDuration)} Clip
                  </>
                )}
              </Button>

              {clipDuration > 600 && (
                <p className="text-xs text-amber-500 text-center">
                  Clips are limited to 10 minutes maximum
                </p>
              )}
            </>
          )}

          {/* Empty state */}
          {!streamInfo && !isLoading && !error && (
            <div className="text-center py-12 text-muted-foreground">
              <Youtube className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Paste a YouTube URL to get started</p>
              <p className="text-sm mt-1">
                Preview and trim the exact section you want
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
