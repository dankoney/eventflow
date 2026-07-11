/** Client-side brand logo URL (matches server email resolution + relative /uploads paths). */
export function resolveClientBrandLogoUrl(
  serverLogoUrl: string | null | undefined,
  sources?: {
    eventBrandLogoUrl?: string | null;
    orgLogoUrl?: string | null;
    orgDefaultBrandLogoUrl?: string | null;
  }
): string | null {
  if (serverLogoUrl?.trim()) return serverLogoUrl.trim();

  if (typeof window === "undefined") return null;

  const origin = window.location.origin.replace(/\/$/, "");
  for (const raw of [
    sources?.eventBrandLogoUrl,
    sources?.orgLogoUrl,
    sources?.orgDefaultBrandLogoUrl
  ]) {
    const t = raw?.trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) return t;
    if (t.startsWith("/")) return `${origin}${t}`;
    return `${origin}/${t}`;
  }

  return null;
}

/** Data URL for html2canvas — preserves original bytes when possible. */
export async function embedLogoAsDataUrl(logoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(logoUrl, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const loads = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });

    if (loads) return dataUrl;
  } catch {
    // fall through
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}
