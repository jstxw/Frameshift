"use client";

import { useCallback, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import type { Detection, EditMode, EditParams } from "@/lib/mock-data";
import { BoundingBox } from "./BoundingBox";
import type { EditAction } from "./EditToolbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EditorCanvasProps {
  projectId: string | null;
  videoLoaded: boolean;
  detections: Detection[];
  isDetecting: boolean;
  isSegmenting: boolean;
  maskCount: number;
  maskVersion: number;
  selectedObjectId: string | null;
  editMode: EditMode | null;
  editParams: EditParams;
  isProcessing: boolean;
  zoom: number;
  currentFrame: number;
  totalFrames: number;
  frameWidth: number;
  frameHeight: number;
  onSelectObject: (id: string | null) => void;
  onUpload: () => void;
  onApplyEdit: (action: EditAction, params: { color?: string; prompt?: string; scale?: number }) => void;
  onSegmentAtPoint: (clickX: number, clickY: number) => void;
}

export function EditorCanvas({
  projectId,
  videoLoaded,
  detections,
  isDetecting,
  isSegmenting,
  maskCount,
  maskVersion,
  selectedObjectId,
  editMode,
  editParams,
  isProcessing,
  zoom,
  currentFrame,
  totalFrames,
  frameWidth,
  frameHeight,
  onSelectObject,
  onUpload,
  onApplyEdit,
  onSegmentAtPoint,
}: EditorCanvasProps) {
  const [segmentMode, setSegmentMode] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!segmentMode || !imgRef.current || !frameWidth || !frameHeight) {
        onSelectObject(null);
        return;
      }
      e.stopPropagation();
      const rect = imgRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const clickX = Math.round(relX * frameWidth);
      const clickY = Math.round(relY * frameHeight);
      onSegmentAtPoint(clickX, clickY);
      setSegmentMode(false);
    },
    [segmentMode, frameWidth, frameHeight, onSelectObject, onSegmentAtPoint]
  );

  if (!videoLoaded) {
    return <EmptyCanvas onUpload={onUpload} />;
  }

  // frame_index is 1-based in the backend
  const frameUrl = projectId
    ? `${API_URL}/frame/${projectId}/${currentFrame + 1}`
    : null;

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden relative">
      {/* Segment button — top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSegmentMode(!segmentMode);
        }}
        className={`absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
          segmentMode
            ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25"
            : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white"
        }`}
      >
        <Crosshair className="w-4 h-4" />
        {segmentMode ? "Click to segment" : "Segment"}
      </button>

      <div
        className="relative"
        style={{ transform: `scale(${zoom / 100})`, transition: "transform 200ms ease" }}
      >
        <div
          ref={imgRef}
          className={`w-[768px] h-[432px] rounded-xl overflow-hidden relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] shadow-2xl ${
            segmentMode ? "cursor-crosshair" : ""
          }`}
          onClick={handleCanvasClick}
        >
          {frameUrl ? (
            <img
              src={frameUrl}
              alt={`Frame ${currentFrame + 1}`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white/20 text-sm">Frame Preview</div>
            </div>
          )}

          {/* Segment mode border glow */}
          {segmentMode && (
            <div className="absolute inset-0 rounded-xl border-2 border-[var(--accent)] pointer-events-none z-20 animate-pulse-border" />
          )}


          {isProcessing && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm font-medium">Applying edit...</span>
              </div>
            </div>
          )}

          {/* SAM 2 mask overlay */}
          {projectId && maskCount > 0 && !isSegmenting && (
            <img
              src={`${API_URL}/mask/${projectId}/${currentFrame + 1}?v=${maskVersion}`}
              alt="Segmentation mask"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1] mix-blend-screen opacity-40"
              style={{ filter: "hue-rotate(-30deg) saturate(3)" }}
            />
          )}

          {/* Segmenting spinner */}
          {isSegmenting && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex flex-col items-center gap-2 bg-black/60 px-4 py-3 rounded-xl">
                <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-white/80 text-xs font-medium">Segmenting...</span>
              </div>
            </div>
          )}

          {!segmentMode && detections.map((det) => (
            <BoundingBox
              key={det.id}
              detection={det}
              isSelected={selectedObjectId === det.id}
              onClick={() => onSelectObject(det.id)}
            />
          ))}
        </div>

      </div>
    </div>
  );
}

function EmptyCanvas({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <div
        className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed border-[var(--border-dark)] hover:border-[var(--accent)]/50 transition-all cursor-pointer group"
        onClick={onUpload}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent)]/10 transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 group-hover:text-[var(--accent)] transition-colors">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white/60 text-sm font-medium">Upload a video to start editing</p>
          <p className="text-white/30 text-xs mt-1">Drag and drop or click to browse</p>
        </div>
      </div>
    </div>
  );
}

