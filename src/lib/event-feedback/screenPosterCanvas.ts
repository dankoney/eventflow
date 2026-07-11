export const SCREEN_POSTER_WIDTH = 1200;
export const SCREEN_POSTER_HEIGHT = 675;

export const SCREEN_POSTER_LAYOUT = {
  padX: 48,
  headerTop: 40,
  logoMaxW: 280,
  logoMaxH: 80,
  logoGap: 16,
  orgSize: 14,
  orgGap: 8,
  titleSize: 36,
  titleGap: 4,
  dateSize: 18,
  qrGap: 28,
  qrSize: 220,
  qrPad: 12,
  qrRadius: 24,
  footerBottom: 40,
  ctaSize: 30,
  ctaGap: 8,
  bodySize: 14,
  linkGap: 16,
  linkPadX: 16,
  linkPadY: 12,
  linkRadius: 12,
  linkLabelSize: 10,
  linkUrlSize: 14,
  linkCodeSize: 10
} as const;

export type ScreenPosterInput = {
  eventName: string;
  orgName: string;
  eventDateLabel: string;
  portalUrl: string;
  shortCode: string;
  qrDataUrl: string;
  accentColor: string;
  logoSrc?: string | null;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitImage(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  const fit = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return { w: naturalW * fit, h: naturalH * fit };
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = words[0] ?? "";

  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = words[i] ?? "";
    }
  }
  lines.push(line);
  return lines;
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number
): number {
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  }
  return y;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Pixel-perfect screen poster export (avoids html2canvas flex/layout bugs). */
export async function renderScreenPosterCanvas(
  input: ScreenPosterInput,
  scale = 2
): Promise<HTMLCanvasElement> {
  const L = SCREEN_POSTER_LAYOUT;
  const w = SCREEN_POSTER_WIDTH * scale;
  const h = SCREEN_POSTER_HEIGHT * scale;
  const s = scale;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, input.accentColor);
  grad.addColorStop(0.38, "#a855f7");
  grad.addColorStop(0.72, "#ec4899");
  grad.addColorStop(1, "#f97316");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.2, h * 0.2, 0, w * 0.2, h * 0.2, w * 0.45);
  glow.addColorStop(0, "rgba(255,255,255,0.3)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(w * 0.8, h * 0.8, 0, w * 0.8, h * 0.8, w * 0.4);
  glow2.addColorStop(0, "rgba(255,255,255,0.3)");
  glow2.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const contentW = w - L.padX * 2 * s;
  let y = L.headerTop * s;

  if (input.logoSrc) {
    const logo = await loadImage(input.logoSrc);
    if (logo) {
      const naturalW = logo.naturalWidth || logo.width;
      const naturalH = logo.naturalHeight || logo.height;
      const { w: lw, h: lh } = fitImage(naturalW, naturalH, L.logoMaxW * s, L.logoMaxH * s);
      ctx.drawImage(logo, centerX - lw / 2, y, lw, lh);
      y += lh + L.logoGap * s;
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `700 ${L.orgSize * s}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const orgLines = wrapText(ctx, input.orgName.toUpperCase(), contentW);
  y = drawCenteredLines(ctx, orgLines, centerX, y, (L.orgSize + 4) * s);
  y += L.orgGap * s;

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${L.titleSize * s}px system-ui, -apple-system, sans-serif`;
  const titleLines = wrapText(ctx, input.eventName, contentW);
  y = drawCenteredLines(ctx, titleLines, centerX, y, (L.titleSize + 6) * s);
  y += L.titleGap * s;

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `400 ${L.dateSize * s}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(input.eventDateLabel, centerX, y);
  y += L.dateSize * s + L.qrGap * s;

  const qrBox = L.qrSize * s + L.qrPad * 2 * s;
  const qrX = centerX - qrBox / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 24 * s;
  ctx.shadowOffsetY = 8 * s;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrX, y, qrBox, qrBox, L.qrRadius * s);
  ctx.fill();
  ctx.restore();

  const qr = await loadImage(input.qrDataUrl);
  if (qr) {
    const qrInset = L.qrPad * s;
    ctx.drawImage(qr, qrX + qrInset, y + qrInset, L.qrSize * s, L.qrSize * s);
  }
  y += qrBox + L.qrGap * s;

  const footerMaxW = Math.min(contentW, 576 * s);
  const footerX = centerX - footerMaxW / 2;

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${L.ctaSize * s}px system-ui, -apple-system, sans-serif`;
  ctx.fillText("Share your feedback", centerX, y);
  y += L.ctaSize * s + L.ctaGap * s;

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `400 ${L.bodySize * s}px system-ui, -apple-system, sans-serif`;
  const body =
    "Scan with your phone camera. Fill the form, then choose anonymous or link to your registration.";
  const bodyLines = wrapText(ctx, body, footerMaxW);
  y = drawCenteredLines(ctx, bodyLines, centerX, y, (L.bodySize + 6) * s);
  y += L.linkGap * s;

  const linkBoxH = (L.linkLabelSize + L.linkUrlSize + L.linkCodeSize + 20) * s;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(ctx, footerX, y, footerMaxW, linkBoxH, L.linkRadius * s);
  ctx.fill();

  let linkY = y + L.linkPadY * s;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `600 ${L.linkLabelSize * s}px system-ui, -apple-system, sans-serif`;
  ctx.fillText("SHORT LINK", centerX, linkY);
  linkY += (L.linkLabelSize + 6) * s;

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${L.linkUrlSize * s}px ui-monospace, monospace`;
  const urlLines = wrapText(ctx, input.portalUrl, footerMaxW - L.linkPadX * 2 * s);
  linkY = drawCenteredLines(ctx, urlLines, centerX, linkY, (L.linkUrlSize + 4) * s);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `400 ${L.linkCodeSize * s}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(`Code: ${input.shortCode}`, centerX, linkY);

  return canvas;
}
