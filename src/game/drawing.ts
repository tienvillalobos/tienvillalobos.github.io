/**
 * Funciones de dibujado: luchadores, barras de vida/stamina.
 */

import { GROUND_Y } from './constants';
import type { Fighter } from './types';

export type CharAnims = Record<string, { idle: HTMLImageElement[]; walk: HTMLImageElement[]; attack: HTMLImageElement[] }>;

export function isValidImg(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!(img && img.complete && img.naturalWidth > 0);
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  anims: CharAnims,
  getCharKey: (charId: number) => string,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(f.x + f.width / 2, f.y + f.height - 5, f.width / 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const charKey = getCharKey(f.charId);
  const charAnims = anims[charKey];
  if (!charAnims) {
    ctx.restore();
    return;
  }

  let frames = charAnims.idle;
  if (f.state === 'ATTACK') frames = charAnims.attack;
  else if (f.state === 'WALK') frames = charAnims.walk;

  const img = frames[f.animFrame % frames.length];
  if (isValidImg(img)) {
    ctx.translate(f.x + f.width / 2, f.y + f.height / 2);
    if (f.direction === -1) ctx.scale(-1, 1);
    if (f.state === 'HIT') {
      ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5);
      ctx.filter = 'brightness(2) contrast(1.2)';
    }
    ctx.drawImage(img, -f.width / 2, -f.height / 2, f.width, f.height);
  }
  ctx.restore();
}

export function drawFighterFallen(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  anims: CharAnims,
  getCharKey: (charId: number) => string,
): void {
  const charKey = getCharKey(f.charId);
  const charAnims = anims[charKey];
  if (!charAnims) return;
  const frames = charAnims.idle;
  const img = frames[f.animFrame % frames.length];
  if (!isValidImg(img)) return;
  ctx.save();
  const cx = f.x + f.width / 2;
  const cy = GROUND_Y + f.height / 4 + f.width / 1.5;
  ctx.translate(cx, cy);
  if (f.direction === -1) ctx.scale(-1, 1);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, -f.width / 2, -f.height / 2, f.width, f.height);
  ctx.restore();
}

const BAR_WIDTH = 280;
const BAR_HEIGHT = 14;
const BAR_GAP = 4;

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  x: number,
  align: 'L' | 'R',
  wins: number,
  w: number = BAR_WIDTH,
): void {
  const barH = BAR_HEIGHT;
  const gap = BAR_GAP;
  const stamY = 40 + barH + gap;
  const totalH = barH * 2 + gap;

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 2, 40 - 2, w + 4, totalH + 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(x, 40, w, barH);
  ctx.fillRect(x, stamY, w, barH);

  const hpRatio = Math.max(0, Math.min(1, f.hp / f.maxHp));
  const stamRatio = Math.max(0, Math.min(1, f.stamina / f.maxStamina));
  const hpW = hpRatio * w;
  const stamW = stamRatio * w;
  ctx.fillStyle = f.hp > 30 ? '#00FF00' : '#FF0000';

  if (align === 'L') {
    ctx.fillRect(x, 40, hpW, barH);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(x, stamY, stamW, barH);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = '14px "Press Start 2P"';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(f.name, x, 34);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = wins > i ? '#ffd700' : '#333';
      ctx.beginPath();
      ctx.arc(x + w - 15 - i * 30, 26, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillRect(x + (w - hpW), 40, hpW, barH);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(x + (w - stamW), stamY, stamW, barH);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.font = '14px "Press Start 2P"';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(f.name, x + w, 34);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = wins > i ? '#ffd700' : '#333';
      ctx.beginPath();
      ctx.arc(x + 15 + i * 30, 26, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
