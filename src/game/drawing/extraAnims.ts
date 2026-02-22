/**
 * Dibujado de animaciones de sprites que no son personajes de pelea:
 * créditos, público, cinemáticas, etc.
 */

/**
 * Dibuja un frame de una animación extra con opcional alpha (fade in/out).
 */
export function drawExtraAnimFrame(
  ctx: CanvasRenderingContext2D,
  frames: HTMLImageElement[],
  frameIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number = 1,
): void {
  if (!frames.length) return;
  const idx = Math.max(0, Math.min(frameIndex, frames.length - 1));
  const img = frames[idx];
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save();
  if (alpha < 1) {
    ctx.globalAlpha = alpha;
  }
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();
}
