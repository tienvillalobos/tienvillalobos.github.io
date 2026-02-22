/**
 * Tipos del juego: estados, fighter, etc.
 */

export type GameState =
  | 'BOOT'
  | 'LOADING'
  | 'INTRO'
  | 'TITLE'
  | 'MAIN_MENU'
  | 'ONLINE_NAME'
  | 'ONLINE_LINK'
  | 'ONLINE_WAITING'
  | 'CHARACTER_SELECT'
  | 'ONLINE_CHARS_READY'
  | 'STAGE_SELECT'
  | 'FIGHT'
  | 'ROUND_KO'
  | 'ROUND_RESULT'
  | 'GAME_OVER'
  | 'ERROR'
  | 'STOP'
  | 'STORY_TRANSITION'
  | 'STORY_TOWER'
  | 'STORY_VICTORY'
  | 'STORY_GAME_OVER';

export interface Fighter {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  direction: 1 | -1;
  state: 'IDLE' | 'WALK' | 'ATTACK' | 'HIT' | 'JUMP';
  animFrame: number;
  animTimer: number;
  velocityX: number;
  velocityY: number;
  isAttacking: boolean;
  stamina: number;
  maxStamina: number;
  color: string;
  name: string;
  charId: number;
  /** Modo Historia: multiplicador de stats del CPU (solo para el oponente). */
  statMultiplier?: number;
  /** Golpe especial (tecla J): aplica daño x10. */
  powerPunch?: boolean;
}
