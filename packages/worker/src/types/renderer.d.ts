declare module '@viona/renderer' {
  export interface SubtitleWord {
    text: string;
    startMs: number;
    endMs: number;
  }

  export interface SubtitleStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    activeColor?: string;
    backgroundColor?: string;
    activeBackgroundColor?: string;
    position?: 'top' | 'center' | 'bottom';
    animation?: 'none' | 'pop' | 'fade' | 'highlight' | 'karaoke';
  }

  export interface SubtitleItem {
    id: string;
    startMs: number;
    endMs: number;
    text: string;
    words: SubtitleWord[];
    style?: SubtitleStyle;
  }

  export interface RenderOptions {
    videoUrl: string;
    subtitles: SubtitleItem[];
    outputPath: string;
    width?: number;
    height?: number;
    fps?: number;
    durationMs: number;
    defaultSubtitleStyle?: SubtitleStyle;
    onProgress?: (progress: number) => void;
  }

  export function renderVideo(options: RenderOptions): Promise<void>;
}
