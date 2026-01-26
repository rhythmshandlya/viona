/**
 * Converts Reelify API project data to DesignCombo editor format
 */

import { Project, TimelineItem, Track } from "./api";
import { nanoid } from "nanoid";

// DesignCombo track item types
interface DesignComboVideoItem {
  id: string;
  type: "video";
  name: string;
  display: { from: number; to: number };
  trim: { from: number; to: number };
  duration: number;
  playbackRate: number;
  isMain: boolean;
  details: {
    src: string;
    width: number;
    height: number;
    opacity: number;
    volume: number;
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
    boxShadow: { color: string; x: number; y: number; blur: number };
    top: string;
    left: string;
    transform: string;
    blur: number;
    brightness: number;
    flipX: boolean;
    flipY: boolean;
    rotate: string;
    visibility: string;
  };
  metadata: Record<string, unknown>;
}

interface DesignComboCaptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  is_keyword: boolean;
}

interface DesignComboCaptionItem {
  id: string;
  type: "caption";
  name: string;
  display: { from: number; to: number };
  isMain: boolean;
  details: {
    text: string;
    words: DesignComboCaptionWord[];
    fontSize: number;
    fontFamily: string;
    fontUrl: string;
    fontWeight: string;
    fontStyle: string;
    color: string;
    appearedColor: string;
    activeColor: string;
    activeFillColor: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    textAlign: string;
    width: number;
    height: number;
    top: string;
    left: string;
    opacity: number;
    linesPerCaption: number;
    lineHeight: string;
    letterSpacing: string;
    wordSpacing: string;
    textDecoration: string;
    textTransform: string;
    transform: string;
    border: string;
    textShadow: string;
    wordWrap: string;
    wordBreak: string;
    WebkitTextStrokeColor: string;
    WebkitTextStrokeWidth: string;
    skewX: number;
    skewY: number;
    boxShadow: { color: string; x: number; y: number; blur: number };
    isKeywordColor: string;
    preservedColorKeyWord: boolean;
    wordsPerLine: string;
  };
  metadata: {
    sourceUrl?: string;
    parentId?: string;
  };
}

type DesignComboTrackItem = DesignComboVideoItem | DesignComboCaptionItem;

interface DesignComboTrack {
  id: string;
  type: string;
  name: string;
  items: string[];
  accepts: string[];
  magnetic: boolean;
  static: boolean;
}

interface DesignComboDesign {
  id: string;
  fps: number;
  size: { width: number; height: number };
  tracks: DesignComboTrack[];
  trackItemIds: string[];
  trackItemsMap: Record<string, DesignComboTrackItem>;
  transitionsMap: Record<string, unknown>;
  transitionIds: string[];
}

// Default caption style
const DEFAULT_CAPTION_STYLE = {
  fontSize: 64,
  fontFamily: "Inter",
  fontUrl: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2",
  fontWeight: "600",
  fontStyle: "normal",
  color: "#FFFFFF",
  appearedColor: "#FFFFFF",
  activeColor: "#FFD700",
  activeFillColor: "transparent",
  backgroundColor: "transparent",
  borderColor: "#000000",
  borderWidth: 0,
  textAlign: "center",
  width: 900,
  height: 80,
  opacity: 100,
  linesPerCaption: 1,
  lineHeight: "normal",
  letterSpacing: "normal",
  wordSpacing: "normal",
  textDecoration: "none",
  textTransform: "none",
  transform: "none",
  border: "none",
  textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
  wordWrap: "normal",
  wordBreak: "normal",
  WebkitTextStrokeColor: "#000000",
  WebkitTextStrokeWidth: "0px",
  skewX: 0,
  skewY: 0,
  boxShadow: { color: "#000000", x: 0, y: 0, blur: 0 },
  isKeywordColor: "transparent",
  preservedColorKeyWord: false,
  wordsPerLine: "punctuationOrPause",
};

/**
 * Convert Reelify project to DesignCombo design format
 */
export function projectToDesignComboFormat(
  project: Project,
  videoUrl: string
): DesignComboDesign {
  const designId = project.id;
  const fps = project.fps || 30;
  const width = project.width || 1920;
  const height = project.height || 1080;
  const duration = project.durationMs || 0;

  // Create video track and item
  const videoTrackId = `video-track-${nanoid(8)}`;
  const videoItemId = `video-${nanoid(8)}`;

  const videoItem: DesignComboVideoItem = {
    id: videoItemId,
    type: "video",
    name: "video",
    display: { from: 0, to: duration },
    trim: { from: 0, to: duration },
    duration: duration,
    playbackRate: 1,
    isMain: true,
    details: {
      src: videoUrl,
      width: width,
      height: height,
      opacity: 100,
      volume: 100,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: "#000000",
      boxShadow: { color: "#000000", x: 0, y: 0, blur: 0 },
      top: "0px",
      left: "0px",
      transform: "none",
      blur: 0,
      brightness: 100,
      flipX: false,
      flipY: false,
      rotate: "0deg",
      visibility: "visible",
    },
    metadata: {},
  };

  const videoTrack: DesignComboTrack = {
    id: videoTrackId,
    type: "video",
    name: "Video",
    items: [videoItemId],
    accepts: ["video", "image", "audio"],
    magnetic: false,
    static: false,
  };

  // Create caption track and items
  const captionTrackId = `caption-track-${nanoid(8)}`;
  const captionItems: DesignComboCaptionItem[] = [];
  const captionItemIds: string[] = [];

  // Find subtitle items from project
  const subtitleItems = project.items.filter((item) => item.type === "subtitle");

  // Calculate caption position (center bottom)
  const captionTop = Math.round(height * 0.85);
  const captionLeft = Math.round((width - DEFAULT_CAPTION_STYLE.width) / 2);

  for (const item of subtitleItems) {
    const data = item.data as {
      text?: string;
      words?: Array<{ text: string; startMs: number; endMs: number }>;
      style?: Record<string, unknown>;
    };

    if (!data.text) continue;

    const captionId = `caption-${nanoid(8)}`;
    captionItemIds.push(captionId);

    // Convert words to DesignCombo format
    const words: DesignComboCaptionWord[] = (data.words || []).map((w) => ({
      word: w.text,
      start: w.startMs,
      end: w.endMs,
      confidence: 1,
      is_keyword: false,
    }));

    const captionItem: DesignComboCaptionItem = {
      id: captionId,
      type: "caption",
      name: "caption",
      display: { from: item.startMs, to: item.endMs },
      isMain: false,
      details: {
        ...DEFAULT_CAPTION_STYLE,
        text: data.text,
        words: words,
        top: `${captionTop}px`,
        left: `${captionLeft}px`,
      },
      metadata: {
        sourceUrl: videoUrl,
        parentId: videoItemId,
      },
    };

    captionItems.push(captionItem);
  }

  const captionTrack: DesignComboTrack = {
    id: captionTrackId,
    type: "caption",
    name: "Captions",
    items: captionItemIds,
    accepts: ["caption"],
    magnetic: false,
    static: false,
  };

  // Build track items map
  const trackItemsMap: Record<string, DesignComboTrackItem> = {
    [videoItemId]: videoItem,
  };

  for (const caption of captionItems) {
    trackItemsMap[caption.id] = caption;
  }

  // Build design
  const design: DesignComboDesign = {
    id: designId,
    fps: fps,
    size: { width, height },
    tracks: [captionTrack, videoTrack],
    trackItemIds: [videoItemId, ...captionItemIds],
    trackItemsMap: trackItemsMap,
    transitionsMap: {},
    transitionIds: [],
  };

  return design;
}

/**
 * Convert DesignCombo design back to Reelify update format
 * Used when saving changes from the editor
 */
export function designComboToProjectUpdates(
  design: DesignComboDesign,
  originalProject: Project
): { items: Array<{ id: string; startMs?: number; endMs?: number; data?: Record<string, unknown> }> } {
  const updates: Array<{ id: string; startMs?: number; endMs?: number; data?: Record<string, unknown> }> = [];

  // Find caption items and map back to original items
  for (const [itemId, item] of Object.entries(design.trackItemsMap)) {
    if (item.type !== "caption") continue;

    // Find original item by matching text or position
    const captionItem = item as DesignComboCaptionItem;
    const originalItem = originalProject.items.find(
      (i) => i.type === "subtitle" &&
      Math.abs(i.startMs - captionItem.display.from) < 100
    );

    if (originalItem) {
      updates.push({
        id: originalItem.id,
        startMs: captionItem.display.from,
        endMs: captionItem.display.to,
        data: {
          text: captionItem.details.text,
          words: captionItem.details.words.map((w) => ({
            text: w.word,
            startMs: w.start,
            endMs: w.end,
          })),
          style: {
            fontFamily: captionItem.details.fontFamily,
            fontSize: captionItem.details.fontSize,
            fontWeight: parseInt(captionItem.details.fontWeight) || 600,
            color: captionItem.details.color,
            backgroundColor: captionItem.details.backgroundColor,
            position: "bottom",
            animation: "highlight-word",
            highlightColor: captionItem.details.activeColor,
          },
        },
      });
    }
  }

  return { items: updates };
}
