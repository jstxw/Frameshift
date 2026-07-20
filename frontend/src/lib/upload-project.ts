import { validateVideoUpload } from "@/lib/video-upload";

const LONG_UPLOAD_DELAY_MS = 8_000;
const LONG_UPLOAD_MESSAGE =
  "Sorry this is taking longer than usual. Please be patient while we prepare your video.";

type UploadResult = {
  project_id: string;
  storage_path: string;
  compute_available: boolean;
  compute_error?: string | null;
};

export async function uploadProjectVideo(
  file: File,
  onStatus?: (status: string) => void,
): Promise<UploadResult> {
  let latestStatus = "Checking video length...";
  let isTakingLonger = false;
  const reportStatus = (status: string) => {
    latestStatus = status;
    onStatus?.(
      isTakingLonger ? `${status} ${LONG_UPLOAD_MESSAGE}` : status,
    );
  };
  const longUploadTimer = setTimeout(() => {
    isTakingLonger = true;
    reportStatus(latestStatus);
  }, LONG_UPLOAD_DELAY_MS);

  try {
    reportStatus(latestStatus);
    await validateVideoUpload(file);

    reportStatus("Preparing secure storage...");
    const intentResponse = await fetch("/api/uploads/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: file.name,
        content_type: file.type,
        size: file.size,
      }),
    });
    const intent = await intentResponse.json();
    if (!intentResponse.ok) {
      throw new Error(intent.error || "Could not prepare video storage");
    }

    reportStatus("Saving video to your project...");
    const directBody = new FormData();
    directBody.append("cacheControl", "3600");
    directBody.append("", file);

    let directUpload: Response | null = null;
    try {
      directUpload = await fetch(intent.signed_url, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body: directBody,
      });
    } catch {
      // The same-origin fallback below handles restrictive browser/network setups.
    }

    if (!directUpload?.ok) {
      const fallback = await fetch(`/api/uploads/${intent.project_id}/content`, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!fallback.ok) {
        const failure = await fallback.json().catch(() => ({}));
        throw new Error(failure.error || "Video storage upload failed");
      }
    }

    reportStatus("Opening the editor...");
    const completeResponse = await fetch(`/api/uploads/${intent.project_id}/complete`, {
      method: "POST",
    });
    const complete = await completeResponse.json();
    if (!completeResponse.ok) {
      throw new Error(complete.error || "Video was saved, but project setup failed");
    }

    return {
      project_id: intent.project_id,
      storage_path: intent.storage_path,
      compute_available: Boolean(complete.compute_available),
      compute_error: complete.compute_error,
    };
  } finally {
    clearTimeout(longUploadTimer);
  }
}
