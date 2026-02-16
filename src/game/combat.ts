/**
 * Lógica de combate: inicialización de luchadores y actualización por frame.
 */

import { sounds } from '../audio/SoundManager';
import {
  GROUND_Y,
  MARGIN_X,
  CANVAS_WIDTH,
  STAMINA_MAX,
  STAMINA_COST,
  STAMINA_REGEN,
  CHARACTERS,
  CHARACTER_STATS,
} from './constants';
import type { Fighter } from './types';

export type CombatControl = 'player' | 'cpu' | 'remote';

export interface InitFightersRefs {
  playerRef: { current: Fighter | null };
  cpuRef: { current: Fighter | null };
  timer: { current: number };
  frameCounter: { current: number };
  screenShakeRef: { current: number };
}

export function initFighters(
  pIdx: number,
  cIdx: number,
  refs: InitFightersRefs,
): void {
  const { playerRef, cpuRef, timer, frameCounter, screenShakeRef } = refs;
  const pStats = CHARACTER_STATS[pIdx] ?? { attack: 1, agility: 1, stamina: 1 };
  const cStats = CHARACTER_STATS[cIdx] ?? { attack: 1, agility: 1, stamina: 1 };
  const pMaxStamina = Math.round(STAMINA_MAX * pStats.stamina);
  const cMaxStamina = Math.round(STAMINA_MAX * cStats.stamina);
  playerRef.current = {
    x: 100, y: GROUND_Y, width: 220, height: 220, hp: 100, maxHp: 100,
    direction: 1, state: 'IDLE', animFrame: 0, animTimer: 0,
    velocityX: 0, velocityY: 0, isAttacking: false, stamina: pMaxStamina, maxStamina: pMaxStamina,
    color: CHARACTERS[pIdx].color, name: CHARACTERS[pIdx].name, charId: pIdx,
  };
  cpuRef.current = {
    x: 480, y: GROUND_Y, width: 220, height: 220, hp: 100, maxHp: 100,
    direction: -1, state: 'IDLE', animFrame: 0, animTimer: 0,
    velocityX: 0, velocityY: 0, isAttacking: false, stamina: cMaxStamina, maxStamina: cMaxStamina,
    color: CHARACTERS[cIdx].color, name: CHARACTERS[cIdx].name, charId: cIdx,
  };
  timer.current = 99;
  frameCounter.current = 0;
  screenShakeRef.current = 0;
  sounds.playSFX('start');
}

export interface UpdateCombatRefs {
  frameCounter: { current: number };
  keys: { current: { [key: string]: boolean } };
  guestKeysRef: { current: { left?: boolean; right?: boolean; up?: boolean; attack?: boolean } };
  screenShakeRef: { current: number };
}

export interface UpdateCombatOptions {
  applyHitDetection?: boolean;
}

export function updateCombat(
  f: Fighter,
  opp: Fighter,
  control: CombatControl,
  refs: UpdateCombatRefs,
  options: UpdateCombatOptions = {},
): void {
  const { applyHitDetection = true } = options;

  if (f.y < GROUND_Y) {
    f.velocityY += 0.9;
    f.state = 'JUMP';
  } else {
    f.y = GROUND_Y;
    f.velocityY = 0;
    if (f.state === 'JUMP') f.state = 'IDLE';
  }

  const fStats = CHARACTER_STATS[f.charId] ?? { attack: 1, agility: 1, stamina: 1 };
  const walkSpeed = 4 * fStats.agility;
  const cpuWalkSpeed = 2.5 * fStats.agility;
  const jumpPower = 15 * fStats.agility;
  const staminaCost = Math.max(8, Math.round(STAMINA_COST / fStats.stamina));
  const staminaRegen = STAMINA_REGEN * fStats.stamina;

  const canAct = refs.frameCounter.current >= 120;
  const isPlayer = control === 'player';
  const isCpu = control === 'cpu';
  const isRemote = control === 'remote';
  const remoteKeys = refs.guestKeysRef.current;

  if (isPlayer && canAct) {
    if (!f.isAttacking && f.state !== 'HIT') {
      if (refs.keys.current['KeyA'] || refs.keys.current['ArrowLeft']) {
        f.velocityX = -walkSpeed;
        f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP';
        f.direction = -1;
      } else if (refs.keys.current['KeyD'] || refs.keys.current['ArrowRight']) {
        f.velocityX = walkSpeed;
        f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP';
        f.direction = 1;
      } else {
        f.velocityX = 0;
        if (f.y === GROUND_Y) f.state = 'IDLE';
      }
      if ((refs.keys.current['KeyW'] || refs.keys.current['ArrowUp']) && f.y === GROUND_Y) {
        f.velocityY = -jumpPower;
      }
      if ((refs.keys.current['Space'] || refs.keys.current['KeyK']) && f.stamina >= staminaCost) {
        f.stamina -= staminaCost;
        f.isAttacking = true;
        f.state = 'ATTACK';
        f.animFrame = 0;
        sounds.playSFX('attack');
      }
    }
  } else if (isRemote && canAct) {
    if (!f.isAttacking && f.state !== 'HIT') {
      if (remoteKeys.left) {
        f.velocityX = -walkSpeed;
        f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP';
        f.direction = -1;
      } else if (remoteKeys.right) {
        f.velocityX = walkSpeed;
        f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP';
        f.direction = 1;
      } else {
        f.velocityX = 0;
        if (f.y === GROUND_Y) f.state = 'IDLE';
      }
      if (remoteKeys.up && f.y === GROUND_Y) f.velocityY = -jumpPower;
      if (remoteKeys.attack && f.stamina >= staminaCost) {
        f.stamina -= staminaCost;
        f.isAttacking = true;
        f.state = 'ATTACK';
        f.animFrame = 0;
        sounds.playSFX('attack');
      }
    }
  } else if (isCpu && canAct) {
    const dist = Math.abs(f.x - opp.x);
    if (!f.isAttacking && f.state !== 'HIT') {
      if (dist > 180) {
        f.velocityX = f.x < opp.x ? cpuWalkSpeed : -cpuWalkSpeed;
        f.direction = f.x < opp.x ? 1 : -1;
        f.state = 'WALK';
      } else {
        f.velocityX = 0;
        f.state = 'IDLE';
        if (Math.random() < 0.05 && f.stamina >= staminaCost) {
          f.stamina -= staminaCost;
          f.isAttacking = true;
          f.state = 'ATTACK';
          f.animFrame = 0;
          sounds.playSFX('attack');
        }
      }
    }
  } else {
    f.velocityX = 0;
  }

  f.x += f.velocityX;
  f.y += f.velocityY;
  if (f.x < MARGIN_X) f.x = MARGIN_X;
  if (f.x > CANVAS_WIDTH - MARGIN_X - f.width) f.x = CANVAS_WIDTH - MARGIN_X - f.width;
  f.animTimer++;
  if (f.animTimer >= (f.state === 'ATTACK' ? 1 : 2)) {
    f.animFrame++;
    f.animTimer = 0;
  }

  const baseDamage = 10;
  const hitDamage = Math.max(1, Math.round(baseDamage * fStats.attack));

  if (f.isAttacking) {
    if (f.animFrame >= 36) {
      f.isAttacking = false;
      f.state = 'IDLE';
      f.animFrame = 0;
    }
    if (applyHitDetection && f.animFrame >= 15 && f.animFrame <= 25 && f.animTimer === 0) {
      const hitX = f.direction === 1 ? f.x + f.width - 90 : f.x + 40;
      if (
        hitX < opp.x + opp.width - 60 &&
        hitX + 50 > opp.x + 60 &&
        f.y < opp.y + opp.height &&
        f.y + 120 > opp.y
      ) {
        if (opp.state !== 'HIT') {
          opp.hp = Math.max(0, opp.hp - hitDamage);
          opp.state = 'HIT';
          opp.animFrame = 0;
          opp.velocityX = f.direction * 8;
          refs.screenShakeRef.current = 10;
          sounds.playSFX('hit');
        }
      }
    }
  } else if (f.state === 'HIT') {
    if (f.animFrame >= 15) {
      f.state = 'IDLE';
      f.animFrame = 0;
      f.velocityX = 0;
    }
  } else {
    if (f.animFrame >= 36) f.animFrame = 0;
  }

  if (!f.isAttacking && f.stamina < f.maxStamina) {
    f.stamina = Math.min(f.maxStamina, f.stamina + staminaRegen);
  }
}
