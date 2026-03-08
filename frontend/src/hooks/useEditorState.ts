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
  transformedFrameVersions?: { [frameIndex: number]: number }; // Per-frame versioning for changed frames
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
  storageBaseUrl: string | null;
}

const DEFAULT_EDIT_PARAMS: EditParams = {
  recolor: { color: "#F43F5E", opacity: 0.6 },
  resize: { scale: 1.0 },
  replace: { imageUrl: null },
};

export function useEditorState(projectId?: string, initialFrame = 0) {
  const [state, setState] = useState<EditorState>({
    projectId: projectId ?? null,
    videoLoaded: false,
    videoName: "",
    duration: 0,
    fps: 30,
    frames: [],
    frameWidth: 0,
    frameHeight: 0,
    currentFrame: initialFrame,
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
    storageBaseUrl: null,
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acceptInProgressRef = useRef<boolean>(false);

  // Unified polling for project status - single interval, handles all status updates
  useEffect(() => {
    if (!projectId) return;

    const extractTriggered = { current: false };
    let lastAIProgressDone = 0;
    const startTime = Date.now();
    const MAX_POLL_TIME = 300000; // 5 minutes max polling time

    const poll = async () => {
      try {
        // Stop polling if we've been polling too long
        if (Date.now() - startTime > MAX_POLL_TIME) {
          console.warn("Polling timeout - stopping status checks");
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setState((s) => ({
            ...s,
            showToast: true,
            toastMessage: "Video processing timed out. Please check your FFmpeg installation.",
          }));
          return;
        }

        const res = await fetch(`${API_URL}/project/${projectId}/status`);
        const status = await res.json();

        // Stop polling if there's an error
        if (status.status === "error") {
          console.error("Extraction error:", status.error);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setState((s) => ({
            ...s,
            showToast: true,
            toastMessage: `Extraction failed: ${status.error || "Unknown error"}`,
          }));
          return;
        }

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
              storageBaseUrl: status.storage_base_url || s.storageBaseUrl,
            }));

            // Store all per-frame detections
            if (status.detections && Object.keys(status.detections).length > 0) {
              setState((s) => ({ ...s, allDetections: status.detections }));
            }

            // Update AI edit status and progress
            if (status.ai_edit_status !== undefined) {
              const aiProgress = status.ai_edit_progress || { done: 0, total: 0 };
              const isDone = status.ai_edit_status === "done" || status.ai_edit_status === "error";
              const transformedFrames = status.ai_edit_transformed_frames || [];
              
              // Track transformed frames for per-frame versioning
              // This allows us to only refresh frames that were actually changed
              if (isDone && transformedFrames.length > 0) {
                lastAIProgressDone = aiProgress.total; // Mark as processed
                setState((s) => ({
                  ...s,
                  transformedFrameVersions: {
                    ...(s.transformedFrameVersions || {}),
                    ...Object.fromEntries(transformedFrames.map((f: number) => [f, (s.transformedFrameVersions?.[f] || 0) + 1]))
                  }
                }));
              }
              
              setState((s) => ({
                ...s,
                aiEditStatus: status.ai_edit_status === "processing" ? "applying" : 
                             status.ai_edit_status === "done" ? "done" : 
                             status.ai_edit_status === "preview" ? "preview" : 
                             status.ai_edit_status === "error" ? "idle" : s.aiEditStatus,
                aiPreviewFrameUrl: isDone ? null : (status.ai_preview_url ? `${API_URL}${status.ai_preview_url}` : s.aiPreviewFrameUrl),
                aiGenerationId: isDone ? null : (status.ai_generation_id || s.aiGenerationId),
                showToast: isDone ? true : s.showToast,
                toastMessage: isDone ? (status.ai_edit_status === "done"
                  ? "AI edit applied successfully"
                  : `AI edit failed: ${status.ai_edit_error || "unknown error"}`) : s.toastMessage,
              }));

              if (isDone) {
                acceptInProgressRef.current = false;
              }
            }

            // Continue polling if AI edit is processing, otherwise stop when ready
            const shouldStopPolling = status.status === "ready" && 
                                     !status.detecting && 
                                     !status.segmenting && 
                                     status.ai_edit_status !== "processing" &&
                                     status.ai_edit_status !== "applying";
            
            if (shouldStopPolling) {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            } else if (!pollingRef.current) {
              // Restart polling if it was stopped but we need it again
              pollingRef.current = setInterval(poll, 2000);
            }
          }
        }
      } catch {
        // Backend not reachable yet, keep polling
      }
    };

    // Clear any existing polling first
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    poll();
    // Use longer interval - 2000ms instead of 1500ms, and only poll when needed
    pollingRef.current = setInterval(poll, 2000);

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

      // Segmentation disabled - no-op
      // fetch(`${API_URL}/segment`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     project_id: s.projectId,
      //     frame_index: s.currentFrame + 1,
      //     click_x: clickX,
      //     click_y: clickY,
      //   }),
      // });

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

          // Segmentation disabled - no-op
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
        });
        // Status polling will handle edit completion via unified poll

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
    // Use ref to prevent duplicate calls (faster than state check)
    if (acceptInProgressRef.current) {
      console.log("Accept already in progress (ref check), ignoring duplicate call");
      return;
    }

    setState((s) => {
      if (!s.projectId || !s.aiGenerationId) {
        console.log("Cannot accept: missing projectId or generationId");
        return s;
      }
      // Prevent multiple calls - if already applying, ignore
      if (s.aiEditStatus === "applying") {
        console.log("Already applying, ignoring duplicate accept call");
        return s;
      }

      // Set ref immediately to prevent race conditions
      acceptInProgressRef.current = true;

      const startFrame = s.editRangeStart > 0 ? s.editRangeStart + 1 : s.currentFrame + 1;
      const endFrame = s.editRangeEnd > 0 ? s.editRangeEnd + 1 : s.frames.length;
      const interval = 60; // Transform every 60th frame from start to end

      const generationId = s.aiGenerationId; // Save before clearing

      // Set status immediately to prevent duplicate calls and clear generation ID
      setState((prev) => ({
        ...prev,
        aiEditStatus: "applying",
        aiPreviewFrameUrl: null, // Clear preview when starting to apply
        aiGenerationId: null, // Clear generation ID to prevent duplicate calls
      }));

      console.log("Calling accept with generation_id:", generationId);
      fetch(`${API_URL}/ai/edit/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: s.projectId,
          generation_id: generationId, // Use saved generation ID
          start_frame: startFrame,
          end_frame: endFrame,
          interval: interval,
        }),
      }).then((res) => {
        if (!res.ok) {
          const errorData = res.json().catch(() => ({}));
          throw new Error(`Accept failed: ${res.status}`);
        }
        return res.json();
      }).then((data) => {
        if (data.error) {
          console.error("Accept error from backend:", data.error);
          setState((prev) => ({
            ...prev,
            aiEditStatus: "idle",
            showToast: true,
            toastMessage: data.error,
          }));
          return;
        }
        console.log("Accept started successfully");
        // Unified polling will handle status updates - no need for separate polling
      }).catch((err) => {
        acceptInProgressRef.current = false; // Reset ref on error
        console.error("Accept error:", err);
        setState((prev) => ({
          ...prev,
          aiEditStatus: "idle",
          showToast: true,
          toastMessage: `Failed to accept: ${err.message}`,
        }));
      });

      return s;
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
