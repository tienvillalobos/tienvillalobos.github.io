/**
 * Funciones de dibujado y lógica por estado del game loop.
 * Cada función recibe el contexto 2d y el GameLoopContext.
 */

import { sounds } from '../../audio/SoundManager';
import { updateCombat, type CombatControl } from '../combat';
import { drawFighter, drawFighterFallen, drawHpBar } from '../drawing';
import type { GameLoopContext } from '../loopContext';
import type { GameState } from '../types';

const LEADERBOARD_URL = 'https://maxxavelada-backend.onrender.com/leaderboard';

export function drawBoot(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  ctx.fillStyle = '#0f0';
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('SYSTEM BOOTING...', context.CANVAS_WIDTH / 2, context.CANVAS_HEIGHT / 2);
}

export function drawError(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  ctx.fillStyle = '#f00';
  ctx.font = '14px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('FATAL ASSET ERROR', context.CANVAS_WIDTH / 2, 180);
  ctx.font = '10px "Press Start 2P"';
  ctx.fillStyle = '#888';
  ctx.fillText(context.errorMessage || 'CHECK ASSETS.ZIP FILE', context.CANVAS_WIDTH / 2, 220);
}

export function drawLoading(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);

  const cx = context.CANVAS_WIDTH / 2;
  const cy = context.CANVAS_HEIGHT / 2;
  const barW = 280;
  const barH = 16;
  const barX = cx - barW / 2;
  const barY = cy + 8;

  // Texto
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('CARGANDO MAXXITOS...', cx, cy - 24);
  ctx.fillText(`${context.loadProgress}%`, cx, cy - 4);

  // Barra de progreso (borde)
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(barX, barY, barW, barH);
  // Relleno según %
  const pct = Math.min(100, Math.max(0, context.loadProgress));
  if (pct > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(barX, barY, (barW * pct) / 100, barH);
  }

  // Animación loader: 3 círculos que rotan para que no parezca colgado
  context.frameCounter.current++;
  const t = Math.floor(context.frameCounter.current / 10) % 3;
  const dotY = barY + barH + 28;
  const dotR = 5;
  const dotGap = 18;
  for (let i = 0; i < 3; i++) {
    const x = cx - dotGap + i * dotGap;
    ctx.beginPath();
    ctx.arc(x, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === t ? '#ffd700' : 'rgba(255, 215, 0, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function drawIntro(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.font = '14px "Press Start 2P"';
  ctx.textAlign = 'center';
  const frameCounter = context.frameCounter.current;
  ctx.fillText('La Maxxa Velada comienza...'.slice(0, Math.floor(frameCounter / 3)), context.CANVAS_WIDTH / 2, context.CANVAS_HEIGHT / 2);
  context.frameCounter.current++;
  if (context.frameCounter.current > 140) {
    context.setGameState('TITLE');
    context.frameCounter.current = 0;
  }
}

export function drawTitle(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  const bg = context.homeBackground.current;
  if (context.isValid(bg)) {
    ctx.drawImage(bg, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = 'center';
  if (Math.floor(Date.now() / 600) % 2 === 0) {
    ctx.fillText('PRESS SPACE TO START', context.CANVAS_WIDTH / 2, 350);
  }
  if (context.inputCooldownRef.current === 0 && (context.keys.current['Space'] || context.keys.current['Enter'])) {
    sounds.init();
    sounds.playSFX('select');
    context.setGameState('MAIN_MENU');
  }
}

export function drawMainMenu(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.menuBackground.current)) {
    ctx.drawImage(context.menuBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const boxW = 320;
  const boxH = 56;
  const gap = 20;
  const totalH = 4 * boxH + 3 * gap;
  const startY = (context.CANVAS_HEIGHT - totalH) / 2 + 45;
  const labels = ['Jugador', 'Multijugador', 'HISTORIA', 'Leaderboard'];
  const faIcons = ['\uF007', '\uF0C0', null, '\uF091'];
  const idx = context.modeSelectIndexRef.current;
  const iconSize = 20;
  const iconGap = 10;
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const x = (context.CANVAS_WIDTH - boxW) / 2;
    const y = startY + i * (boxH + gap);
    const isSelected = idx === i;
    const isLocked = i === 2;
    ctx.fillStyle = isLocked ? 'rgba(30, 30, 40, 0.95)' : (isSelected ? 'rgba(23, 42, 69, 0.95)' : 'rgba(15, 30, 50, 0.9)');
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = isLocked ? '#444' : (isSelected ? '#ffd700' : '#4a6fa5');
    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = isLocked ? '#555' : (isSelected ? '#ffd700' : '#e0e0e0');
    ctx.font = '14px "Press Start 2P"';
    const textW = ctx.measureText(labels[i]).width;
    const iconW = faIcons[i] != null ? iconSize + iconGap : 0;
    const totalW = iconW + textW;
    const startX = x + (boxW - totalW) / 2;
    if (faIcons[i] != null) {
      ctx.font = `900 ${iconSize}px "Font Awesome 6 Free"`;
      ctx.fillText(faIcons[i], startX, y + boxH / 2);
      ctx.font = '14px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillText(labels[i], startX + iconSize + iconGap, y + boxH / 2);
      ctx.textAlign = 'center';
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + boxW / 2, y + boxH / 2);
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#666';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('ARROWS + SPACE/ENTER', context.CANVAS_WIDTH / 2, context.CANVAS_HEIGHT - 24);
  context.frameCounter.current++;
  if (context.frameCounter.current > 10) {
    let changed = false;
    if (context.keys.current['ArrowDown']) {
      context.setModeSelectIndex((p) => (p + 1) % 4);
      changed = true;
    } else if (context.keys.current['ArrowUp']) {
      context.setModeSelectIndex((p) => (p - 1 + 4) % 4);
      changed = true;
    }
    if (changed) {
      context.frameCounter.current = 0;
      sounds.playSFX('select');
    }
  }
  if (context.inputCooldownRef.current === 0 && (context.keys.current['Space'] || context.keys.current['Enter'])) {
    if (idx === 0) {
      sounds.playSFX('select');
      context.setGameState('CHARACTER_SELECT');
    } else if (idx === 1) {
      sounds.playSFX('select');
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const roomFromUrl = params.get('room');
      if (roomFromUrl) {
        context.isOnlineHostRef.current = false;
        context.setGameState('ONLINE_NAME');
      } else {
        context.isOnlineHostRef.current = true;
        context.setOnlinePlayerName('');
        context.setChallengeLink('');
        context.setServerRoomState(null);
        context.setGameState('ONLINE_NAME');
      }
    } else if (idx === 3) {
      sounds.playSFX('select');
      if (typeof window !== 'undefined') window.open(LEADERBOARD_URL, '_blank', 'noopener,noreferrer');
    }
  }
}

export function drawOnlineNameOrLink(ctx: CanvasRenderingContext2D, context: GameLoopContext, state: GameState): void {
  ctx.fillStyle = '#0a192f';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = 'center';
  if (state === 'ONLINE_NAME') {
    ctx.fillText('INGRESA TU NOMBRE', context.CANVAS_WIDTH / 2, context.CANVAS_HEIGHT / 2 - 40);
  }
}

const P1_COLOR = '#EF4444';
const P2_COLOR = '#4285F4';

export function drawCharacterSelect(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.menuBackground.current)) {
    ctx.drawImage(context.menuBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const size = 90;
  const margin = 20;
  const gridX = (context.CANVAS_WIDTH - (4 * size + 3 * margin)) / 2;
  const gridTopY = 110;
  const charsInSelect = context.CHARACTERS.slice(0, context.CHAR_SELECT_SLOTS);
  const selectedIdx = Math.min(context.selectedCharRef.current, context.CHAR_SELECT_SLOTS - 1);
  const mugPad = 5;
  const mugSize = size - mugPad * 2;
  const isOnlineChar = !!context.roomClientRef.current;
  const room = context.serverRoomStateRef.current;
  const isHost = context.isOnlineHostRef.current;
  const hasConfirmed = isOnlineChar && room && (isHost ? room.hostChar != null : room.guestChar != null);
  const otherName = room ? (isHost ? room.guestName : room.hostName) : null;

  charsInSelect.forEach((c, i) => {
    const x = gridX + (i % 4) * (size + margin);
    const y = gridTopY + Math.floor(i / 4) * (size + margin);
    ctx.fillStyle = c.locked ? '#050a14' : '#172a45';
    ctx.fillRect(x, y, size, size);
    if (!c.locked) {
      const mug = context.mugshots.current[context.getCharKey(c.id)];
      const mx = x + mugPad;
      const my = y + mugPad;
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(mx, my, mugSize, mugSize);
      if (context.isValid(mug)) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        ctx.drawImage(mug, mx, my, mugSize, mugSize);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    } else {
      ctx.fillStyle = '#444';
      ctx.font = '30px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('?', x + size / 2, y + size / 2 + 10);
    }
    let slotStroke = c.locked ? '#444' : '#ffd700';
    let slotLineWidth = c.locked ? 2 : 4;
    if (i === selectedIdx && !isOnlineChar) {
      slotStroke = '#f00';
      slotLineWidth = 6;
    } else if (i === selectedIdx && isOnlineChar) {
      slotStroke = context.isOnlineHostRef.current ? P1_COLOR : P2_COLOR;
      slotLineWidth = 6;
    }
    if (isOnlineChar && room) {
      if (room.hostChar === String(i)) {
        slotStroke = P1_COLOR;
        slotLineWidth = 5;
      } else if (room.guestChar === String(i)) {
        slotStroke = P2_COLOR;
        slotLineWidth = 5;
      }
    }
    ctx.strokeStyle = slotStroke;
    ctx.lineWidth = slotLineWidth;
    ctx.strokeRect(x, y, size, size);
    if (isOnlineChar && room) {
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'center';
      if (room.hostChar === String(i) && room.hostName) {
        ctx.fillStyle = P1_COLOR;
        ctx.fillText(`P1 ${room.hostName}`, x + size / 2, y + size - 4);
      } else if (room.guestChar === String(i) && room.guestName) {
        ctx.fillStyle = P2_COLOR;
        ctx.fillText(`P2 ${room.guestName}`, x + size / 2, y + size - 4);
      }
    }
  });

  const currentChar = context.CHARACTERS[selectedIdx];
  const leftPreviewX = 24;
  const leftPreviewY = 130;
  const leftPreviewSize = 140;
  const previewOuter = leftPreviewSize + 8;
  if (!currentChar.locked) {
    const charAnims = context.anims.current[context.getCharKey(selectedIdx)];
    const idle0 = charAnims?.idle?.[0];
    if (idle0 && context.isValid(idle0)) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
      ctx.strokeStyle = isOnlineChar ? (context.isOnlineHostRef.current ? P1_COLOR : P2_COLOR) : currentChar.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
      ctx.drawImage(idle0, leftPreviewX, leftPreviewY, leftPreviewSize, leftPreviewSize);
    }
  } else {
    ctx.fillStyle = '#050a14';
    ctx.fillRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.strokeRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
    ctx.fillStyle = '#444';
    ctx.font = '48px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('?', leftPreviewX + leftPreviewSize / 2, leftPreviewY + leftPreviewSize / 2 + 16);
  }

  const cardX = 618;
  const cardY = 95;
  const cardW = 168;
  const cardH = 260;
  if (isOnlineChar && room) {
    const otherLabel = context.isOnlineHostRef.current ? 'P2' : 'P1';
    const otherColor = context.isOnlineHostRef.current ? P2_COLOR : P1_COLOR;
    ctx.fillStyle = 'rgba(23, 42, 69, 0.95)';
    ctx.strokeStyle = otherColor;
    ctx.lineWidth = 3;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    const otherConfirmed = context.isOnlineHostRef.current ? room.guestChar : room.hostChar;
    const confirmedIdx = otherConfirmed != null ? parseInt(String(otherConfirmed), 10) : null;
    const cursorIdx = context.otherPlayerSlotIndexRef.current != null
      ? Math.min(context.CHAR_SELECT_SLOTS - 1, Math.max(0, context.otherPlayerSlotIndexRef.current)) : null;
    const slotIdx = confirmedIdx != null && !Number.isNaN(confirmedIdx) ? confirmedIdx : cursorIdx;
    if (slotIdx != null && context.CHARACTERS[slotIdx] && !context.CHARACTERS[slotIdx].locked) {
      const otherAnims = context.anims.current[context.getCharKey(slotIdx)];
      const idle000 = otherAnims?.idle?.[0];
      if (idle000 && context.isValid(idle000)) {
        const drawW = 140;
        const drawH = 140;
        const cx = cardX + cardW / 2;
        const topY = cardY + 20;
        ctx.save();
        ctx.translate(cx, topY + drawH / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(idle000, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(`ESPERANDO A ${otherLabel}...`, cardX + cardW / 2, cardY + cardH / 2 - 8);
    }
    ctx.fillStyle = otherColor;
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`${otherLabel} ${room.guestName ?? room.hostName ?? '...'}`, cardX + cardW / 2, cardY + cardH - 20);
  } else {
    ctx.fillStyle = 'rgba(23, 42, 69, 0.95)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('STATS', cardX + cardW / 2, cardY + 28);
    const stats = context.CHARACTER_STATS[selectedIdx] ?? { attack: 1, agility: 1, stamina: 1 };
    const toBar = (v: number) => Math.min(100, Math.max(0, Math.round(v * 72)));
    const barY = (label: string, y: number, value: number) => {
      ctx.fillStyle = '#fff';
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillText(label, cardX + 12, y);
      const barW = cardW - 24;
      const barH = 12;
      const barX = cardX + 12;
      ctx.fillStyle = '#111';
      ctx.fillRect(barX, y + 4, barW, barH);
      ctx.fillStyle = '#4a9eff';
      ctx.fillRect(barX, y + 4, (value / 100) * barW, barH);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, y + 4, barW, barH);
    };
    barY('ATAQUE', cardY + 52, toBar(stats.attack));
    barY('AGILIDAD', cardY + 52 + 36, toBar(stats.agility));
    barY('STAMINA', cardY + 52 + 72, toBar(stats.stamina));
  }
  ctx.textAlign = 'left';
  ctx.font = '30px "Press Start 2P"';
  ctx.fillStyle = currentChar.locked ? '#444' : currentChar.color;
  ctx.fillText(currentChar.locked ? 'LOCKED' : currentChar.name, 200, 380);
  ctx.fillStyle = '#fff';
  ctx.font = '22px "Press Start 2P"';
  ctx.textAlign = 'center';
  if (hasConfirmed) {
    ctx.fillStyle = '#ffd700';
    ctx.fillText(
      isHost ? (otherName ? `ESPERANDO A ${otherName}...` : 'ESPERANDO AL OTRO JUGADOR') : 'ESPERANDO AL HOST...',
      context.CANVAS_WIDTH / 2,
      410,
    );
  } else {
    ctx.fillText('CHOOSE YOUR MAXXITO', context.CANVAS_WIDTH / 2, 410);
  }

  if (!hasConfirmed) {
    context.frameCounter.current++;
    if (context.frameCounter.current > 10) {
      let changed = false;
      if (context.keys.current['ArrowRight']) {
        context.setSelectedChar((p) => (p + 1) % context.CHAR_SELECT_SLOTS);
        changed = true;
      } else if (context.keys.current['ArrowLeft']) {
        context.setSelectedChar((p) => (p - 1 + context.CHAR_SELECT_SLOTS) % context.CHAR_SELECT_SLOTS);
        changed = true;
      } else if (context.keys.current['ArrowDown']) {
        context.setSelectedChar((p) => (p + 4) % context.CHAR_SELECT_SLOTS);
        changed = true;
      } else if (context.keys.current['ArrowUp']) {
        context.setSelectedChar((p) => (p - 4 + context.CHAR_SELECT_SLOTS) % context.CHAR_SELECT_SLOTS);
        changed = true;
      }
      if (changed) {
        context.frameCounter.current = 0;
        sounds.playSFX('select');
      }
    }
    if (context.inputCooldownRef.current === 0 && (context.keys.current['Space'] || context.keys.current['Enter'])) {
      if (!currentChar.locked) {
        const client = context.roomClientRef.current;
        if (client) {
          client.sendSelectChar(String(selectedIdx));
          context.inputCooldownRef.current = 45;
          sounds.playSFX('select');
        } else {
          const candidates = charsInSelect
            .map((_, i) => i)
            .filter((i) => i !== selectedIdx && !context.CHARACTERS[i].locked);
          const cpu = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
          context.setCpuChar(cpu);
          context.cpuCharRef.current = cpu;
          context.resetMatchState();
          context.setGameState('STAGE_SELECT');
        }
      }
    }
  }
}

export function drawOnlineCharsReady(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.menuBackground.current)) {
    ctx.drawImage(context.menuBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const size = 90;
  const margin = 20;
  const gridX = (context.CANVAS_WIDTH - (4 * size + 3 * margin)) / 2;
  const gridTopY = 110;
  const charsInSelect = context.CHARACTERS.slice(0, context.CHAR_SELECT_SLOTS);
  const mugPad = 5;
  const mugSize = size - mugPad * 2;
  const room = context.serverRoomStateRef.current;
  if (room) {
    charsInSelect.forEach((c, i) => {
      const x = gridX + (i % 4) * (size + margin);
      const y = gridTopY + Math.floor(i / 4) * (size + margin);
      ctx.fillStyle = c.locked ? '#050a14' : '#172a45';
      ctx.fillRect(x, y, size, size);
      if (!c.locked) {
        const mug = context.mugshots.current[context.getCharKey(c.id)];
        const mx = x + mugPad;
        const my = y + mugPad;
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(mx, my, mugSize, mugSize);
        if (context.isValid(mug)) {
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 4;
          ctx.drawImage(mug, mx, my, mugSize, mugSize);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      } else {
        ctx.fillStyle = '#444';
        ctx.font = '30px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('?', x + size / 2, y + size / 2 + 10);
      }
      let slotStroke = c.locked ? '#444' : '#ffd700';
      let slotLineWidth = c.locked ? 2 : 4;
      if (room.hostChar === String(i)) {
        slotStroke = P1_COLOR;
        slotLineWidth = 5;
      } else if (room.guestChar === String(i)) {
        slotStroke = P2_COLOR;
        slotLineWidth = 5;
      }
      ctx.strokeStyle = slotStroke;
      ctx.lineWidth = slotLineWidth;
      ctx.strokeRect(x, y, size, size);
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'center';
      if (room.hostChar === String(i) && room.hostName) {
        ctx.fillStyle = P1_COLOR;
        ctx.fillText(`P1 ${room.hostName}`, x + size / 2, y + size - 4);
      } else if (room.guestChar === String(i) && room.guestName) {
        ctx.fillStyle = P2_COLOR;
        ctx.fillText(`P2 ${room.guestName}`, x + size / 2, y + size - 4);
      }
    });
    const leftPreviewX = 24;
    const leftPreviewY = 130;
    const leftPreviewSize = 140;
    const previewOuter = leftPreviewSize + 8;
    const hostIdx = room.hostChar != null ? parseInt(String(room.hostChar), 10) : 0;
    const hostChar = context.CHARACTERS[Number.isNaN(hostIdx) ? 0 : Math.min(context.CHAR_SELECT_SLOTS - 1, Math.max(0, hostIdx))];
    if (hostChar && !hostChar.locked) {
      const charAnims = context.anims.current[context.getCharKey(Number.isNaN(hostIdx) ? 0 : Math.min(context.CHAR_SELECT_SLOTS - 1, Math.max(0, hostIdx)))];
      const idle0 = charAnims?.idle?.[0];
      if (idle0 && context.isValid(idle0)) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
        ctx.strokeStyle = P1_COLOR;
        ctx.lineWidth = 3;
        ctx.strokeRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
        ctx.drawImage(idle0, leftPreviewX, leftPreviewY, leftPreviewSize, leftPreviewSize);
      }
    }
    ctx.textAlign = 'left';
    ctx.font = '30px "Press Start 2P"';
    ctx.fillStyle = hostChar?.locked ? '#444' : (hostChar?.color ?? '#ffd700');
    ctx.fillText(hostChar?.locked ? 'LOCKED' : (hostChar?.name ?? 'P1'), 200, 380);
    const cardX = 618;
    const cardY = 95;
    const cardW = 168;
    const cardH = 260;
    ctx.fillStyle = 'rgba(23, 42, 69, 0.95)';
    ctx.strokeStyle = P2_COLOR;
    ctx.lineWidth = 3;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    const guestIdx = room.guestChar != null ? parseInt(String(room.guestChar), 10) : null;
    const slotIdx = guestIdx != null && !Number.isNaN(guestIdx) ? Math.min(context.CHAR_SELECT_SLOTS - 1, Math.max(0, guestIdx)) : null;
    if (slotIdx != null && context.CHARACTERS[slotIdx] && !context.CHARACTERS[slotIdx].locked) {
      const otherAnims = context.anims.current[context.getCharKey(slotIdx)];
      const idle000 = otherAnims?.idle?.[0];
      if (idle000 && context.isValid(idle000)) {
        const drawW = 140;
        const drawH = 140;
        const cx = cardX + cardW / 2;
        const topY = cardY + 20;
        ctx.save();
        ctx.translate(cx, topY + drawH / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(idle000, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }
    }
    ctx.fillStyle = P2_COLOR;
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`P2 ${room.guestName ?? '...'}`, cardX + cardW / 2, cardY + cardH - 20);
  }
  const panelH = 56;
  const marginBottom = 24;
  const panelY = context.CANVAS_HEIGHT - panelH - marginBottom;
  ctx.fillStyle = 'rgba(10, 25, 47, 0.95)';
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.fillRect(0, panelY, context.CANVAS_WIDTH, panelH);
  ctx.strokeRect(0, panelY, context.CANVAS_WIDTH, panelH);
  ctx.fillStyle = '#ffd700';
  ctx.font = '22px "Press Start 2P"';
  ctx.textAlign = 'center';
  const blink = Math.floor(Date.now() / 500) % 2 === 0;
  if (blink) ctx.fillText('SPACE PARA CONTINUAR', context.CANVAS_WIDTH / 2, panelY + panelH / 2 + 8);
  if (context.inputCooldownRef.current === 0 && (context.keys.current['Space'] || context.keys.current['Enter'])) {
    sounds.playSFX('select');
    context.roomClientRef.current?.sendAdvanceToStageSelect();
    context.setGameState('STAGE_SELECT');
  }
}

export function drawStageSelect(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.menuBackground.current)) {
    ctx.drawImage(context.menuBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const isOnlineStage = !!context.roomClientRef.current;
  const isHost = context.isOnlineHostRef.current;
  ctx.fillStyle = '#fff';
  ctx.font = '22px "Press Start 2P"';
  ctx.textAlign = 'center';
  if (isOnlineStage && !isHost) {
    ctx.fillText('ESPERANDO AL HOST...', context.CANVAS_WIDTH / 2, 410);
  } else {
    ctx.fillText(
      context.onlineStageConfirmedRef.current ? 'SPACE TO START FIGHT' : 'SELECT STAGE',
      context.CANVAS_WIDTH / 2,
      410,
    );
  }
  const size = 120;
  const margin = 24;
  const cols = 3;
  const gridW = cols * size + (cols - 1) * margin;
  const gridX = (context.CANVAS_WIDTH - gridW) / 2;
  const gridTopY = 95;
  const selectedIdx = Math.min(context.selectedStageRef.current, context.STAGES.length - 1);
  context.STAGES.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (size + margin);
    const y = gridTopY + row * (size + margin);
    ctx.fillStyle = s.locked ? '#050a14' : '#172a45';
    ctx.fillRect(x, y, size, size);
    if (!s.locked && context.stageBackgrounds.current[i] && context.isValid(context.stageBackgrounds.current[i]!)) {
      ctx.drawImage(context.stageBackgrounds.current[i]!, x + 4, y + 4, size - 8, size - 8);
    } else if (s.locked) {
      ctx.fillStyle = '#444';
      ctx.font = '24px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('?', x + size / 2, y + size / 2 + 8);
    }
    ctx.strokeStyle = i === selectedIdx ? '#f00' : (s.locked ? '#444' : '#ffd700');
    ctx.lineWidth = i === selectedIdx ? 6 : (s.locked ? 2 : 4);
    ctx.strokeRect(x, y, size, size);
  });
  const currentStage = context.STAGES[selectedIdx];
  ctx.textAlign = 'left';
  ctx.font = '30px "Press Start 2P"';
  ctx.fillStyle = currentStage.locked ? '#444' : '#ffd700';
  ctx.fillText(currentStage.locked ? 'LOCKED' : currentStage.name, 200, 400);
  if (isOnlineStage && !isHost) {
    // guest: no input
  } else {
    context.frameCounter.current++;
    if (context.frameCounter.current > 10) {
      let changed = false;
      if (context.keys.current['ArrowRight']) {
        context.setSelectedStage((p) => (p + 1) % context.STAGES.length);
        changed = true;
      } else if (context.keys.current['ArrowLeft']) {
        context.setSelectedStage((p) => (p - 1 + context.STAGES.length) % context.STAGES.length);
        changed = true;
      } else if (context.keys.current['ArrowDown']) {
        context.setSelectedStage((p) => (p + 3) % context.STAGES.length);
        changed = true;
      } else if (context.keys.current['ArrowUp']) {
        context.setSelectedStage((p) => (p - 3 + context.STAGES.length) % context.STAGES.length);
        changed = true;
      }
      if (changed) {
        context.frameCounter.current = 0;
        sounds.playSFX('select');
      }
    }
    if (context.inputCooldownRef.current === 0 && (context.keys.current['Space'] || context.keys.current['Enter'])) {
      if (!currentStage.locked) {
        const client = context.roomClientRef.current;
        if (client && isHost) {
          if (!context.onlineStageConfirmedRef.current) {
            client.sendSelectStage(String(selectedIdx));
            context.onlineStageConfirmedRef.current = true;
            sounds.playSFX('select');
          } else {
            client.sendStartFight();
            sounds.playSFX('select');
          }
        } else if (!client) {
          const bg = context.stageBackgrounds.current[selectedIdx];
          context.fightBackground.current = bg && context.isValid(bg) ? bg : null;
          context.initFighters(context.selectedCharRef.current, context.cpuCharRef.current);
          context.setGameState('FIGHT');
        }
      }
    }
  }
}

function drawFighterWithContext(ctx: CanvasRenderingContext2D, f: import('../types').Fighter, context: GameLoopContext): void {
  drawFighter(ctx, f, context.anims.current, context.getCharKey);
}

function drawFighterFallenWithContext(ctx: CanvasRenderingContext2D, f: import('../types').Fighter, context: GameLoopContext): void {
  drawFighterFallen(ctx, f, context.anims.current, context.getCharKey);
}

export function drawStop(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
}

export function drawFight(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.fightBackground.current)) {
    ctx.drawImage(context.fightBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const isOnlineFight = !!context.roomClientRef.current;
  const isHost = context.isOnlineHostRef.current;
  const runCombat = !isOnlineFight || isHost;
  const player = context.playerRef.current;
  const cpu = context.cpuRef.current;

  if (player && cpu) {
    if (runCombat && !context.fightPausedRef.current) {
      const p2Control: CombatControl = isOnlineFight && isHost ? 'remote' : 'cpu';
      updateCombat(player, cpu, 'player', {
        frameCounter: context.frameCounter,
        keys: context.keys,
        guestKeysRef: context.guestKeysRef,
        screenShakeRef: context.screenShakeRef,
      });
      updateCombat(cpu, player, p2Control, {
        frameCounter: context.frameCounter,
        keys: context.keys,
        guestKeysRef: context.guestKeysRef,
        screenShakeRef: context.screenShakeRef,
      });
      if (context.frameCounter.current % 60 === 0 && context.timer.current > 0 && context.frameCounter.current >= 120) {
        context.timer.current--;
      }
      context.frameCounter.current++;
      if (player.hp <= 0 || cpu.hp <= 0 || context.timer.current <= 0) {
        const p1Won = player.hp > cpu.hp;
        context.winnerNameRef.current = p1Won ? player.name : cpu.name;
        context.roundLoserRef.current = p1Won ? cpu : player;
        if (p1Won) context.scoreRef.current.p1++;
        else context.scoreRef.current.p2++;
        context.setGameState('ROUND_KO');
        context.frameCounter.current = 0;
      }
    }
    if (isOnlineFight && isHost) {
      const client = context.roomClientRef.current;
      if (client) {
        client.sendStateSync({
          phase: 'FIGHT',
          p1: { ...player },
          p2: { ...cpu },
          timer: context.timer.current,
          score: { ...context.scoreRef.current },
          round: context.roundRef.current,
          winnerName: context.winnerNameRef.current,
          frameCounter: context.frameCounter.current,
        });
      }
    }
    if (isOnlineFight && !isHost && context.roomClientRef.current && context.frameCounter.current % 2 === 0) {
      context.roomClientRef.current.sendInput({
        left: !!(context.keys.current['KeyA'] || context.keys.current['ArrowLeft']),
        right: !!(context.keys.current['KeyD'] || context.keys.current['ArrowRight']),
        up: !!(context.keys.current['KeyW'] || context.keys.current['ArrowUp']),
        attack: !!(context.keys.current['Space'] || context.keys.current['KeyK']),
      });
    }
    drawFighterWithContext(ctx, player, context);
    drawFighterWithContext(ctx, cpu, context);
    ctx.fillStyle = '#fff';
    ctx.font = '34px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(context.timer.current.toString(), context.CANVAS_WIDTH / 2, 65);
    drawHpBar(ctx, player, 20, 'L', context.scoreRef.current.p1);
    drawHpBar(ctx, cpu, 500, 'R', context.scoreRef.current.p2);
    if (context.frameCounter.current < 120 && !context.fightPausedRef.current) {
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.font = '50px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      const msg = context.frameCounter.current < 60 ? `ROUND ${context.roundRef.current}` : 'FIGHT!';
      ctx.fillText(msg, context.CANVAS_WIDTH / 2, context.CANVAS_HEIGHT / 2);
      ctx.restore();
    }
  }
}

export function drawRoundKo(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.fightBackground.current)) {
    ctx.drawImage(context.fightBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const loser = context.roundLoserRef.current;
  const player = context.playerRef.current;
  const cpu = context.cpuRef.current;
  const winner = player && cpu && loser === player ? cpu : player;
  if (winner) drawFighterWithContext(ctx, winner, context);
  if (loser) drawFighterFallenWithContext(ctx, loser, context);
  ctx.fillStyle = '#fff';
  ctx.font = '34px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(context.timer.current.toString(), context.CANVAS_WIDTH / 2, 65);
  if (player && cpu) {
    drawHpBar(ctx, player, 20, 'L', context.scoreRef.current.p1);
    drawHpBar(ctx, cpu, 500, 'R', context.scoreRef.current.p2);
  }
  ctx.fillStyle = '#ffd700';
  ctx.font = '50px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText('K.O.', context.CANVAS_WIDTH / 2, context.CANVAS_HEIGHT / 2);
  ctx.shadowBlur = 0;
  if (context.frameCounter.current === 0) sounds.playBuffer('ko');
  context.frameCounter.current++;
  if (context.roomClientRef.current && context.isOnlineHostRef.current) {
    context.roomClientRef.current.sendStateSync({
      phase: 'ROUND_KO',
      p1: context.playerRef.current ? { ...context.playerRef.current } : {},
      p2: context.cpuRef.current ? { ...context.cpuRef.current } : {},
      timer: context.timer.current,
      score: { ...context.scoreRef.current },
      round: context.roundRef.current,
      winnerName: context.winnerNameRef.current,
      frameCounter: context.frameCounter.current,
    });
  }
  if (context.frameCounter.current > 120) {
    context.setGameState('ROUND_RESULT');
    context.frameCounter.current = 0;
  }
}

export function drawRoundResult(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '30px "Press Start 2P"';
  ctx.fillText(
    `${context.winnerNameRef.current} WINS ROUND ${context.roundRef.current}`,
    context.CANVAS_WIDTH / 2,
    context.CANVAS_HEIGHT / 2,
  );
  context.frameCounter.current++;
  if (context.roomClientRef.current && context.isOnlineHostRef.current) {
    context.roomClientRef.current.sendStateSync({
      phase: 'ROUND_RESULT',
      p1: context.playerRef.current ? { ...context.playerRef.current } : {},
      p2: context.cpuRef.current ? { ...context.cpuRef.current } : {},
      timer: context.timer.current,
      score: { ...context.scoreRef.current },
      round: context.roundRef.current,
      winnerName: context.winnerNameRef.current,
      frameCounter: context.frameCounter.current,
    });
  }
  if (context.frameCounter.current > 120) {
    if (context.scoreRef.current.p1 >= 2 || context.scoreRef.current.p2 >= 2) {
      context.setGameState('GAME_OVER');
    } else {
      context.roundRef.current++;
      if (context.roomClientRef.current) context.guestKeysRef.current = {};
      context.initFighters(context.selectedCharRef.current, context.cpuCharRef.current);
      context.setGameState('FIGHT');
    }
    context.frameCounter.current = 0;
  }
}

export function drawGameOver(ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  if (context.isValid(context.menuBackground.current)) {
    ctx.drawImage(context.menuBackground.current, 0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, context.CANVAS_WIDTH, context.CANVAS_HEIGHT);
  }
  const p1 = context.playerRef.current;
  const p2 = context.cpuRef.current;
  const room = context.serverRoomStateRef.current;
  const isOnline = !!context.roomClientRef.current;
  const isHost = context.isOnlineHostRef.current;
  const winnerName = context.winnerNameRef.current;
  const p1Won = winnerName === p1?.name;
  const p2Won = winnerName === p2?.name;
  const leftX = 120;
  const rightX = 460;
  const hostName = (isOnline && room?.hostName) ? room.hostName : (p1?.name ?? 'P1');
  const guestName = (isOnline && room?.guestName) ? room.guestName : 'CPU';
  const leftChar = isOnline && !isHost ? p2 : p1;
  const rightChar = isOnline && !isHost ? p1 : p2;
  const leftWon = isOnline && !isHost ? p2Won : p1Won;
  const rightWon = isOnline && !isHost ? p1Won : p2Won;
  const leftLabel = isOnline && !isHost ? guestName : hostName;
  const rightLabel = isOnline && !isHost ? hostName : guestName;
  if (p1 && p2) {
    const origP1x = p1.x, origP1y = p1.y, origP1d = p1.direction, origP1s = p1.state, origP1f = p1.animFrame;
    const origP2x = p2.x, origP2y = p2.y, origP2d = p2.direction, origP2s = p2.state, origP2f = p2.animFrame;
    leftChar.x = leftX;
    leftChar.y = context.GROUND_Y;
    leftChar.direction = 1;
    leftChar.state = 'IDLE';
    leftChar.animFrame = 0;
    rightChar.x = rightX;
    rightChar.y = context.GROUND_Y;
    rightChar.direction = -1;
    rightChar.state = 'IDLE';
    rightChar.animFrame = 0;
    if (leftWon) {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 28;
      drawFighterWithContext(ctx, leftChar, context);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.filter = 'saturate(0.6) brightness(0.85)';
      drawFighterWithContext(ctx, leftChar, context);
      ctx.restore();
    }
    if (rightWon) {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 28;
      drawFighterWithContext(ctx, rightChar, context);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.filter = 'saturate(0.6) brightness(0.85)';
      drawFighterWithContext(ctx, rightChar, context);
      ctx.restore();
    }
    p1.x = origP1x; p1.y = origP1y; p1.direction = origP1d; p1.state = origP1s; p1.animFrame = origP1f;
    p2.x = origP2x; p2.y = origP2y; p2.direction = origP2d; p2.state = origP2s; p2.animFrame = origP2f;
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillStyle = leftWon ? '#ffd700' : '#888';
    ctx.fillText(`${leftWon ? 'VICTORIA' : 'K.O.'}  ${leftLabel}`, leftX + leftChar.width / 2, context.GROUND_Y - 20);
    ctx.fillStyle = rightWon ? '#ffd700' : '#888';
    ctx.fillText(`${rightWon ? 'VICTORIA' : 'K.O.'}  ${rightLabel}`, rightX + rightChar.width / 2, context.GROUND_Y - 20);
    ctx.shadowBlur = 0;
  }
  if (context.roomClientRef.current && context.isOnlineHostRef.current) {
    context.roomClientRef.current.sendStateSync({
      phase: 'GAME_OVER',
      p1: context.playerRef.current ? { ...context.playerRef.current } : {},
      p2: context.cpuRef.current ? { ...context.cpuRef.current } : {},
      timer: context.timer.current,
      score: { ...context.scoreRef.current },
      round: context.roundRef.current,
      winnerName: context.winnerNameRef.current,
    });
  }
  if (context.inputCooldownRef.current === 0 && (context.keys.current['Space'] || context.keys.current['Enter'])) {
    sounds.playSFX('select');
    context.setGameState('TITLE');
    context.resetMatchState();
  }
}
