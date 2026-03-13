/**
 * Types for the edit-visuals processor.
 */

/**
 * Asset type for extracted components
 */
export interface ExtractedAsset {
  id: string;
  name: string;
  type: 'component' | 'element' | 'text' | 'shape' | 'icon' | 'background';
  sceneId: number;
  sceneName: string;
  description: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
}

export interface EditVisualsJobData {
  projectId: string;
  jobId: string;
  compositionId: string;
  prompt: string;
  sceneId?: number;       // Optional: target a specific scene (1-indexed)
  sceneIds?: number[];    // Optional: target multiple scenes (1-indexed). Takes priority over sceneId.
  elementName?: string;   // Optional: target a specific element within the scene
  transcript?: string;    // Full transcript text with timestamps for context
  scenePlan?: string;     // JSON scene plan so the agent understands the visual structure
}

export interface ClaudeEditorOptions {
  projectId: string;
  jobId: string;
  projectDir: string;
  prompt: string;
  existingFiles: string[];
  targetSceneId?: number;
  targetSceneIds?: number[];    // Multiple scenes to edit (takes priority over targetSceneId)
  targetElementName?: string;
  transcript?: string;          // Timestamped transcript of what the speaker says
  scenePlan?: string;           // JSON scene plan describing what each scene visualizes
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ClaudeEditorResult {
  filesEdited: number;
  durationMs: number;
}
