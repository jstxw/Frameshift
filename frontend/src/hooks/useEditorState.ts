"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Detection,
  type EditMode,
  type EditParams,
  type FrameData,
  generateFrames,
} from "@/lib/mock-data";
import type { ChatMessage } from "@/components/editor/AIChatPane";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PerFrameDetections {
  [frameKey: string]: { label: string; confidence: number; bbox: [number, number, number, number] }[];
}

interface EditorState {
  projectId: string | null;
  videoLoaded: boolean;
  videoName: string;
  duration: number;
  fps: number;
  frames: FrameData[];
  frameWidth: number;
  frameHeight: number;
  currentFrame: number;
  isPlaying: boolean;
  allDetections: PerFrameDetections;
  detections: Detection[];
  isDetecting: boolean;
  isSegmenting: boolean;
  maskCount: number;
  maskVersion: number;
  editVersion: number;
  selectedObjectId: string | null;
  editMode: EditMode | null;
  editParams: EditParams;
  isProcessing: boolean;
  applyToAllFrames: boolean;
  editRangeStart: number;
  editRangeEnd: number;
  zoom: number;
  showEditPanel: boolean;
  toastMessage: string;
  showToast: boolean;
  aiChatHistory: ChatMessage[];
  aiPreviewFrameUrl: string | null;
  aiGenerationId: string | null;
  isAIGenerating: boolean;
  aiEditStatus: "idle" | "preview" | "applying" | "done";
}

const DEFAULT_EDIT_PARAMS: EditParams = {
  recolor: { color: "#F43F5E", opacity: 0.6 },
  resize: { scale: 1.0 },
  replace: { imageUrl: null },
};

export function useEditorState(projectId?: string) {
  const [state, setState] = useState<EditorState>({
    projectId: projectId ?? null,
    videoLoaded: false,
    videoName: "",
    duration: 0,
    fps: 30,
    frames: [],
    frameWidth: 0,
    frameHeight: 0,
    currentFrame: 0,
    isPlaying: false,
    allDetections: {},
    detections: [],
    isDetecting: false,
    isSegmenting: false,
    maskCount: 0,
    maskVersion: 0,
    editVersion: 0,
    selectedObjectId: null,
    editMode: null,
    editParams: DEFAULT_EDIT_PARAMS,
    isProcessing: false,
    applyToAllFrames: true,
    editRangeStart: 0,
    editRangeEnd: 0,
    zoom: 100,
    showEditPanel: false,
    toastMessage: "",
    showToast: false,
    aiChatHistory: [],
    aiPreviewFrameUrl: null,
    aiGenerationId: null,
    isAIGenerating: false,
    aiEditStatus: "idle",
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll backend for project status when projectId is provided
  useEffect(() => {
    if (!projectId) return;

    const extractTriggered = { current: false };

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/project/${projectId}/status`);
        const status = await res.json();

        // Kick off extraction if project was just uploaded
        if ((status.status === "created" || status.status === "processing") && !extractTriggered.current) {
          extractTriggered.current = true;
          fetch(`${API_URL}/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: projectId }),
          });
        }

        if (status.status === "ready" || status.status === "extracting") {
          const frameCount = status.frame_count || 0;
          if (frameCount > 0) {
            setState((s) => ({
              ...s,
              projectId,
              videoLoaded: true,
              videoName: projectId,
              fps: 30,
              duration: frameCount / 30,
              frames: generateFrames(frameCount),
              frameWidth: status.frame_width || 0,
              frameHeight: status.frame_height || 0,
              editRangeEnd: s.editRangeEnd === 0 ? frameCount - 1 : s.editRangeEnd,
              isDetecting: !!status.detecting,
              isSegmenting: !!status.segmenting,
              maskCount: status.mask_count || 0,
            }));

            // Store all per-frame detections
            if (status.detections && Object.keys(status.detections).length > 0) {
              setState((s) => ({ ...s, allDetections: status.detections }));
            }

            // Update AI edit status
            if (status.ai_edit_status !== undefined) {
              setState((s) => ({
                ...s,
                aiEditStatus: status.ai_edit_status === "processing" ? "applying" : 
                             status.ai_edit_status === "done" ? "done" : 
                             status.ai_edit_status === "preview" ? "preview" : 
                             status.ai_edit_status === "error" ? "idle" : s.aiEditStatus,
                aiPreviewFrameUrl: status.ai_preview_url ? `${API_URL}${status.ai_preview_url}` : s.aiPreviewFrameUrl,
                aiGenerationId: status.ai_generation_id || s.aiGenerationId,
              }));
            }

            // Stop polling once ready, not detecting, and not segmenting
            if (status.status === "ready" && !status.detecting && !status.segmenting) {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          }
        }
      } catch {
        // Backend not reachable yet, keep polling
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 1500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [projectId]);

  // Update displayed detections when frame changes
  useEffect(() => {
    const frameKey = String(state.currentFrame + 1); // backend uses 1-based keys
    const frameDets = state.allDetections[frameKey] || [];
    const mapped: Detection[] = frameDets.map((d, i) => ({
      id: `obj-${i}`,
      label: d.label,
      confidence: d.confidence,
      bbox: d.bbox,
    }));
    setState((s) => ({ ...s, detections: mapped, selectedObjectId: null, showEditPanel: false }));
  }, [state.currentFrame, state.allDetections]);

  const loadVideo = useCallback(() => {
    // No-op when using real backend — video loads via polling
  }, []);

  const detectObjects = useCallback(() => {
    if (!state.projectId) return;
    setState((s) => ({ ...s, isDetecting: true }));
    // Detections are loaded via polling from the backend
    // They run automatically during /extract
  }, [state.projectId]);

  const segmentAtPoint = useCallback((clickX: number, clickY: number) => {
    setState((s) => {
      if (!s.projectId) return s;

      fetch(`${API_URL}/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: s.projectId,
          frame_index: s.currentFrame + 1,
          click_x: clickX,
          click_y: clickY,
        }),
      }).then(() => {
        // Clear any existing polling, then start fresh
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        const poll = async () => {
          try {
            const res = await fetch(`${API_URL}/project/${s.projectId}/status`);
            const status = await res.json();
            setState((prev) => ({
              ...prev,
              isSegmenting: !!status.segmenting,
              maskCount: status.mask_count || 0,
              maskVersion: prev.maskVersion + ((status.mask_count || 0) > 0 && !status.segmenting ? 1 : 0),
            }));
            if (!status.segmenting && status.segment_status === "done") {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          } catch { /* keep polling */ }
        };
        pollingRef.current = setInterval(poll, 1500);
      });

      return {
        ...s,
        isSegmenting: true,
        maskCount: 0,
        selectedObjectId: null,
        showEditPanel: false,
      };
    });
  }, []);

  const selectObject = useCallback((id: string | null) => {
    setState((s) => {
      // Trigger segmentation when selecting an object
      if (id !== null && s.projectId && s.frameWidth > 0) {
        const det = s.detections.find((d) => d.id === id);
        if (det) {
          const [xPct, yPct, wPct, hPct] = det.bbox;
          const clickX = Math.round(((xPct + wPct / 2) / 100) * s.frameWidth);
          const clickY = Math.round(((yPct + hPct / 2) / 100) * s.frameHeight);

          fetch(`${API_URL}/segment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_id: s.projectId,
              frame_index: s.currentFrame + 1,
              click_x: clickX,
              click_y: clickY,
            }),
          }).then(() => {
            // Clear any existing polling, then start fresh
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            const poll = async () => {
              try {
                const res = await fetch(`${API_URL}/project/${s.projectId}/status`);
                const status = await res.json();
                setState((prev) => ({
                  ...prev,
                  isSegmenting: !!status.segmenting,
                  maskCount: status.mask_count || 0,
                  maskVersion: prev.maskVersion + ((status.mask_count || 0) > 0 && !status.segmenting ? 1 : 0),
                }));
                if (!status.segmenting && status.segment_status === "done") {
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                }
              } catch { /* ignore */ }
            };
            pollingRef.current = setInterval(poll, 1500);
          });
        }
      }

      return {
        ...s,
        selectedObjectId: id,
        showEditPanel: id !== null,
        editMode: id !== null ? "recolor" : null,
        isSegmenting: id !== null,
        maskCount: 0,
      };
    });
  }, []);

  const setEditMode = useCallback((mode: EditMode) => {
    setState((s) => ({ ...s, editMode: mode }));
  }, []);

  const updateEditParams = useCallback(
    (mode: EditMode, params: Partial<EditParams[EditMode]>) => {
      setState((s) => ({
        ...s,
        editParams: {
          ...s.editParams,
          [mode]: { ...s.editParams[mode], ...params },
        },
      }));
    },
    []
  );

  const applyEdit = useCallback(() => {
    // Legacy — kept for interface compat
  }, []);

  const applyEditAction = useCallback(
    (action: string, params: { color?: string; prompt?: string; scale?: number }) => {
      setState((s) => {
        if (!s.projectId) return s;

        // Use edit range, falling back to full video if range hasn't been set
        const startFrame = s.editRangeStart + 1;  // 1-based for backend
        const endFrame = s.editRangeEnd > 0 ? s.editRangeEnd + 1 : s.frames.length;
        const editRule: Record<string, unknown> = {
          edit_type: action,
          start_frame: startFrame,
          end_frame: endFrame,
        };
        if (params.color) editRule.color = params.color;
        if (params.prompt) editRule.prompt = params.prompt;
        if (params.scale) editRule.scale = params.scale;

        fetch(`${API_URL}/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: s.projectId,
            edit_rules: [editRule],
          }),
        }).then(() => {
          // Clear any existing polling, then poll for edit completion
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          const pollEdit = async () => {
            try {
              const res = await fetch(`${API_URL}/project/${s.projectId}/status`);
              const status = await res.json();
              if (status.edit_status === "done" || status.edit_status === "error") {
                setState((prev) => ({
                  ...prev,
                  isProcessing: false,
                  editVersion: prev.editVersion + 1,
                  showToast: true,
                  toastMessage: status.edit_status === "done"
                    ? `${action} applied successfully`
                    : `Edit failed: ${status.edit_error || "unknown error"}`,
                }));
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
              }
            } catch { /* keep polling */ }
          };
          pollingRef.current = setInterval(pollEdit, 1500);
        });

        return { ...s, isProcessing: true, selectedObjectId: null, showEditPanel: false };
      });
    },
    []
  );

  const setCurrentFrame = useCallback((frame: number) => {
    setState((s) => {
      // Clear preview when changing frames (unless we're applying the edit)
      const shouldClearPreview = s.aiEditStatus === "preview" && s.currentFrame !== frame;
      return {
        ...s,
        currentFrame: frame,
        // Clear preview when navigating away
        aiPreviewFrameUrl: shouldClearPreview ? null : s.aiPreviewFrameUrl,
        aiEditStatus: shouldClearPreview ? "idle" : s.aiEditStatus,
      };
    });
  }, []);

  const togglePlay = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: !s.isPlaying }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState((s) => ({ ...s, zoom }));
  }, []);

  const setApplyToAllFrames = useCallback((value: boolean) => {
    setState((s) => ({ ...s, applyToAllFrames: value }));
  }, []);

  const setEditRange = useCallback((start: number, end: number) => {
    setState((s) => ({ ...s, editRangeStart: start, editRangeEnd: end }));
  }, []);

  const closeEditPanel = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedObjectId: null,
      showEditPanel: false,
      editMode: null,
    }));
  }, []);

  const setVideoName = useCallback((name: string) => {
    setState((s) => ({ ...s, videoName: name }));
  }, []);

  const hideToast = useCallback(() => {
    setState((s) => ({ ...s, showToast: false }));
  }, []);

  const sendAIPrompt = useCallback((prompt: string) => {
    setState((s) => {
      if (!s.projectId) return s;

      // Add user message to chat history
      const userMessage: ChatMessage = {
        role: "user",
        message: prompt,
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        aiChatHistory: [...prev.aiChatHistory, userMessage],
        isAIGenerating: true,
        aiEditStatus: "idle",
      }));

      // Call preview endpoint
      fetch(`${API_URL}/ai/edit/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: s.projectId,
          frame_index: s.currentFrame + 1,
          prompt: prompt,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(errorData.error || `HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.error) {
            throw new Error(data.error);
          }
          const previewUrl = `${API_URL}${data.preview_url}`;
          console.log("Preview URL:", previewUrl);
          const assistantMessage: ChatMessage = {
            role: "assistant",
            message: "Preview generated! Review it in the canvas.",
            timestamp: Date.now(),
          };
          setState((prev) => ({
            ...prev,
            aiChatHistory: [...prev.aiChatHistory, assistantMessage],
            aiPreviewFrameUrl: previewUrl,
            aiGenerationId: data.generation_id,
            isAIGenerating: false,
            aiEditStatus: "preview",
          }));
        })
        .catch((err) => {
          console.error("AI preview error:", err);
          setState((prev) => ({
            ...prev,
            isAIGenerating: false,
            aiEditStatus: "idle",
            showToast: true,
            toastMessage: `Failed to generate preview: ${err.message}`,
          }));
        });

      return s;
    });
  }, []);

  const acceptAIGeneration = useCallback(() => {
    setState((s) => {
      if (!s.projectId || !s.aiGenerationId) return s;

      const startFrame = s.editRangeStart > 0 ? s.editRangeStart + 1 : s.currentFrame + 1;
      const endFrame = s.editRangeEnd > 0 ? s.editRangeEnd + 1 : s.frames.length;
      const interval = 30; // Apply to every 30th frame

      fetch(`${API_URL}/ai/edit/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: s.projectId,
          generation_id: s.aiGenerationId,
          start_frame: startFrame,
          end_frame: endFrame,
          interval: interval,
        }),
      }).then(() => {
        setState((prev) => ({
          ...prev,
          aiEditStatus: "applying",
          aiPreviewFrameUrl: null, // Clear preview when starting to apply
        }));

        // Poll for completion
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        const pollAIEdit = async () => {
          try {
            const res = await fetch(`${API_URL}/project/${s.projectId}/status`);
            const status = await res.json();
            if (status.ai_edit_status === "done" || status.ai_edit_status === "error") {
              setState((prev) => ({
                ...prev,
                aiEditStatus: status.ai_edit_status === "done" ? "done" : "idle",
                aiPreviewFrameUrl: null, // Clear preview after applying
                aiGenerationId: null,
                editVersion: prev.editVersion + 1,
                showToast: true,
                toastMessage: status.ai_edit_status === "done"
                  ? "AI edit applied successfully"
                  : `AI edit failed: ${status.ai_edit_error || "unknown error"}`,
              }));
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          } catch { /* keep polling */ }
        };
        pollingRef.current = setInterval(pollAIEdit, 1500);
      });

      return { ...s, aiEditStatus: "applying" };
    });
  }, []);

  const rejectAIGeneration = useCallback(() => {
    setState((s) => {
      if (!s.projectId || !s.aiGenerationId) return s;

      fetch(`${API_URL}/ai/edit/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: s.projectId,
          generation_id: s.aiGenerationId,
        }),
      });

      return {
        ...s,
        aiPreviewFrameUrl: null,
        aiGenerationId: null,
        aiEditStatus: "idle",
      };
    });
  }, []);

  const retryAIGeneration = useCallback(() => {
    setState((s) => {
      if (!s.projectId || !s.aiGenerationId) return s;

      setState((prev) => ({
        ...prev,
        isAIGenerating: true,
      }));

      fetch(`${API_URL}/ai/edit/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: s.projectId,
          generation_id: s.aiGenerationId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            message: "Preview regenerated! Review it below.",
            timestamp: Date.now(),
          };
          setState((prev) => ({
            ...prev,
            aiChatHistory: [...prev.aiChatHistory, assistantMessage],
            aiPreviewFrameUrl: `${API_URL}${data.preview_url}`,
            aiGenerationId: data.generation_id,
            isAIGenerating: false,
            aiEditStatus: "preview",
          }));
        })
        .catch((err) => {
          console.error("AI retry error:", err);
          setState((prev) => ({
            ...prev,
            isAIGenerating: false,
            showToast: true,
            toastMessage: "Failed to retry generation",
          }));
        });

      return s;
    });
  }, []);

  const selectedObject = useMemo(
    () => state.detections.find((d) => d.id === state.selectedObjectId) ?? null,
    [state.detections, state.selectedObjectId]
  );

  return {
    ...state,
    selectedObject,
    loadVideo,
    detectObjects,
    segmentAtPoint,
    selectObject,
    setEditMode,
    updateEditParams,
    applyEdit,
    applyEditAction,
    setCurrentFrame,
    togglePlay,
    setZoom,
    setApplyToAllFrames,
    setEditRange,
    closeEditPanel,
    setVideoName,
    hideToast,
    sendAIPrompt,
    acceptAIGeneration,
    rejectAIGeneration,
    retryAIGeneration,
  };
}
