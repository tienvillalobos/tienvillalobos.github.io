import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { sounds } from './src/audio/SoundManager';
import {
  ASSETS_BASE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  MARGIN_X,
  CHAR_SELECT_SLOTS,
  STAGES,
  STAMINA_MAX,
  STAMINA_COST,
  STAMINA_REGEN,
  CHARACTERS,
  CHARACTER_STATS,
  STORY_TOWER_ORDER,
  getStoryDifficultyMultiplier,
} from './src/game/constants';
import type { GameState } from './src/game/types';
import type { Fighter } from './src/game/types';
import { initFighters as initFightersCombat } from './src/game/combat';
import { drawScreen } from './src/game/screens';
import type { GameLoopContext } from './src/game/loopContext';
import { loadAllAssets as loadAllAssetsFromLoader } from './src/assets/assetLoader';
import { OnlineNameOverlay, ChallengeLinkOverlay, PauseButton, PauseOverlay, GameOverOverlay } from './src/components';
import {
  createRoomClient,
  generateRoomId,
  type RoomState as ServerRoomState,
  type FightSyncPayload,
} from './src/online/roomClient';

const FighterApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('BOOT');
  const gameStateRef = useRef<GameState>('BOOT');
  const [selectedChar, setSelectedChar] = useState<number>(0);
  const selectedCharRef = useRef<number>(0);
  const [cpuChar, setCpuChar] = useState<number>(1);
  const cpuCharRef = useRef<number>(1);
  const [loadProgress, setLoadProgress] = useState(0);
  const loadProgressRef = useRef(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [fightPaused, setFightPaused] = useState(false);
  const fightPausedRef = useRef(false);
  const [selectedStage, setSelectedStage] = useState(0);
  const selectedStageRef = useRef(0);

  // Modo Local vs Online
  const [modeSelectIndex, setModeSelectIndex] = useState(0);
  const modeSelectIndexRef = useRef(0);
  // Online: nombre, link, estado de la sala (del servidor)
  const [onlinePlayerName, setOnlinePlayerName] = useState('');
  const [challengeLink, setChallengeLink] = useState('');
  const [serverRoomState, setServerRoomState] = useState<ServerRoomState | null>(null);
  const serverRoomStateRef = useRef<ServerRoomState | null>(null);
  const [otherPlayerSlotIndex, setOtherPlayerSlotIndex] = useState<number | null>(null); // slot sobre el que pasa el otro (tiempo real)
  const otherPlayerSlotIndexRef = useRef<number | null>(null);
  const roomClientRef = useRef<ReturnType<typeof createRoomClient> | null>(null);
  const isOnlineHostRef = useRef(false);
  const onlineStageConfirmedRef = useRef(false); // host: ya eligió stage, siguiente Space = start_fight
  const lastSentSlotRef = useRef<number>(-1); // para no enviar cursor si no cambió
  const guestKeysRef = useRef<{ left?: boolean; right?: boolean; up?: boolean; attack?: boolean }>({}); // host: inputs del guest para P2

  // Core Game Refs
  const roundRef = useRef(1);
  const scoreRef = useRef({ p1: 0, p2: 0 });
  const winnerNameRef = useRef<string | null>(null);
  const roundLoserRef = useRef<Fighter | null>(null);
  const playerRef = useRef<Fighter | null>(null);
  const cpuRef = useRef<Fighter | null>(null);
  const storyPlayerCharRef = useRef<number>(0);
  const storyTowerIndexRef = useRef<number>(-1);
  const isStoryModeRef = useRef<boolean>(false);
  const isStoryCharSelectRef = useRef<boolean>(false);
  const storyTransitionLetterCountRef = useRef<number>(0);
  const storyTowerAnimOffsetYRef = useRef<number>(999);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameLoopId = useRef<number>(0);
  const timer = useRef<number>(99);
  const frameCounter = useRef<number>(0);
  const inputCooldownRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  const matchRegisteredRef = useRef(false);

  // Asset Refs
  const mugshots = useRef<Record<string, HTMLImageElement>>({});
  const homeBackground = useRef<HTMLImageElement | null>(null);
  const fightBackground = useRef<HTMLImageElement | null>(null);
  const menuBackground = useRef<HTMLImageElement | null>(null);
  const towerBackground = useRef<HTMLImageElement | null>(null);
  const stageBackgrounds = useRef<(HTMLImageElement | null)[]>([]);
  const anims = useRef<Record<string, {
    idle: HTMLImageElement[];
    walk: HTMLImageElement[];
    attack: HTMLImageElement[];
  }>>({});

  useEffect(() => { 
    const prevState = gameStateRef.current;
    gameStateRef.current = gameState;
    inputCooldownRef.current = 20;
    if (gameState !== 'FIGHT') setFightPaused(false);
    if (gameState === 'STORY_TRANSITION') {
      frameCounter.current = 0;
      storyTransitionLetterCountRef.current = 0;
    }

    if (gameState === 'INTRO' || gameState === 'TITLE' || gameState === 'FIGHT' || gameState === 'ROUND_KO') {
      sounds.playMusic('fight');
    } else if (gameState === 'STORY_TOWER') {
      sounds.playMusic('tower');
    } else if (gameState === 'STORY_TRANSITION') {
      sounds.playMusic('stop');
    } else if (gameState === 'MAIN_MENU' || gameState === 'ONLINE_LINK' || gameState === 'CHARACTER_SELECT' || gameState === 'ONLINE_CHARS_READY' || gameState === 'STAGE_SELECT' || gameState === 'STORY_VICTORY' || gameState === 'STORY_GAME_OVER') {
      sounds.playMusic('menu');
      if (gameState === 'CHARACTER_SELECT' && prevState !== 'CHARACTER_SELECT') {
        sounds.playBuffer('menu_voice');
      }
    } else if (gameState === 'STOP') {
      sounds.playMusic('stop');
    }
  }, [gameState]);

  useEffect(() => {
    selectedCharRef.current = selectedChar;
  }, [selectedChar]);

  useEffect(() => {
    cpuCharRef.current = cpuChar;
  }, [cpuChar]);

  useEffect(() => {
    fightPausedRef.current = fightPaused;
  }, [fightPaused]);

  useEffect(() => {
    selectedStageRef.current = selectedStage;
  }, [selectedStage]);

  useEffect(() => {
    modeSelectIndexRef.current = modeSelectIndex;
  }, [modeSelectIndex]);

  useEffect(() => {
    serverRoomStateRef.current = serverRoomState;
  }, [serverRoomState]);

  useEffect(() => {
    otherPlayerSlotIndexRef.current = otherPlayerSlotIndex;
  }, [otherPlayerSlotIndex]);

  const isValid = (img: HTMLImageElement | null): img is HTMLImageElement => {
    return !!(img && img.complete && img.naturalWidth > 0);
  };

  const getCharKey = (charId: number): string => {
    const c = CHARACTERS[charId];
    return c ? (c.assetKey ?? c.name.toLowerCase().replace(/\s+/g, '_')) : 'eric';
  };

  const resetMatchState = () => {
    scoreRef.current = { p1: 0, p2: 0 };
    roundRef.current = 1;
    winnerNameRef.current = null;
    frameCounter.current = 0;
    screenShakeRef.current = 0;
    matchRegisteredRef.current = false;
  };

  const loadAllAssets = () => {
    loadProgressRef.current = 0;
    loadAllAssetsFromLoader({
      setLoadProgress,
      setErrorMessage,
      setGameState,
      loadProgressRef,
      assetRefs: {
        homeBackground,
        menuBackground,
        fightBackground,
        towerBackground,
        stageBackgrounds,
        mugshots,
        anims,
      },
      onComplete: (initialState) => {
        if (initialState === 'ONLINE_NAME') isOnlineHostRef.current = false;
        setGameState(initialState);
      },
    });
  };

  useEffect(() => {
    if (gameState === 'BOOT') loadAllAssets();
  }, []);

  // Suscribirse al estado de la sala durante todo el flujo online (si solo fuera ONLINE_LINK, al pasar a CHARACTER_SELECT nos desuscribíamos y no recibíamos stage_select)
  useEffect(() => {
    const onlineStates: GameState[] = ['ONLINE_LINK', 'CHARACTER_SELECT', 'ONLINE_CHARS_READY', 'STAGE_SELECT', 'FIGHT', 'ROUND_KO', 'ROUND_RESULT', 'GAME_OVER'];
    if (!onlineStates.includes(gameState) || !roomClientRef.current) return;
    const client = roomClientRef.current;
    const unsub = client.subscribeToRoomState((state) => setServerRoomState(state));
    return () => {
      unsub();
    };
  }, [gameState]);

  // Cerrar el cliente solo cuando salimos de la pantalla online (no en el cleanup del efecto anterior)
  useEffect(() => {
    if (gameState !== 'ONLINE_LINK' && gameState !== 'CHARACTER_SELECT' && gameState !== 'ONLINE_CHARS_READY' && gameState !== 'STAGE_SELECT' && gameState !== 'FIGHT' && gameState !== 'ROUND_KO' && gameState !== 'ROUND_RESULT' && gameState !== 'GAME_OVER') {
      if (roomClientRef.current) {
        roomClientRef.current.close();
        roomClientRef.current = null;
      }
    }
  }, [gameState]);

  const STATS_API_BASE = (import.meta as { env?: { VITE_STATS_API_URL?: string } }).env?.VITE_STATS_API_URL ?? 'https://maxxavelada-backend.onrender.com';
  const STATS_REGISTER_TIMEOUT_MS = 60000;

  useEffect(() => {
    if (gameState !== 'GAME_OVER' || matchRegisteredRef.current) return;
    const isOnline = !!roomClientRef.current;
    if (isOnline && !isOnlineHostRef.current) return;
    const p1 = playerRef.current;
    const p2 = cpuRef.current;
    const winnerName = winnerNameRef.current;
    const score = scoreRef.current;
    const room = serverRoomStateRef.current;
    const stageIdx = selectedStageRef.current;
    const stageName = STAGES[Math.min(stageIdx, STAGES.length - 1)]?.name ?? null;

    const player1_name = (isOnline && room?.hostName) ? room.hostName : (p1?.name ?? 'P1');
    const player2_name = isOnline ? (room?.guestName ?? p2?.name ?? 'P2') : 'CPU';
    const winner = (winnerName === p1?.name || winnerName === room?.hostName) ? 'p1' : 'p2';

    matchRegisteredRef.current = true;
    const payload = {
      player1_name,
      player2_name,
      winner,
      score_p1: score.p1,
      score_p2: score.p2,
      stage: stageName,
      character_p1: p1?.name ?? null,
      character_p2: p2?.name ?? null,
      mode: isOnline ? 'online' : 'local',
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STATS_REGISTER_TIMEOUT_MS);
    fetch(`${STATS_API_BASE}/api/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(() => clearTimeout(timeoutId))
      .catch(() => clearTimeout(timeoutId));
  }, [gameState]);

  // Transición ONLINE_LINK -> CHARACTER_SELECT cuando ambos están y el servidor pasa a char_select
  useEffect(() => {
    if (serverRoomState?.status === 'char_select' && gameState === 'ONLINE_LINK') {
      setGameState('CHARACTER_SELECT');
      setOtherPlayerSlotIndex(null);
      lastSentSlotRef.current = -1;
    }
  }, [serverRoomState?.status, gameState]);

  // Enviar en tiempo real el slot sobre el que pasamos (para que el otro vea el preview tipo Smash)
  useEffect(() => {
    if (gameState !== 'CHARACTER_SELECT' || !roomClientRef.current) return;
    const slot = selectedCharRef.current;
    if (slot === lastSentSlotRef.current) return;
    lastSentSlotRef.current = slot;
    roomClientRef.current.sendInput({ slotIndex: slot });
  }, [gameState, selectedChar]);

  // Recibir el slot del otro jugador en tiempo real (solo en char select online)
  useEffect(() => {
    if (gameState !== 'CHARACTER_SELECT' || !roomClientRef.current) return;
    const client = roomClientRef.current;
    const unsub = client.subscribeToInput((payload: unknown) => {
      const p = payload as { slotIndex?: number };
      if (p != null && typeof p.slotIndex === 'number') {
        const idx = Math.min(CHAR_SELECT_SLOTS - 1, Math.max(0, p.slotIndex));
        setOtherPlayerSlotIndex(idx);
      }
    });
    return unsub;
  }, [gameState]);

  // Transición cuando ambos eligieron: solo el host va a ONLINE_CHARS_READY; el guest se queda en CHARACTER_SELECT hasta que el host pulse Space
  useEffect(() => {
    if (!serverRoomState || serverRoomState.status !== 'stage_select' || gameState !== 'CHARACTER_SELECT' || !roomClientRef.current) return;
    const oppChar = isOnlineHostRef.current ? serverRoomState.guestChar : serverRoomState.hostChar;
    const oppIdx = oppChar != null ? parseInt(String(oppChar), 10) : 0;
    if (!Number.isNaN(oppIdx)) {
      setCpuChar(oppIdx);
      cpuCharRef.current = oppIdx;
    }
    onlineStageConfirmedRef.current = false;
    if (isOnlineHostRef.current) {
      setGameState('ONLINE_CHARS_READY');
    }
    // guest se queda en CHARACTER_SELECT y verá "Esperando al host" hasta recibir hostContinuedToStageSelect
  }, [serverRoomState, gameState]);

  // Guest: pasar a STAGE_SELECT cuando el host pulse "continuar" (backend envía hostContinuedToStageSelect)
  // o cuando el host ya eligió etapa (stage != null), por si el backend no implementa advance_to_stage
  useEffect(() => {
    if (gameState !== 'CHARACTER_SELECT' || !roomClientRef.current || isOnlineHostRef.current) return;
    const room = serverRoomState;
    const shouldAdvance = room?.hostContinuedToStageSelect || (room?.status === 'stage_select' && room?.stage != null);
    if (!shouldAdvance) return;
    const oppChar = room?.hostChar;
    const oppIdx = oppChar != null ? parseInt(String(oppChar), 10) : 0;
    if (!Number.isNaN(oppIdx)) {
      setCpuChar(oppIdx);
      cpuCharRef.current = oppIdx;
    }
    setGameState('STAGE_SELECT');
  }, [serverRoomState, gameState]);

  // Transición STAGE_SELECT -> FIGHT cuando el host inicia la pelea
  useEffect(() => {
    if (serverRoomState?.status !== 'fighting' || gameState !== 'STAGE_SELECT' || !roomClientRef.current) return;
    const stageId = serverRoomState.stage != null ? parseInt(serverRoomState.stage, 10) : 0;
    const stageIdx = Number.isNaN(stageId) ? 0 : Math.min(Math.max(0, stageId), STAGES.length - 1);
    const bg = stageBackgrounds.current[stageIdx];
    fightBackground.current = bg && isValid(bg) ? bg : null;
    resetMatchState();
    guestKeysRef.current = {};
    initFighters(selectedCharRef.current, cpuCharRef.current);
    setGameState('FIGHT');
  }, [serverRoomState?.status, serverRoomState?.stage, gameState]);

  // Guest: suscribirse a state_sync durante la pelea para recibir estado del host
  useEffect(() => {
    if (gameState !== 'FIGHT' && gameState !== 'ROUND_KO' && gameState !== 'ROUND_RESULT' && gameState !== 'GAME_OVER') return;
    const client = roomClientRef.current;
    if (!client || isOnlineHostRef.current) return;
    const unsub = client.subscribeToStateSync(applyFightSync);
    return unsub;
  }, [gameState]);

  // Host: suscribirse a input del guest durante la pelea para controlar P2
  useEffect(() => {
    if (gameState !== 'FIGHT' && gameState !== 'ROUND_KO') return;
    const client = roomClientRef.current;
    if (!client || !isOnlineHostRef.current) return;
    const unsub = client.subscribeToInput((payload: unknown) => {
      const p = payload as { left?: boolean; right?: boolean; up?: boolean; attack?: boolean };
      if (p && typeof p === 'object') guestKeysRef.current = { left: !!p.left, right: !!p.right, up: !!p.up, attack: !!p.attack };
    });
    return unsub;
  }, [gameState]);

  const handleOnlineSubmit = () => {
    const name = onlinePlayerName.trim();
    if (!name) return;
    const isHost = isOnlineHostRef.current;
    const roomId = isHost ? generateRoomId() : new URLSearchParams(window.location.search).get('room') ?? '';
    if (!roomId && !isHost) return;
    const client = createRoomClient(roomId);
    roomClientRef.current = client;
    client.sendJoin(name, isHost);
    if (isHost) {
      const base = window.location.origin + window.location.pathname;
      const link = `${base}?room=${roomId}`;
      setChallengeLink(link);
    }
    setGameState('ONLINE_LINK');
  };

  const handleCopyLink = () => {
    if (challengeLink) {
      navigator.clipboard.writeText(challengeLink);
      sounds.playSFX('select');
    }
  };

  const applyFightSync = (payload: FightSyncPayload) => {
    playerRef.current = payload.p1 as unknown as Fighter;
    cpuRef.current = payload.p2 as unknown as Fighter;
    timer.current = payload.timer;
    scoreRef.current = { ...payload.score };
    roundRef.current = payload.round;
    winnerNameRef.current = payload.winnerName ?? null;
    if (payload.frameCounter != null) frameCounter.current = payload.frameCounter;
    if (payload.phase === 'ROUND_KO' && payload.winnerName) {
      const p1 = payload.p1 as unknown as Fighter;
      roundLoserRef.current = payload.winnerName === p1.name ? (payload.p2 as unknown as Fighter) : p1;
    }
    if (payload.phase !== gameStateRef.current) setGameState(payload.phase);
  };

  const initFighters = (pIdx: number, cIdx: number) => {
    const opts = isStoryModeRef.current
      ? { cpuStatMultiplier: getStoryDifficultyMultiplier(storyTowerIndexRef.current) }
      : undefined;
    initFightersCombat(pIdx, cIdx, {
      playerRef,
      cpuRef,
      timer,
      frameCounter,
      screenShakeRef,
    }, opts);
  };

  const loop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) { gameLoopId.current = requestAnimationFrame(loop); return; }
    
    const state = gameStateRef.current;
    if (inputCooldownRef.current > 0) inputCooldownRef.current--;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();
    
    // Aplicar Screen Shake
    if (screenShakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * screenShakeRef.current;
      const sy = (Math.random() - 0.5) * screenShakeRef.current;
      ctx.translate(sx, sy);
      screenShakeRef.current *= 0.9;
      if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
    }

    const context: GameLoopContext = {
      canvasRef,
      gameStateRef,
      selectedCharRef,
      cpuCharRef,
      selectedStageRef,
      modeSelectIndexRef,
      serverRoomStateRef,
      otherPlayerSlotIndexRef,
      roomClientRef,
      isOnlineHostRef,
      onlineStageConfirmedRef,
      lastSentSlotRef,
      guestKeysRef,
      roundRef,
      scoreRef,
      winnerNameRef,
      roundLoserRef,
      playerRef,
      cpuRef,
      storyPlayerCharRef,
      storyTowerIndexRef,
      isStoryModeRef,
      isStoryCharSelectRef,
      storyTransitionLetterCountRef,
      storyTowerAnimOffsetYRef,
      keys,
      timer,
      frameCounter,
      inputCooldownRef,
      screenShakeRef,
      fightPausedRef,
      matchRegisteredRef,
      mugshots,
      homeBackground,
      fightBackground,
      menuBackground,
      towerBackground,
      stageBackgrounds,
      anims,
      setGameState,
      setSelectedChar,
      setCpuChar,
      setSelectedStage,
      setModeSelectIndex,
      setLoadProgress,
      setErrorMessage,
      setFightPaused,
      setOnlinePlayerName,
      setChallengeLink,
      setServerRoomState,
      setOtherPlayerSlotIndex,
      ASSETS_BASE,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      GROUND_Y,
      MARGIN_X,
      CHAR_SELECT_SLOTS,
      STAGES,
      CHARACTERS,
      CHARACTER_STATS,
      getCharKey,
      isValid,
      resetMatchState,
      initFighters,
      loadProgress: loadProgressRef.current,
      errorMessage,
      serverRoomState: serverRoomStateRef.current ?? serverRoomState,
    };
    drawScreen(state, ctx, context);
    ctx.restore();
    gameLoopId.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    gameLoopId.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(gameLoopId.current);
      sounds.playMusic('stop');
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      {gameState === 'ONLINE_NAME' && (
        <OnlineNameOverlay
          onSubmit={handleOnlineSubmit}
          playerName={onlinePlayerName}
          onNameChange={setOnlinePlayerName}
          isHost={isOnlineHostRef.current}
          assetsBase={ASSETS_BASE}
        />
      )}
      {gameState === 'ONLINE_LINK' && (
        <ChallengeLinkOverlay
          challengeLink={challengeLink}
          onCopy={handleCopyLink}
          statusText={
            serverRoomState?.guestId != null || serverRoomState?.status === 'char_select'
              ? '¡Listo! (Próximo: selección de personajes)'
              : isOnlineHostRef.current
                ? 'Esperando oponente...'
                : 'Conectado. Esperando al host...'
          }
          assetsBase={ASSETS_BASE}
        />
      )}
      {gameState === 'FIGHT' && !fightPaused && !roomClientRef.current && (
        <PauseButton onPause={() => setFightPaused(true)} />
      )}
      {gameState === 'FIGHT' && fightPaused && !roomClientRef.current && (
        <PauseOverlay
          onResume={() => setFightPaused(false)}
          onQuitToCharacterSelect={() => {
            setFightPaused(false);
            setGameState('CHARACTER_SELECT');
          }}
        />
      )}
      {gameState === 'GAME_OVER' && (
        <GameOverOverlay
          onBackToMenu={() => {
            sounds.playSFX('select');
            setGameState('TITLE');
            resetMatchState();
          }}
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<FighterApp />);
