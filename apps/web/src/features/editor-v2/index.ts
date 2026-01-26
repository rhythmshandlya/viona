/**
 * Editor V2 - Custom Video Editor
 * Replaces DesignCombo with Zustand-only state management
 */

export { Editor } from './Editor';
export { useEditorStore, useEditorActions } from './store/use-editor-store';
export type { EditorStore, EditorState, EditorActions } from './store/types';
