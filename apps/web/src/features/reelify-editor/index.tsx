"use client";

import { useEffect, useRef, useState } from "react";
import Timeline from "../editor/timeline";
import useStore from "../editor/store/use-store";
import useTimelineEvents from "../editor/hooks/use-timeline-events";
import { useStateManagerEvents } from "../editor/hooks/use-state-manager-events";
import Scene from "../editor/scene";
import { SceneRef } from "../editor/scene/scene.types";
import StateManager, { DESIGN_LOAD } from "@designcombo/state";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getCompactFontData, loadFonts } from "../editor/utils/fonts";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "../editor/constants/constants";
import MenuList from "../editor/menu-list";
import { MenuItem } from "../editor/menu-item";
import { ControlItem } from "../editor/control-item";
import CropModal from "../editor/crop-modal/crop-modal";
import useDataState from "../editor/store/use-data-state";
import { FONTS } from "../editor/data/fonts";
import FloatingControl from "../editor/control-item/floating-controls/floating-control";
import { useSceneStore } from "@/store/use-scene-store";
import { dispatch } from "@designcombo/events";
import MenuListHorizontal from "../editor/menu-list-horizontal";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { ITrackItem } from "@designcombo/types";
import useLayoutStore from "../editor/store/use-layout-store";
import ControlItemHorizontal from "../editor/control-item-horizontal";
import ReelifyNavbar from "./navbar";
import ExportModal from "./export-modal";
import { useReelifyStore } from "@/store/use-reelify-store";
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload, JobErrorPayload } from "@/lib/ws";

interface ReelifyEditorProps {
  projectId: string;
  initialData: any; // DesignCombo format data
}

const ReelifyEditor = ({ projectId, initialData }: ReelifyEditorProps) => {
  const [stateManager] = useState(
    () =>
      new StateManager({
        size: initialData.size || { width: 1080, height: 1920 },
      })
  );

  const { scene } = useSceneStore();
  const timelinePanelRef = useRef<ImperativePanelHandle>(null);
  const sceneRef = useRef<SceneRef>(null);
  const { timeline, playerRef } = useStore();
  const { activeIds, trackItemsMap, transitionsMap } = useStore();
  const [loaded, setLoaded] = useState(false);
  const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const {
    setTrackItem: setLayoutTrackItem,
    setFloatingControl,
    setLabelControlItem,
    setTypeControlItem,
  } = useLayoutStore();

  const isLargeScreen = useIsLargeScreen();
  const { setCompactFonts, setFonts } = useDataState();
  const { saveProject, startRender, isRendering, renderProgress, setRenderProgress, setRenderComplete, project } = useReelifyStore();

  // Load initial data - delay slightly to ensure StateManager subscriptions are ready
  useEffect(() => {
    if (initialData) {
      console.log('[ReelifyEditor] Loading design data:', {
        id: initialData.id,
        size: initialData.size,
        trackCount: initialData.tracks?.length,
        trackItemCount: initialData.trackItemIds?.length,
        tracks: initialData.tracks?.map((t: any) => ({ type: t.type, items: t.items?.length })),
      });
      // Small delay to ensure useStateManagerEvents has subscribed
      const timer = setTimeout(() => {
        dispatch(DESIGN_LOAD, { payload: initialData });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [initialData]);

  // Connect WebSocket for render progress
  useEffect(() => {
    wsClient.connect(projectId);

    const removeHandler = wsClient.addHandler((message: WSMessage) => {
      if (message.type === "job:progress") {
        const payload = message.payload as JobProgressPayload;
        setRenderProgress(payload.progress);
      } else if (message.type === "job:complete") {
        setRenderComplete();
      } else if (message.type === "job:error") {
        const payload = message.payload as JobErrorPayload;
        console.error("Render error:", payload.error);
        setRenderComplete();
      }
    });

    return () => {
      removeHandler();
      wsClient.disconnect();
    };
  }, [projectId, setRenderProgress, setRenderComplete]);

  useTimelineEvents();

  // Connect StateManager to zustand store - MUST be called before DESIGN_LOAD
  useStateManagerEvents(stateManager);

  useEffect(() => {
    setCompactFonts(getCompactFontData(FONTS));
    setFonts(FONTS);
  }, [setCompactFonts, setFonts]);

  useEffect(() => {
    loadFonts([
      {
        name: SECONDARY_FONT,
        url: SECONDARY_FONT_URL,
      },
    ]);
  }, []);

  useEffect(() => {
    const screenHeight = window.innerHeight;
    const desiredHeight = 300;
    const percentage = (desiredHeight / screenHeight) * 100;
    timelinePanelRef.current?.resize(percentage);
  }, []);

  const handleTimelineResize = () => {
    const timelineContainer = document.getElementById("timeline-container");
    if (!timelineContainer) return;

    timeline?.resize(
      {
        height: timelineContainer.clientHeight - 90,
        width: timelineContainer.clientWidth - 40,
      },
      {
        force: true,
      }
    );

    setTimeout(() => {
      sceneRef.current?.recalculateZoom();
    }, 100);
  };

  useEffect(() => {
    const onResize = () => handleTimelineResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [timeline]);

  useEffect(() => {
    if (activeIds.length === 1) {
      const [id] = activeIds;
      const trackItem = trackItemsMap[id];
      if (trackItem) {
        setTrackItem(trackItem);
        setLayoutTrackItem(trackItem);
      } else console.log(transitionsMap[id]);
    } else {
      setTrackItem(null);
      setLayoutTrackItem(null);
    }
  }, [activeIds, trackItemsMap, transitionsMap, setLayoutTrackItem]);

  useEffect(() => {
    setFloatingControl("");
    setLabelControlItem("");
    setTypeControlItem("");
  }, [isLargeScreen, setFloatingControl, setLabelControlItem, setTypeControlItem]);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const handleSave = async () => {
    await saveProject();
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleStartExport = async () => {
    await startRender();
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <ReelifyNavbar
        projectName={project?.id ? `Project ${project.id.slice(0, 8)}` : "Untitled"}
        onSave={handleSave}
        onExport={handleExport}
      />

      <div className="flex flex-1">
        {isLargeScreen && (
          <div className="bg-muted flex flex-none border-r border-border/80 h-[calc(100vh-56px)]">
            <MenuList />
            <MenuItem />
          </div>
        )}

        <ResizablePanelGroup style={{ flex: 1 }} direction="vertical">
          <ResizablePanel className="relative" defaultSize={70}>
            <FloatingControl />
            <div className="flex h-full flex-1">
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <CropModal />
                <Scene ref={sceneRef} stateManager={stateManager} />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel
            className="min-h-[50px]"
            ref={timelinePanelRef}
            defaultSize={30}
            onResize={handleTimelineResize}
          >
            {playerRef && <Timeline stateManager={stateManager} />}
          </ResizablePanel>

          {!isLargeScreen && !trackItem && loaded && <MenuListHorizontal />}
          {!isLargeScreen && trackItem && <ControlItemHorizontal />}
        </ResizablePanelGroup>

        <ControlItem />
      </div>

      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        onExport={handleStartExport}
        isRendering={isRendering}
        progress={renderProgress}
        projectId={projectId}
      />
    </div>
  );
};

export default ReelifyEditor;
