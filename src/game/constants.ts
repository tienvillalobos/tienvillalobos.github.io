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

/** Clave de carpeta de assets (ej. "diego_plaza"). Si no se define, se usa name en minúsculas con espacios → guiones bajos. */
export type CharacterAssetKey = string;

export const CHARACTERS: { id: number; name: string; color: string; locked: boolean; assetKey?: CharacterAssetKey }[] = [
  { id: 0, name: 'ERIC', color: '#EF4444', locked: false },
  { id: 1, name: 'DAVID', color: '#4285F4', locked: false },
  { id: 2, name: 'JOSTIN', color: '#22C55E', locked: false },
  { id: 3, name: 'MANU', color: '#E879F9', locked: false },
  { id: 4, name: 'DIEGO PLAZA', color: '#F59E0B', locked: false, assetKey: 'diego_plaza' },
  { id: 5, name: 'CLAUDE', color: '#D97757', locked: true },
  { id: 6, name: 'GPT-4', color: '#10A37F', locked: true },
  { id: 7, name: 'LLAMA', color: '#0668E1', locked: true },
  { id: 8, name: 'MISTRAL', color: '#FCD34D', locked: true },
  { id: 9, name: 'GROK', color: '#FFFFFF', locked: true },
  { id: 10, name: 'DEEPSEEK', color: '#6366F1', locked: true },
];

/** Multiplicadores de combate (1.0 = balanceado). Afectan daño, movimiento y stamina. */
export interface CharacterCombatStats {
  attack: number;   // daño (1.0 = base)
  agility: number;  // velocidad de movimiento y salto (1.0 = base)
  stamina: number;  // max stamina, regen y coste invertido (1.0 = base)
}

export const CHARACTER_STATS: CharacterCombatStats[] = [
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },  // Eric: balanceado
  { attack: 1.12, agility: 0.92, stamina: 1.0   },  // David: más ataque, menos agilidad
  { attack: 0.92, agility: 1.0,  stamina: 1.15  },  // Jostin: menos ataque, más stamina
  { attack: 0.92, agility: 1.12, stamina: 1.0   },  // Manu: menos ataque, más agilidad
  { attack: 1.38, agility: 0.82, stamina: 0.82  },  // Diego Plaza: mucho ataque, menos agilidad y stamina
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },
  { attack: 1.0,  agility: 1.0,  stamina: 1.0   },
];

export const ASSETS_BASE = '/assets';
