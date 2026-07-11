import type { MediaAssetListItem } from "@/lib/media/types";

type UploadResult =
  | { success: true; data: MediaAssetListItem }
  | { success: false; error: string };

type UploadProgress = {
  fileName: string;
  percent: number;
};

function parseUploadResponse(status: number, text: string): UploadResult {
  try {
    const parsed = JSON.parse(text) as UploadResult;
    if (status >= 200 && status < 300 && parsed.success) {
      return parsed;
    }
    return {
      success: false,
      error: parsed.success === false ? parsed.error : `Upload failed (${status}).`
    };
  } catch {
    return { success: false, error: "Upload failed. Please try again." };
  }
}

async function uploadViaFetch(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.set("file", file);
  try {
    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: fd,
      credentials: "include"
    });
    const text = await res.text();
    return parseUploadResponse(res.status, text);
  } catch {
    return { success: false, error: "Network error while uploading." };
  }
}

function uploadViaXhr(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.set("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        onProgress?.({ fileName: file.name, percent: 0 });
        return;
      }
      onProgress?.({
        fileName: file.name,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100))
      });
    });

    xhr.addEventListener("load", () => {
      resolve(parseUploadResponse(xhr.status, xhr.responseText));
    });

    xhr.addEventListener("error", () => {
      resolve({ success: false, error: "Network error while uploading." });
    });

    xhr.addEventListener("abort", () => {
      resolve({ success: false, error: "Upload cancelled." });
    });

    xhr.open("POST", "/api/media/upload");
    xhr.withCredentials = true;
    xhr.send(fd);
  });
}

/**
 * Upload via API route — XHR for progress, fetch fallback if XHR returns empty.
 */
export async function uploadMediaAssetClient(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  onProgress?.({ fileName: file.name, percent: 0 });

  const xhrResult = await uploadViaXhr(file, onProgress);
  if (xhrResult.success) return xhrResult;

  if (xhrResult.error === "Network error while uploading.") {
    onProgress?.({ fileName: file.name, percent: 50 });
    const fetchResult = await uploadViaFetch(file);
    onProgress?.({ fileName: file.name, percent: 100 });
    return fetchResult;
  }

  return xhrResult;
}
