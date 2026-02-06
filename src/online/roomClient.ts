/**
 * Cliente PartyKit: conexión WebSocket a la sala, envío de mensajes y suscripción a room_state.
 * El backend corre en el servidor PartyKit (ej. ws://127.0.0.1:1999/parties/room/ROOM_ID).
 */

export type RoomStatus = 'waiting' | 'char_select' | 'stage_select' | 'fighting';

export interface RoomState {
  hostId: string | null;
  guestId: string | null;
  hostName: string | null;
  guestName: string | null;
  hostChar: string | null;
  guestChar: string | null;
  stage: string | null;
  status: RoomStatus;
  /** true cuando el host pulsó "continuar" y el guest debe pasar a stage select */
  hostContinuedToStageSelect?: boolean;
}

const PARTYKIT_HOST = (() => {
  if (typeof import.meta === 'undefined') return 'http://127.0.0.1:1999';
  const env = (import.meta as { env?: { VITE_PARTYKIT_URL?: string; PROD?: boolean } }).env;
  const url = env?.VITE_PARTYKIT_URL;
  if (url) return url;
  if (env?.PROD) return 'https://maxxavelada-fight.tienvillalobos.partykit.dev';
  return 'http://127.0.0.1:1999';
})();

function partyKitWsUrl(roomId: string): string {
  const base = PARTYKIT_HOST.replace(/^http/, 'ws');
  return `${base}/party/${roomId}`;
}

type RoomStateCallback = (state: RoomState) => void;

export interface FightSyncPayload {
  phase: 'FIGHT' | 'ROUND_KO' | 'ROUND_RESULT' | 'GAME_OVER';
  p1: Record<string, unknown>;
  p2: Record<string, unknown>;
  timer: number;
  score: { p1: number; p2: number };
  round: number;
  winnerName?: string | null;
  frameCounter?: number;
}

export interface RoomClient {
  sendJoin(name: string, isHost: boolean): void;
  sendSelectChar(charId: string): void;
  sendSelectStage(stageId: string): void;
  sendStartFight(): void;
  sendAdvanceToStageSelect(): void;
  sendStateSync(payload: FightSyncPayload): void;
  sendInput(payload: unknown): void;
  subscribeToRoomState(cb: RoomStateCallback): () => void;
  subscribeToStateSync(cb: (payload: FightSyncPayload) => void): () => void;
  subscribeToInput(cb: (payload: unknown) => void): () => void;
  close(): void;
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed';
}

export function createRoomClient(roomId: string): RoomClient {
  const url = partyKitWsUrl(roomId);
  const ws = new WebSocket(url);
  const listeners: RoomStateCallback[] = [];
  const stateSyncListeners: ((payload: FightSyncPayload) => void)[] = [];
  const inputListeners: ((payload: unknown) => void)[] = [];
  let pendingJoin: { name: string; isHost: boolean } | null = null;

  function notifyState(state: RoomState) {
    listeners.forEach((cb) => cb(state));
  }

  ws.onopen = () => {
    if (pendingJoin) {
      ws.send(JSON.stringify({ type: 'join', name: pendingJoin.name, isHost: pendingJoin.isHost }));
      pendingJoin = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      if (data?.type === 'room_state' && data.state) {
        notifyState(data.state as RoomState);
      } else if (data?.type === 'state_sync' && data.payload) {
        stateSyncListeners.forEach((cb) => cb(data.payload as FightSyncPayload));
      } else if (data?.type === 'input' && data.payload !== undefined) {
        inputListeners.forEach((cb) => cb(data.payload));
      }
    } catch {
      // ignore non-JSON or other message types
    }
  };

  function send(msg: object) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  const client: RoomClient = {
    sendJoin(name: string, isHost: boolean) {
      if (ws.readyState === WebSocket.OPEN) {
        send({ type: 'join', name, isHost });
      } else {
        pendingJoin = { name, isHost };
      }
    },
    sendSelectChar(charId: string) {
      send({ type: 'select_char', charId });
    },
    sendSelectStage(stageId: string) {
      send({ type: 'select_stage', stageId });
    },
    sendStartFight() {
      send({ type: 'start_fight' });
    },
    sendAdvanceToStageSelect() {
      send({ type: 'advance_to_stage' });
    },
    sendStateSync(payload: FightSyncPayload) {
      send({ type: 'state_sync', payload });
    },
    sendInput(payload: unknown) {
      send({ type: 'input', payload });
    },
    subscribeToRoomState(cb: RoomStateCallback) {
      listeners.push(cb);
      return () => {
        const i = listeners.indexOf(cb);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
    subscribeToStateSync(cb: (payload: FightSyncPayload) => void) {
      stateSyncListeners.push(cb);
      return () => {
        const i = stateSyncListeners.indexOf(cb);
        if (i !== -1) stateSyncListeners.splice(i, 1);
      };
    },
    subscribeToInput(cb: (payload: unknown) => void) {
      inputListeners.push(cb);
      return () => {
        const i = inputListeners.indexOf(cb);
        if (i !== -1) inputListeners.splice(i, 1);
      };
    },
    close() {
      ws.close();
    },
    getConnectionState() {
      const s = ws.readyState;
      if (s === WebSocket.CONNECTING) return 'connecting';
      if (s === WebSocket.OPEN) return 'open';
      if (s === WebSocket.CLOSING) return 'closing';
      return 'closed';
    },
  };

  return client;
}

/** Genera un ID único para la sala (link de desafío). */
export function generateRoomId(): string {
  return crypto.randomUUID?.() ?? `room-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
