'use client';

import React from 'react';
import { useSingleSelectedItem } from '../../store/use-editor-store';
import { InspectorSection } from './InspectorSection';
import { TransformSection } from './sections/TransformSection';
import { FiltersSection } from './sections/FiltersSection';
import { TextSection } from './sections/TextSection';
import { FontSection } from './sections/FontSection';
import { ColorSection } from './sections/ColorSection';
import { AnimationSection } from './sections/AnimationSection';
import { EffectsSection } from './sections/EffectsSection';
import { AdjustSection } from './sections/AdjustSection';
import { CropSection } from './sections/CropSection';
import { ShapeSection } from './sections/ShapeSection';
import { SegmentationStatus } from '../SegmentationStatus';
import type { VideoItemData } from '../../store/types';

export function ItemInspector() {
  const item = useSingleSelectedItem();

  if (!item) return null;

  const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--editor-border-subtle)] flex-shrink-0">
        <span className="text-xs font-normal text-[var(--editor-text-primary)]">
          {typeLabel}
        </span>
        <span className="text-xs text-[var(--editor-text-muted)] ml-1.5">
          {item.id.length > 8 ? item.id.slice(0, 8) + '\u2026' : item.id}
        </span>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto">
        {renderSections(item)}
      </div>
    </div>
  );
}

function renderSections(item: NonNullable<ReturnType<typeof useSingleSelectedItem>>) {
  switch (item.type) {
    case 'text':
      return (
        <>
          <InspectorSection label="Text">
            <TextSection item={item} />
          </InspectorSection>
          <InspectorSection label="Font">
            <FontSection item={item} />
          </InspectorSection>
          <InspectorSection label="Color">
            <ColorSection item={item} />
          </InspectorSection>
          <InspectorSection label="Transform">
            <TransformSection item={item} />
          </InspectorSection>
          <InspectorSection label="Animation" defaultOpen={false}>
            <AnimationSection item={item} />
          </InspectorSection>
          <InspectorSection label="Effects" defaultOpen={false}>
            <EffectsSection item={item} />
          </InspectorSection>
          <InspectorSection label="Filters" defaultOpen={false}>
            <FiltersSection item={item} />
          </InspectorSection>
        </>
      );

    case 'caption':
      return (
        <>
          <InspectorSection label="Text">
            <TextSection item={item} />
          </InspectorSection>
          <InspectorSection label="Font">
            <FontSection item={item} />
          </InspectorSection>
          <InspectorSection label="Color">
            <ColorSection item={item} />
          </InspectorSection>
          <InspectorSection label="Transform">
            <TransformSection item={item} />
          </InspectorSection>
          <InspectorSection label="Animation" defaultOpen={false}>
            <AnimationSection item={item} />
          </InspectorSection>
          <InspectorSection label="Effects" defaultOpen={false}>
            <EffectsSection item={item} />
          </InspectorSection>
        </>
      );

    case 'video':
      return (
        <>
          <InspectorSection label="Transform">
            <TransformSection item={item} />
          </InspectorSection>
          <InspectorSection label="Adjust">
            <AdjustSection item={item} />
          </InspectorSection>
          <InspectorSection label="Crop">
            <CropSection item={item} />
          </InspectorSection>
          <InspectorSection label="Filters" defaultOpen={false}>
            <FiltersSection item={item} />
          </InspectorSection>
          {(item.data as VideoItemData).segmentation && (
            <InspectorSection label="Speaker Extraction">
              <SegmentationStatus segmentation={(item.data as VideoItemData).segmentation} />
            </InspectorSection>
          )}
        </>
      );

    case 'image':
      return (
        <>
          <InspectorSection label="Transform">
            <TransformSection item={item} />
          </InspectorSection>
          <InspectorSection label="Filters" defaultOpen={false}>
            <FiltersSection item={item} />
          </InspectorSection>
        </>
      );

    case 'audio':
      return (
        <InspectorSection label="Adjust">
          <AdjustSection item={item} />
        </InspectorSection>
      );

    case 'shape':
      return (
        <>
          <InspectorSection label="Shape">
            <ShapeSection item={item} />
          </InspectorSection>
          <InspectorSection label="Transform">
            <TransformSection item={item} />
          </InspectorSection>
          <InspectorSection label="Filters" defaultOpen={false}>
            <FiltersSection item={item} />
          </InspectorSection>
        </>
      );

    default:
      return (
        <div className="p-3">
          <p className="text-xs text-[var(--editor-text-muted)]">
            No editable properties for this item type.
          </p>
        </div>
      );
  }
}
