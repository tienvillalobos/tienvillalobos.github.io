/**
 * Constantes del juego: dimensiones, stages, personajes, stamina.
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 450;
export const GROUND_Y = 190;
export const MARGIN_X = 15;
export const CHAR_SELECT_SLOTS = 8;

export const STAGES = [
  { id: 0, name: 'ARENA', assetKey: 'arena', locked: false },
  { id: 1, name: 'COFFEE ROOM', assetKey: 'coffee_room', locked: false },
  { id: 2, name: 'LOBBY', assetKey: 'lobby', locked: false },
  { id: 3, name: '???', locked: true },
  { id: 4, name: '???', locked: true },
  { id: 5, name: '???', locked: true },
];

export const STAMINA_MAX = 100;
export const STAMINA_COST = 28;
export const STAMINA_REGEN = 0.35;

export const CHARACTERS = [
  { id: 0, name: 'ERIC', color: '#EF4444', locked: false },
  { id: 1, name: 'DAVID', color: '#4285F4', locked: false },
  { id: 2, name: 'JOSTIN', color: '#22C55E', locked: false },
  { id: 3, name: 'MANU', color: '#E879F9', locked: false },
  { id: 4, name: 'CLAUDE', color: '#D97757', locked: true },
  { id: 5, name: 'GPT-4', color: '#10A37F', locked: true },
  { id: 6, name: 'LLAMA', color: '#0668E1', locked: true },
  { id: 7, name: 'MISTRAL', color: '#FCD34D', locked: true },
  { id: 8, name: 'GROK', color: '#FFFFFF', locked: true },
  { id: 9, name: 'DEEPSEEK', color: '#6366F1', locked: true },
];

export const CHARACTER_STATS: { speed: number; strength: number; agility: number }[] = [
  { speed: 72, strength: 85, agility: 68 },
  { speed: 68, strength: 78, agility: 88 },
  { speed: 80, strength: 70, agility: 82 },
  { speed: 75, strength: 82, agility: 75 },
  { speed: 65, strength: 90, agility: 60 },
  { speed: 88, strength: 65, agility: 90 },
  { speed: 70, strength: 75, agility: 85 },
  { speed: 82, strength: 72, agility: 78 },
  { speed: 78, strength: 88, agility: 70 },
  { speed: 85, strength: 68, agility: 80 },
];

export const ASSETS_BASE = '/assets';
