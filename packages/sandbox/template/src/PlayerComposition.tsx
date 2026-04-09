import React, { useEffect, useMemo } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TransformWrapper } from './composition/TransformWrapper';
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem as SceneItemComponent, ShapeItem, CaptionItem, CinematicSubtitle, MatteItem, KineticLuxeCaption, BrollItem } from './items';
import { sceneRegistry } from './scene-registry';

/** Load Google Fonts via <link> tags for preset fonts */
function usePresetFonts(captionPreset: any) {
  useEffect(() => {
    const families = new Set<string>();

    // Cinematic fonts
    if (captionPreset?.cinematicFonts) {
      const fonts = captionPreset.cinematicFonts;
      [fonts.boldSans, fonts.elegantCursive, fonts.default].filter(Boolean).forEach(f => families.add(f));
    }

    // Dynamic hierarchy dual fonts
    if (captionPreset?.displayFontFamily) families.add(captionPreset.displayFontFamily);
    if (captionPreset?.bodyFontFamily) families.add(captionPreset.bodyFontFamily);

    // Kinetic Luxe hero font
    if (captionPreset?.heroFontFamily) {
      const primary = captionPreset.heroFontFamily.split(',')[0].trim();
      if (primary) families.add(primary);
    }

    // Base font
    if (captionPreset?.fontFamily) {
      const primary = captionPreset.fontFamily.split(',')[0].trim();
      if (primary) families.add(primary);
    }

    for (const rawFamily of families) {
      // Strip CSS quotes — Google Fonts API rejects '%27Inter%27', needs 'Inter'
      const family = rawFamily.replace(/^['"]|['"]$/g, '');
      if (!family) continue;
      const id = `preset-font-${family.replace(/\s+/g, '-')}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    }
  }, [captionPreset?.cinematicFonts, captionPreset?.fontFamily, captionPreset?.heroFontFamily, captionPreset?.displayFontFamily, captionPreset?.bodyFontFamily]);
}

interface ManifestItem {
  id: string;
  type: string;
  trackId: string;
  startMs: number;
  endMs: number;
  data: any;
  transform?: any;
  keyframes?: any[];
  filters?: any;
  style?: React.CSSProperties;
}

interface ManifestTrack {
  id: string;
  type: string;
  name: string;
  position: number;
}

interface Manifest {
  version: number;
  fps: number;
  durationMs: number;
  canvas: { width: number; height: number };
  tracks: ManifestTrack[];
  items: ManifestItem[];
  assets: Record<string, string>;
  captionPreset?: any;
  captionStyle?: any;
  videoSettings?: any;
  captionAnalysis?: Record<string, any>;
}

interface PlayerCompositionProps {
  manifest: Manifest;
}

const FULL_CANVAS_TRANSFORM = {
  x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
};

/** Merge single-word caption items into multi-word phrase groups for cinematic layout */
function mergeCaptionPhrases(captionItems: ManifestItem[], wordsPerPhrase: number): ManifestItem[] {
  if (captionItems.length === 0) return captionItems;
  // If items already have multiple words, no merge needed
  if (captionItems[0]?.data?.words?.length > 1) return captionItems;

  const merged: ManifestItem[] = [];
  for (let i = 0; i < captionItems.length; i += wordsPerPhrase) {
    const group = captionItems.slice(i, i + wordsPerPhrase);
    const allWords = group.flatMap(item => item.data?.words ?? []);
    if (allWords.length === 0) continue;
    merged.push({
      ...group[0],
      endMs: group[group.length - 1].endMs,
      data: { words: allWords },
    });
  }
  return merged;
}

export const PlayerComposition: React.FC<PlayerCompositionProps> = React.memo(({ manifest }) => {
  const { fps, canvas, items, assets } = manifest;
  const captionPreset = manifest.captionPreset ?? manifest.captionStyle ?? {};
  const captionAnalysis = (manifest as any).captionAnalysis ?? manifest.videoSettings?.captionAnalysis ?? {};
  const sortedTracks = useMemo(
    () => [...(manifest.tracks || [])].sort((a, b) => a.position - b.position),
    [manifest.tracks]
  );
  const isDynamicHierarchy = !!captionPreset.typographyPairingId;

  // Load cinematic Google Fonts when preset uses them
  usePresetFonts(captionPreset);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {sortedTracks.map(track => {
        let trackItems = items
          .filter(item => item.trackId === track.id)
          .sort((a, b) => a.startMs - b.startMs);
        if (trackItems.length === 0) return null;

        // Merge single-word captions into phrase groups for phrase/karaoke/poster-staircase/DH display
        const needsMergeComp = isDynamicHierarchy ||
          captionPreset.displayMode === 'phrase' ||
          captionPreset.displayMode === 'karaoke' ||
          captionPreset.displayMode === 'poster-staircase';
        if (needsMergeComp && trackItems[0]?.type === 'caption') {
          trackItems = mergeCaptionPhrases(trackItems, captionPreset.wordsPerPhrase || 6);
        }

        return (
          <AbsoluteFill key={track.id}>
            {trackItems.map(item => {
              const startFrame = Math.round((item.startMs / 1000) * fps);
              const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

              // Audio items: layout="none" (no visual container needed), no premount
              if (item.type === 'audio') {
                return (
                  <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionPreset={captionPreset} captionAnalysis={captionAnalysis} />
                  </Sequence>
                );
              }

              // Visual items: premount sequences so components mount BEFORE
              // their start frame — avoids jank at cut boundaries.
              // - video/image: browser needs time for container parse + decoder init + seek
              // - scene: React needs time to mount the component tree + initial render
              // - text/shape/caption: lightweight, small premount is enough
              const premountFrames = (item.type === 'matte')
                ? fps * 3   // 3s — matte needs both fgr + matte videos decoded
                : (item.type === 'video' || item.type === 'image' || item.type === 'broll')
                ? fps * 2   // 2s — video decode needs seek time
                : (item.type === 'scene')
                  ? fps * 1 // 1s — scene component mount + initial React render
                  : Math.round(fps * 0.5); // 0.5s — lightweight items

              const transform = item.transform ?? FULL_CANVAS_TRANSFORM;
              return (
                <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} premountFor={premountFrames}>
                  <TransformWrapper transform={transform} keyframes={item.keyframes} filters={item.filters} fps={fps} style={item.style}>
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionPreset={captionPreset} captionAnalysis={captionAnalysis} />
                  </TransformWrapper>
                </Sequence>
              );
            })}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
});

interface ItemRendererProps {
  item: ManifestItem;
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
  canvas: { width: number; height: number };
  captionPreset?: any;
  captionAnalysis?: Record<string, any>;
}

const ItemRenderer: React.FC<ItemRendererProps> = React.memo(({ item, assets, fps, durationInFrames, canvas, captionPreset, captionAnalysis }) => {
  switch (item.type) {
    case 'video':
      return <VideoItem data={item.data} assets={assets} fps={fps} durationInFrames={durationInFrames} />;
    case 'audio':
      return <AudioItem data={item.data} assets={assets} fps={fps} />;
    case 'text':
      return <TextItem data={item.data} />;
    case 'image':
      return <ImageItem data={item.data} assets={assets} />;
    case 'scene': {
      const sceneWidth = item.transform?.width != null
        ? (typeof item.transform.width === 'string' && item.transform.width.endsWith('%')
          ? (parseFloat(item.transform.width) / 100) * canvas.width
          : Number(item.transform.width))
        : canvas.width;
      const sceneHeight = item.transform?.height != null
        ? (typeof item.transform.height === 'string' && item.transform.height.endsWith('%')
          ? (parseFloat(item.transform.height) / 100) * canvas.height
          : Number(item.transform.height))
        : canvas.height;
      return (
        <SceneItemComponent
          data={item.data}
          width={sceneWidth}
          height={sceneHeight}
          durationInFrames={durationInFrames}
          fps={fps}
          sceneRegistry={sceneRegistry}
        />
      );
    }
    case 'shape':
      return <ShapeItem data={item.data} />;
    case 'caption': {
      const analysis = captionAnalysis?.[item.id];
      // Kinetic Luxe — hero/satellite typography engine
      if (captionPreset?.displayMode === 'kinetic-luxe') {
        return (
          <KineticLuxeCaption
            words={item.data.words}
            itemStartMs={item.startMs}
            heroFontFamily={captionPreset.heroFontFamily}
            heroColor={captionPreset.heroColor}
            satFontFamily={captionPreset.fontFamily}
            satColor={captionPreset.color}
            fontPairId={captionPreset.fontPairId}
            offsetY={captionPreset.position?.offsetY}
            positionX={item.data.positionOverride?.x ?? captionPreset.position?.x}
            positionY={item.data.positionOverride?.y ?? captionPreset.position?.y}
            positionMode={item.data.positionOverride ? 'free' : captionPreset.position?.mode}
          />
        );
      }
      if (captionPreset?.useCinematicRenderer && analysis) {
        return (
          <CinematicSubtitle
            words={item.data.words}
            analysis={analysis}
            startMs={item.startMs}
            endMs={item.endMs}
            style={{
              fontFamily: captionPreset.fontFamily || 'Inter',
              fontSize: captionPreset.fontSize || 42,
              animation: captionPreset.animation || { in: 'fade-rise', active: 'none', out: 'none', easing: 'spring' },
              position: captionPreset.position || { anchor: 'center', offsetX: 0, offsetY: 0, textAlign: 'center' },
              useCinematicRenderer: true,
              cinematicFonts: captionPreset.cinematicFonts,
              cinematicColors: captionPreset.cinematicColors,
              cinematicScales: captionPreset.cinematicScales,
            }}
            canvasWidth={canvas.width}
            canvasHeight={canvas.height}
          />
        );
      }
      return <CaptionItem data={item.data} captionStyle={captionPreset || {}} fps={fps} itemStartMs={item.startMs} />;
    }
    case 'broll':
      return <BrollItem data={item.data} assets={assets} />;
    case 'matte':
      return <MatteItem data={item.data} assets={assets} fps={fps} />;
    default:
      return null;
  }
});
