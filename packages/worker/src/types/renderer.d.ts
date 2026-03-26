declare module '@viona/renderer' {
  export interface WordStyleOverrides {
    color?: string;
    activeColor?: string;
    fontWeight?: number;
    fontFamily?: string;
    fontSize?: number;
    scale?: number;
    letterSpacing?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    emphasisBg?: string;
  }

  export interface SubtitleWord {
    text: string;
    startMs: number;
    endMs: number;
    styleOverrides?: WordStyleOverrides;
  }

  export interface StrokeStyle {
    width: number;
    color: string;
  }

  export interface ShadowEffect {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
    opacity: number;
  }

  export interface GlowEffect {
    enabled: boolean;
    color: string;
    intensity: number;
    size: number;
  }

  export interface CaptionEffects {
    shadow: ShadowEffect | null;
    shadowSecondary: ShadowEffect | null;
    glow: GlowEffect | null;
  }

  export interface SubtitlePosition {
    anchor: 'top' | 'center' | 'bottom';
    offsetX: number;
    offsetY: number;
    rotation: number;
    textAlign: 'left' | 'center' | 'right';
  }

  export interface SubtitleStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    activeColor?: string;
    backgroundColor?: string;
    activeBackgroundColor?: string;
    position?: SubtitlePosition | 'top' | 'center' | 'bottom';
    animation?: string | Record<string, unknown>;
    textShadow?: string;
    effects?: CaptionEffects;
    opacity?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    stroke?: StrokeStyle | null;
    displayMode?: 'word-by-word' | 'phrase' | 'karaoke' | 'poster-staircase';
    wordsPerPhrase?: number;
    presetId?: string;
    typographyPairingId?: string;
    displayFontFamily?: string;
    bodyFontFamily?: string;
    backgroundPadding?: { x: number; y: number };
    backgroundRadius?: number;
  }

  export interface SubtitleItem {
    id: string;
    startMs: number;
    endMs: number;
    text: string;
    words: SubtitleWord[];
    style?: SubtitleStyle;
  }

  export interface VideoCropSettings {
    sourceWidth: number;
    sourceHeight: number;
    cropX: number;
    cropY: number;
    scale: number;
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
    videoCrop?: VideoCropSettings;
    onProgress?: (progress: number) => void;
  }

  export function renderVideo(options: RenderOptions): Promise<void>;
}
