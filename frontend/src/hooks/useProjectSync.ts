"use client";

import { useEffect, useRef } from "react";

/**
 * Debounces the current frame position to Supabase every 5 seconds.
 * Also syncs status and thumbnail when the project transitions to ready.
 */
export function useProjectSync({
  projectId,
  currentFrame,
  videoLoaded,
  status,
  thumbnailUrl,
}: {
  projectId: string;
  currentFrame: number;
  videoLoaded: boolean;
  status: string;
  thumbnailUrl?: string | null;
}) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedFrame = useRef<number>(-1);
  const lastSyncedStatus = useRef<string>("");
  const thumbnailSynced = useRef(false);

  // Debounced frame position sync
  useEffect(() => {
    if (!projectId || !videoLoaded) return;
    if (currentFrame === lastSyncedFrame.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSyncedFrame.current = currentFrame;
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_frame: currentFrame }),
      }).catch(() => {});
    }, 5000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentFrame, projectId, videoLoaded]);

  // Sync status changes to Supabase
  useEffect(() => {
    if (!projectId || !status) return;
    if (status === lastSyncedStatus.current) return;
    lastSyncedStatus.current = status;

    fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }, [status, projectId]);

  // Sync thumbnail once when video becomes ready
  useEffect(() => {
    if (!projectId || !thumbnailUrl || thumbnailSynced.current) return;
    thumbnailSynced.current = true;

    fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
    }).catch(() => {});
  }, [thumbnailUrl, projectId]);
}
