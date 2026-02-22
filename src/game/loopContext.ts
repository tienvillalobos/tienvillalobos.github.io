/**
 * Tipo de contexto pasado al game loop y a las funciones de pantalla.
 * El componente principal construye este objeto y lo pasa a los drawers/combate.
 */

import type React from 'react';
import type { RefObject } from 'react';
import type { GameState } from './types';
import type { Fighter } from './types';
import type { RoomState as ServerRoomState } from '../online/roomClient';
export interface RoomClientInstance {
  sendJoin: (name: string, isHost: boolean) => void;
  sendSelectChar: (charId: string) => void;
  sendSelectStage: (stageId: string) => void;
  sendStartFight: () => void;
  sendAdvanceToStageSelect: () => void;
  sendStateSync: (payload: import('../online/roomClient').FightSyncPayload) => void;
  sendInput: (payload: unknown) => void;
  subscribeToRoomState: (cb: (state: ServerRoomState) => void) => () => void;
  subscribeToStateSync: (cb: (payload: import('../online/roomClient').FightSyncPayload) => void) => () => void;
  subscribeToInput: (cb: (payload: unknown) => void) => () => void;
  close: () => void;
}

export interface GameLoopContextRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gameStateRef: RefObject<GameState>;
  selectedCharRef: RefObject<number>;
  cpuCharRef: RefObject<number>;
  selectedStageRef: RefObject<number>;
  modeSelectIndexRef: RefObject<number>;
  serverRoomStateRef: RefObject<ServerRoomState | null>;
  otherPlayerSlotIndexRef: RefObject<number | null>;
  roomClientRef: RefObject<RoomClientInstance | null>;
  isOnlineHostRef: RefObject<boolean>;
  onlineStageConfirmedRef: RefObject<boolean>;
  lastSentSlotRef: RefObject<number>;
  guestKeysRef: RefObject<{ left?: boolean; right?: boolean; up?: boolean; attack?: boolean }>;
  roundRef: RefObject<number>;
  scoreRef: RefObject<{ p1: number; p2: number }>;
  winnerNameRef: RefObject<string | null>;
  roundLoserRef: RefObject<Fighter | null>;
  playerRef: RefObject<Fighter | null>;
  cpuRef: RefObject<Fighter | null>;
  keys: RefObject<{ [key: string]: boolean }>;
  timer: RefObject<number>;
  frameCounter: RefObject<number>;
  inputCooldownRef: RefObject<number>;
  screenShakeRef: RefObject<number>;
  fightPausedRef: RefObject<boolean>;
  matchRegisteredRef: RefObject<boolean>;
  /** Modo Historia: personaje elegido por el jugador (índice). */
  storyPlayerCharRef: RefObject<number>;
  /** Modo Historia: nivel actual en la torre (0 = Eric, 5 = Diego Plaza). */
  storyTowerIndexRef: RefObject<number>;
  /** Modo Historia: true mientras el flujo es Historia (FIGHT puede ser story). */
  isStoryModeRef: RefObject<boolean>;
  /** En CHARACTER_SELECT: true si la confirmación lleva a STORY_TOWER. */
  isStoryCharSelectRef: RefObject<boolean>;
  /** STORY_TRANSITION: última cantidad de letras mostradas (para sonido por letra). */
  storyTransitionLetterCountRef: RefObject<number>;
  /** STORY_TOWER: offset Y de la animación de columna de oponentes (0 = inicio, >0 = avanzando). */
  storyTowerAnimOffsetYRef: RefObject<number>;
  mugshots: RefObject<Record<string, HTMLImageElement>>;
  homeBackground: RefObject<HTMLImageElement | null>;
  fightBackground: RefObject<HTMLImageElement | null>;
  menuBackground: RefObject<HTMLImageElement | null>;
  towerBackground: RefObject<HTMLImageElement | null>;
  stageBackgrounds: RefObject<(HTMLImageElement | null)[]>;
  anims: RefObject<Record<string, { idle: HTMLImageElement[]; walk: HTMLImageElement[]; attack: HTMLImageElement[] }>>;
}

export interface GameLoopContextSetters {
  setGameState: (s: GameState | ((prev: GameState) => GameState)) => void;
  setSelectedChar: React.Dispatch<React.SetStateAction<number>>;
  setCpuChar: React.Dispatch<React.SetStateAction<number>>;
  setSelectedStage: React.Dispatch<React.SetStateAction<number>>;
  setModeSelectIndex: React.Dispatch<React.SetStateAction<number>>;
  setLoadProgress: React.Dispatch<React.SetStateAction<number>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  setFightPaused: React.Dispatch<React.SetStateAction<boolean>>;
  setOnlinePlayerName: React.Dispatch<React.SetStateAction<string>>;
  setChallengeLink: React.Dispatch<React.SetStateAction<string>>;
  setServerRoomState: React.Dispatch<React.SetStateAction<ServerRoomState | null>>;
  setOtherPlayerSlotIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

export interface GameLoopContextConstants {
  ASSETS_BASE: string;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  GROUND_Y: number;
  MARGIN_X: number;
  CHAR_SELECT_SLOTS: number;
  STAGES: readonly { id: number; name: string; assetKey?: string; locked: boolean }[];
  CHARACTERS: readonly { id: number; name: string; color: string; locked: boolean; assetKey?: string }[];
  CHARACTER_STATS: readonly { attack: number; agility: number; stamina: number }[];
}

export interface GameLoopContextHelpers {
  getCharKey: (charId: number) => string;
  isValid: (img: HTMLImageElement | null) => img is HTMLImageElement;
  resetMatchState: () => void;
  /** Inicializa P1/P2 y resetea timer/frameCounter. Usado desde STAGE_SELECT y ROUND_RESULT. */
  initFighters: (pIdx: number, cIdx: number) => void;
}

export interface GameLoopContext extends GameLoopContextRefs, GameLoopContextSetters, GameLoopContextConstants, GameLoopContextHelpers {
  loadProgress: number;
  errorMessage: string;
  serverRoomState: ServerRoomState | null;
}
