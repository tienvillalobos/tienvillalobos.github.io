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
} from './src/game/constants';
import type { GameState } from './src/game/types';
import type { Fighter } from './src/game/types';
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

    if (gameState === 'INTRO' || gameState === 'TITLE' || gameState === 'FIGHT' || gameState === 'ROUND_KO') {
      sounds.playMusic('fight');
    } else if (gameState === 'MAIN_MENU' || gameState === 'ONLINE_LINK' || gameState === 'CHARACTER_SELECT' || gameState === 'ONLINE_CHARS_READY' || gameState === 'STAGE_SELECT') {
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

  const resetMatchState = () => {
    scoreRef.current = { p1: 0, p2: 0 };
    roundRef.current = 1;
    winnerNameRef.current = null;
    frameCounter.current = 0;
    screenShakeRef.current = 0;
    matchRegisteredRef.current = false;
  };

  const loadAllAssets = async () => {
    setGameState('LOADING');
    setErrorMessage("");
    try {
      sounds.init();

      const soundNames = ['menu', 'fight', 'ko', 'menu_voice'];
      for (const name of soundNames) {
        const res = await fetch(`${ASSETS_BASE}/sounds/${name}.ogg`);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          await sounds.loadBuffer(name, ab);
        }
      }

      const totalFrames = 36;
      const categories = ['idle', 'walk', 'attack'];
      const playableChars = ['eric', 'david', 'jostin', 'manu'];
      const totalToLoad = (playableChars.length * 3 * 36) + playableChars.length + 5;
      let loadedCount = 0;

      const getImg = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { loadedCount++; setLoadProgress(Math.floor((loadedCount / totalToLoad) * 100)); resolve(img); };
          img.onerror = () => { loadedCount++; setLoadProgress(Math.floor((loadedCount / totalToLoad) * 100)); resolve(img); };
          img.src = url;
        });
      };

      homeBackground.current = await getImg(`${ASSETS_BASE}/backgrounds/home.png`);
      menuBackground.current = await getImg(`${ASSETS_BASE}/backgrounds/menu.png`);
      stageBackgrounds.current = [
        await getImg(`${ASSETS_BASE}/backgrounds/stages/arena.png`),
        await getImg(`${ASSETS_BASE}/backgrounds/stages/coffee_room.png`),
        await getImg(`${ASSETS_BASE}/backgrounds/stages/lobby.png`),
        null, null, null,
      ];

      for (const charName of playableChars) {
        mugshots.current[charName] = await getImg(`${ASSETS_BASE}/characters/${charName}/mugshot.png`);
        anims.current[charName] = { idle: [], walk: [], attack: [] };
        for (const cat of categories) {
          const promises = [];
          for (let i = 1; i <= totalFrames; i++) {
            const f = i.toString().padStart(3, '0');
            promises.push(getImg(`${ASSETS_BASE}/characters/${charName}/${cat}/frame_${f}.png`));
          }
          const results = await Promise.all(promises);
          anims.current[charName][cat as keyof typeof anims.current[string]] = results.filter(img => isValid(img));
        }
      }
      // Si entró por link de desafío (?room=...), ir directo al input de nombre
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (params.get('room')) {
        isOnlineHostRef.current = false;
        setGameState('ONLINE_NAME');
      } else {
        setGameState('INTRO');
      }
    } catch (e) {
      console.error("Error cargando assets:", e);
      setErrorMessage("Error al cargar assets desde /assets/");
      setGameState('ERROR');
    }
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
    const player2_name = (isOnline && room?.guestName) ? room.guestName : (p2?.name ?? 'P2');
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
    playerRef.current = {
      x: 100, y: GROUND_Y, width: 220, height: 220, hp: 100, maxHp: 100,
      direction: 1, state: 'IDLE', animFrame: 0, animTimer: 0,
      velocityX: 0, velocityY: 0, isAttacking: false, stamina: STAMINA_MAX, maxStamina: STAMINA_MAX,
      color: CHARACTERS[pIdx].color, name: CHARACTERS[pIdx].name, charId: pIdx
    };
    cpuRef.current = {
      x: 480, y: GROUND_Y, width: 220, height: 220, hp: 100, maxHp: 100,
      direction: -1, state: 'IDLE', animFrame: 0, animTimer: 0,
      velocityX: 0, velocityY: 0, isAttacking: false, stamina: STAMINA_MAX, maxStamina: STAMINA_MAX,
      color: CHARACTERS[cIdx].color, name: CHARACTERS[cIdx].name, charId: cIdx
    };
    timer.current = 99;
    frameCounter.current = 0;
    screenShakeRef.current = 0;
    sounds.playSFX('start');
  };

  type CombatControl = 'player' | 'cpu' | 'remote';

  const updateCombat = (f: Fighter, opp: Fighter, control: CombatControl) => {
    if (f.y < GROUND_Y) { f.velocityY += 0.9; f.state = 'JUMP'; }
    else { f.y = GROUND_Y; f.velocityY = 0; if (f.state === 'JUMP') f.state = 'IDLE'; }

    const canAct = frameCounter.current >= 120;
    const isPlayer = control === 'player';
    const isCpu = control === 'cpu';
    const isRemote = control === 'remote';
    const remoteKeys = guestKeysRef.current;

    if (isPlayer && canAct) {
      if (!f.isAttacking && f.state !== 'HIT') {
        if (keys.current['KeyA'] || keys.current['ArrowLeft']) { f.velocityX = -4; f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP'; f.direction = -1; }
        else if (keys.current['KeyD'] || keys.current['ArrowRight']) { f.velocityX = 4; f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP'; f.direction = 1; }
        else { f.velocityX = 0; if (f.y === GROUND_Y) f.state = 'IDLE'; }
        if ((keys.current['KeyW'] || keys.current['ArrowUp']) && f.y === GROUND_Y) f.velocityY = -15;
        if ((keys.current['Space'] || keys.current['KeyK']) && f.stamina >= STAMINA_COST) {
          f.stamina -= STAMINA_COST;
          f.isAttacking = true; f.state = 'ATTACK'; f.animFrame = 0;
          sounds.playSFX('attack');
        }
      }
    } else if (isRemote && canAct) {
      if (!f.isAttacking && f.state !== 'HIT') {
        if (remoteKeys.left) { f.velocityX = -4; f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP'; f.direction = -1; }
        else if (remoteKeys.right) { f.velocityX = 4; f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP'; f.direction = 1; }
        else { f.velocityX = 0; if (f.y === GROUND_Y) f.state = 'IDLE'; }
        if (remoteKeys.up && f.y === GROUND_Y) f.velocityY = -15;
        if (remoteKeys.attack && f.stamina >= STAMINA_COST) {
          f.stamina -= STAMINA_COST;
          f.isAttacking = true; f.state = 'ATTACK'; f.animFrame = 0;
          sounds.playSFX('attack');
        }
      }
    } else if (isCpu && canAct) {
      const dist = Math.abs(f.x - opp.x);
      if (!f.isAttacking && f.state !== 'HIT') {
        if (dist > 180) { f.velocityX = f.x < opp.x ? 2.5 : -2.5; f.direction = f.x < opp.x ? 1 : -1; f.state = 'WALK'; }
        else { f.velocityX = 0; f.state = 'IDLE'; if (Math.random() < 0.05 && f.stamina >= STAMINA_COST) { f.stamina -= STAMINA_COST; f.isAttacking = true; f.state = 'ATTACK'; f.animFrame = 0; sounds.playSFX('attack'); } }
      }
    } else { f.velocityX = 0; }

    f.x += f.velocityX; f.y += f.velocityY;
    if (f.x < MARGIN_X) f.x = MARGIN_X; if (f.x > CANVAS_WIDTH - MARGIN_X - f.width) f.x = CANVAS_WIDTH - MARGIN_X - f.width;
    f.animTimer++;
    if (f.animTimer >= (f.state === 'ATTACK' ? 1 : 2)) { f.animFrame++; f.animTimer = 0; }

    if (f.isAttacking) {
      if (f.animFrame >= 36) { f.isAttacking = false; f.state = 'IDLE'; f.animFrame = 0; }
      if (f.animFrame >= 15 && f.animFrame <= 25 && f.animTimer === 0) {
        const hitX = f.direction === 1 ? f.x + f.width - 90 : f.x + 40;
        if (hitX < opp.x + opp.width - 60 && hitX + 50 > opp.x + 60 && f.y < opp.y + opp.height && f.y + 120 > opp.y) {
          if (opp.state !== 'HIT') { 
            opp.hp -= 10; opp.state = 'HIT'; opp.animFrame = 0; opp.velocityX = f.direction * 8; 
            screenShakeRef.current = 10;
            sounds.playSFX('hit');
          }
        }
      }
    } else if (f.state === 'HIT') { if (f.animFrame >= 15) { f.state = 'IDLE'; f.animFrame = 0; f.velocityX = 0; } } 
    else { if (f.animFrame >= 36) f.animFrame = 0; }
    // Regenerar stamina (no mientras ataca)
    if (!f.isAttacking && f.stamina < f.maxStamina) {
      f.stamina = Math.min(f.maxStamina, f.stamina + STAMINA_REGEN);
    }
  };

  const drawFighter = (ctx: CanvasRenderingContext2D, f: Fighter) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(f.x + f.width/2, f.y + f.height - 5, f.width/3, 6, 0, 0, Math.PI*2); ctx.fill();
    
    const charName = f.name.toLowerCase();
    const charAnims = anims.current[charName];
    if (!charAnims) { ctx.restore(); return; }

    let frames = charAnims.idle;
    if (f.state === 'ATTACK') frames = charAnims.attack;
    else if (f.state === 'WALK') frames = charAnims.walk;
    
    const img = frames[f.animFrame % frames.length];
    if (isValid(img)) {
      ctx.translate(f.x + f.width / 2, f.y + f.height / 2);
      if (f.direction === -1) ctx.scale(-1, 1);
      if (f.state === 'HIT') { ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*5); ctx.filter = 'brightness(2) contrast(1.2)'; }
      ctx.drawImage(img, -f.width/2, -f.height/2, f.width, f.height);
    }
    ctx.restore();
  };

  const drawFighterFallen = (ctx: CanvasRenderingContext2D, f: Fighter) => {
    const charName = f.name.toLowerCase();
    const charAnims = anims.current[charName];
    if (!charAnims) return;
    const frames = charAnims.idle;
    const img = frames[f.animFrame % frames.length];
    if (!isValid(img)) return;
    ctx.save();
    const cx = f.x + f.width / 2;
    const cy = GROUND_Y + f.height/4 + f.width/1.5;
    ctx.translate(cx, cy);
    if (f.direction === -1) ctx.scale(-1, 1);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -f.width/2, -f.height/2, f.width, f.height);
    ctx.restore();
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

    if (state === 'BOOT') {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#0f0'; ctx.font = '12px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText("SYSTEM BOOTING...", CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    } else if (state === 'ERROR') {
      ctx.fillStyle = '#111'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#f00'; ctx.font = '14px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText("FATAL ASSET ERROR", CANVAS_WIDTH/2, 180);
      ctx.font = '10px "Press Start 2P"'; ctx.fillStyle = '#888';
      ctx.fillText(errorMessage || "CHECK ASSETS.ZIP FILE", CANVAS_WIDTH/2, 220);
    } else if (state === 'LOADING') {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; ctx.font = '14px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText(`LOADING ASSETS... ${loadProgress}%`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    } else if (state === 'INTRO') {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; ctx.font = '14px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText("La Maxxa Velada comienza...".slice(0, Math.floor(frameCounter.current/3)), CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      frameCounter.current++;
      if (frameCounter.current > 140) { setGameState('TITLE'); frameCounter.current = 0; }
    } else if (state === 'TITLE') {
      if (isValid(homeBackground.current)) {
        ctx.drawImage(homeBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else { ctx.fillStyle = '#000'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }
      
      ctx.fillStyle = '#fff'; 
      ctx.font = '12px "Press Start 2P"';
      ctx.textAlign = 'center';
      if (Math.floor(Date.now() / 600) % 2 === 0) ctx.fillText("PRESS SPACE TO START", CANVAS_WIDTH/2, 350);
      
      if (inputCooldownRef.current === 0 && (keys.current['Space'] || keys.current['Enter'])) {
        sounds.init();
        sounds.playSFX('select');
        setGameState('MAIN_MENU');
      }
    } else if (state === 'MAIN_MENU') {
      if (isValid(menuBackground.current)) ctx.drawImage(menuBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#0a192f'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); }
      const boxW = 320;
      const boxH = 56;
      const gap = 20;
      const totalH = 3 * boxH + 2 * gap;
      const startY = (CANVAS_HEIGHT - totalH) / 2;
      const labels = ['Jugador', 'Multijugador', 'HISTORIA'];
      const faIcons = ['\uF007', '\uF0C0', null];
      const idx = modeSelectIndexRef.current;
      const iconSize = 20;
      const iconGap = 10;
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) {
        const x = (CANVAS_WIDTH - boxW) / 2;
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
      ctx.fillText("ARROWS + SPACE/ENTER", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 24);
      frameCounter.current++;
      if (frameCounter.current > 10) {
        let changed = false;
        if (keys.current['ArrowDown']) { setModeSelectIndex((p) => (p + 1) % 3); changed = true; }
        else if (keys.current['ArrowUp']) { setModeSelectIndex((p) => (p - 1 + 3) % 3); changed = true; }
        if (changed) { frameCounter.current = 0; sounds.playSFX('select'); }
      }
      if (inputCooldownRef.current === 0 && (keys.current['Space'] || keys.current['Enter'])) {
        if (idx === 0) {
          sounds.playSFX('select');
          setGameState('CHARACTER_SELECT');
        } else if (idx === 1) {
          sounds.playSFX('select');
          const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          const roomFromUrl = params.get('room');
          if (roomFromUrl) {
            isOnlineHostRef.current = false;
            setGameState('ONLINE_NAME');
          } else {
            isOnlineHostRef.current = true;
            setOnlinePlayerName('');
            setChallengeLink('');
            setServerRoomState(null);
            setGameState('ONLINE_NAME');
          }
        }
      }
    } else if (state === 'ONLINE_NAME' || state === 'ONLINE_LINK') {
      ctx.fillStyle = '#0a192f';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = '12px "Press Start 2P"';
      ctx.textAlign = 'center';
      if (state === 'ONLINE_NAME') ctx.fillText("INGRESA TU NOMBRE", CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 40);
      // ONLINE_LINK: el resto se ve en el overlay (link, copiar, esperando)
    } else if (state === 'CHARACTER_SELECT') {
      if (isValid(menuBackground.current)) ctx.drawImage(menuBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#0a192f'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }
      const size = 90; const margin = 20; const gridX = (CANVAS_WIDTH - (4*size + 3*margin))/2;
      const gridTopY = 110;
      const charsInSelect = CHARACTERS.slice(0, CHAR_SELECT_SLOTS);
      const selectedIdx = Math.min(selectedCharRef.current, CHAR_SELECT_SLOTS - 1);
      const mugPad = 5; const mugSize = size - mugPad * 2;
      const isOnlineChar = !!roomClientRef.current;
      const P1_COLOR = '#EF4444';
      const P2_COLOR = '#4285F4';
      const room = serverRoomStateRef.current;
      const isHost = isOnlineHostRef.current;
      const hasConfirmed = isOnlineChar && room && (isHost ? room.hostChar != null : room.guestChar != null);
      const otherName = room ? (isHost ? room.guestName : room.hostName) : null;

      charsInSelect.forEach((c, i) => {
        const x = gridX + (i % 4) * (size + margin); const y = gridTopY + Math.floor(i / 4) * (size + margin);
        ctx.fillStyle = c.locked ? '#050a14' : '#172a45';
        ctx.fillRect(x, y, size, size);

        if (!c.locked) {
          const mug = mugshots.current[c.name.toLowerCase()];
          const mx = x + mugPad; const my = y + mugPad;
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(mx, my, mugSize, mugSize);
          if (isValid(mug)) {
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.drawImage(mug, mx, my, mugSize, mugSize);
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
          }
        } else {
          ctx.fillStyle = '#444'; ctx.font = '30px "Press Start 2P"'; ctx.textAlign = 'center';
          ctx.fillText("?", x + size/2, y + size/2 + 10);
        }

        let slotStroke = c.locked ? '#444' : '#ffd700';
        let slotLineWidth = c.locked ? 2 : 4;
        if (i === selectedIdx && !isOnlineChar) { slotStroke = '#f00'; slotLineWidth = 6; }
        else if (i === selectedIdx && isOnlineChar) { slotStroke = isOnlineHostRef.current ? P1_COLOR : P2_COLOR; slotLineWidth = 6; }
        if (isOnlineChar && room) {
          if (room.hostChar === String(i)) { slotStroke = P1_COLOR; slotLineWidth = 5; }
          else if (room.guestChar === String(i)) { slotStroke = P2_COLOR; slotLineWidth = 5; }
        }
        ctx.strokeStyle = slotStroke;
        ctx.lineWidth = slotLineWidth;
        ctx.strokeRect(x, y, size, size);
        if (isOnlineChar && room) {
          ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center';
          if (room.hostChar === String(i) && room.hostName) {
            ctx.fillStyle = P1_COLOR;
            ctx.fillText(`P1 ${room.hostName}`, x + size/2, y + size - 4);
          } else if (room.guestChar === String(i) && room.guestName) {
            ctx.fillStyle = P2_COLOR;
            ctx.fillText(`P2 ${room.guestName}`, x + size/2, y + size - 4);
          }
        }
      });

      const currentChar = CHARACTERS[selectedIdx];
      const leftPreviewX = 24; const leftPreviewY = 130; const leftPreviewSize = 140;
      const previewOuter = leftPreviewSize + 8;
      if (!currentChar.locked) {
        const charAnims = anims.current[currentChar.name.toLowerCase()];
        const idle0 = charAnims?.idle?.[0];
        if (idle0 && isValid(idle0)) {
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
          ctx.strokeStyle = isOnlineChar ? (isOnlineHostRef.current ? P1_COLOR : P2_COLOR) : currentChar.color;
          ctx.lineWidth = 3;
          ctx.strokeRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
          ctx.drawImage(idle0, leftPreviewX, leftPreviewY, leftPreviewSize, leftPreviewSize);
        }
      } else {
        ctx.fillStyle = '#050a14';
        ctx.fillRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 3;
        ctx.strokeRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
        ctx.fillStyle = '#444'; ctx.font = '48px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillText("?", leftPreviewX + leftPreviewSize/2, leftPreviewY + leftPreviewSize/2 + 16);
      }

      const cardX = 618; const cardY = 95; const cardW = 168; const cardH = 260;
      if (isOnlineChar && room) {
        const otherName = isOnlineHostRef.current ? room.guestName : room.hostName;
        const otherLabel = isOnlineHostRef.current ? 'P2' : 'P1';
        const otherColor = isOnlineHostRef.current ? P2_COLOR : P1_COLOR;
        ctx.fillStyle = 'rgba(23, 42, 69, 0.95)';
        ctx.strokeStyle = otherColor;
        ctx.lineWidth = 3;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        const otherConfirmed = isOnlineHostRef.current ? room.guestChar : room.hostChar;
        const confirmedIdx = otherConfirmed != null ? parseInt(String(otherConfirmed), 10) : null;
        const cursorIdx = otherPlayerSlotIndexRef.current != null ? Math.min(CHAR_SELECT_SLOTS - 1, Math.max(0, otherPlayerSlotIndexRef.current)) : null;
        const slotIdx = (confirmedIdx != null && !Number.isNaN(confirmedIdx) ? confirmedIdx : cursorIdx);
        if (slotIdx != null && CHARACTERS[slotIdx] && !CHARACTERS[slotIdx].locked) {
          const otherChar = CHARACTERS[slotIdx];
          const otherAnims = anims.current[otherChar.name.toLowerCase()];
          const idle000 = otherAnims?.idle?.[0];
          if (idle000 && isValid(idle000)) {
            const drawW = 140; const drawH = 140;
            const cx = cardX + cardW / 2;
            const topY = cardY + 20;
            ctx.save();
            ctx.translate(cx, topY + drawH / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(idle000, -drawW/2, -drawH/2, drawW, drawH);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = '#888';
          ctx.font = '10px "Press Start 2P"';
          ctx.textAlign = 'center';
          ctx.fillText(`ESPERANDO A ${otherLabel}...`, cardX + cardW/2, cardY + cardH/2 - 8);
        }
        ctx.fillStyle = otherColor;
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(`${otherLabel} ${otherName ?? '...'}`, cardX + cardW/2, cardY + cardH - 20);
      } else {
        ctx.fillStyle = 'rgba(23, 42, 69, 0.95)';
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        ctx.fillStyle = '#ffd700'; ctx.font = '14px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillText("STATS", cardX + cardW/2, cardY + 28);
        const stats = CHARACTER_STATS[selectedIdx] ?? { speed: 50, strength: 50, agility: 50 };
        const barY = (label: string, y: number, value: number) => {
          ctx.fillStyle = '#fff'; ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'left';
          ctx.fillText(label, cardX + 12, y);
          const barW = cardW - 24; const barH = 12; const barX = cardX + 12;
          ctx.fillStyle = '#111'; ctx.fillRect(barX, y + 4, barW, barH);
          ctx.fillStyle = '#4a9eff';
          ctx.fillRect(barX, y + 4, (value / 100) * barW, barH);
          ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.strokeRect(barX, y + 4, barW, barH);
        };
        barY("SPEED", cardY + 52, stats.speed);
        barY("STRENGTH", cardY + 52 + 36, stats.strength);
        barY("AGILITY", cardY + 52 + 72, stats.agility);
      }
      ctx.textAlign = 'left'; ctx.font = '30px "Press Start 2P"';
      ctx.fillStyle = currentChar.locked ? '#444' : currentChar.color;
      ctx.fillText(currentChar.locked ? "LOCKED" : currentChar.name, 200, 380);
      ctx.fillStyle = '#fff'; ctx.font = '22px "Press Start 2P"'; ctx.textAlign = 'center';
      if (hasConfirmed) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText(isHost ? (otherName ? `ESPERANDO A ${otherName}...` : "ESPERANDO AL OTRO JUGADOR") : "ESPERANDO AL HOST...", CANVAS_WIDTH/2, 410);
      } else {
        ctx.fillText("CHOOSE YOUR MAXXITO", CANVAS_WIDTH/2, 410);
      }

      if (!hasConfirmed) {
        frameCounter.current++;
        if (frameCounter.current > 10) {
          let changed = false;
          if (keys.current['ArrowRight']) { setSelectedChar(p => (p + 1) % CHAR_SELECT_SLOTS); changed = true; }
          else if (keys.current['ArrowLeft']) { setSelectedChar(p => (p - 1 + CHAR_SELECT_SLOTS) % CHAR_SELECT_SLOTS); changed = true; }
          else if (keys.current['ArrowDown']) { setSelectedChar(p => (p + 4) % CHAR_SELECT_SLOTS); changed = true; }
          else if (keys.current['ArrowUp']) { setSelectedChar(p => (p - 4 + CHAR_SELECT_SLOTS) % CHAR_SELECT_SLOTS); changed = true; }

          if (changed) {
            frameCounter.current = 0;
            sounds.playSFX('select');
          }
        }

        if (inputCooldownRef.current === 0 && (keys.current['Space'] || keys.current['Enter'])) {
          if (!currentChar.locked) {
            const client = roomClientRef.current;
            if (client) {
              client.sendSelectChar(String(selectedIdx));
              inputCooldownRef.current = 45;
              sounds.playSFX('select');
            } else {
              const candidates = charsInSelect
                .map((_, i) => i)
                .filter(i => i !== selectedIdx && !CHARACTERS[i].locked);
              const cpu = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
              setCpuChar(cpu);
              cpuCharRef.current = cpu;
              resetMatchState();
              setGameState('STAGE_SELECT');
            }
          }
        }
      }
    } else if (state === 'ONLINE_CHARS_READY') {
      if (isValid(menuBackground.current)) ctx.drawImage(menuBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#0a192f'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }
      const size = 90; const margin = 20; const gridX = (CANVAS_WIDTH - (4*size + 3*margin))/2;
      const gridTopY = 110;
      const charsInSelect = CHARACTERS.slice(0, CHAR_SELECT_SLOTS);
      const mugPad = 5; const mugSize = size - mugPad * 2;
      const P1_COLOR = '#EF4444';
      const P2_COLOR = '#4285F4';
      const room = serverRoomStateRef.current;
      if (room) {
        charsInSelect.forEach((c, i) => {
          const x = gridX + (i % 4) * (size + margin); const y = gridTopY + Math.floor(i / 4) * (size + margin);
          ctx.fillStyle = c.locked ? '#050a14' : '#172a45';
          ctx.fillRect(x, y, size, size);
          if (!c.locked) {
            const mug = mugshots.current[c.name.toLowerCase()];
            const mx = x + mugPad; const my = y + mugPad;
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(mx, my, mugSize, mugSize);
            if (isValid(mug)) {
              ctx.shadowColor = 'rgba(0,0,0,0.6)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 4;
              ctx.shadowOffsetY = 4;
              ctx.drawImage(mug, mx, my, mugSize, mugSize);
              ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            }
          } else {
            ctx.fillStyle = '#444'; ctx.font = '30px "Press Start 2P"'; ctx.textAlign = 'center';
            ctx.fillText("?", x + size/2, y + size/2 + 10);
          }
          let slotStroke = c.locked ? '#444' : '#ffd700';
          let slotLineWidth = c.locked ? 2 : 4;
          if (room.hostChar === String(i)) { slotStroke = P1_COLOR; slotLineWidth = 5; }
          else if (room.guestChar === String(i)) { slotStroke = P2_COLOR; slotLineWidth = 5; }
          ctx.strokeStyle = slotStroke;
          ctx.lineWidth = slotLineWidth;
          ctx.strokeRect(x, y, size, size);
          ctx.font = '8px "Press Start 2P"'; ctx.textAlign = 'center';
          if (room.hostChar === String(i) && room.hostName) {
            ctx.fillStyle = P1_COLOR;
            ctx.fillText(`P1 ${room.hostName}`, x + size/2, y + size - 4);
          } else if (room.guestChar === String(i) && room.guestName) {
            ctx.fillStyle = P2_COLOR;
            ctx.fillText(`P2 ${room.guestName}`, x + size/2, y + size - 4);
          }
        });
        const leftPreviewX = 24; const leftPreviewY = 130; const leftPreviewSize = 140;
        const previewOuter = leftPreviewSize + 8;
        const hostIdx = room.hostChar != null ? parseInt(String(room.hostChar), 10) : 0;
        const hostChar = CHARACTERS[Number.isNaN(hostIdx) ? 0 : Math.min(CHAR_SELECT_SLOTS - 1, Math.max(0, hostIdx))];
        if (hostChar && !hostChar.locked) {
          const charAnims = anims.current[hostChar.name.toLowerCase()];
          const idle0 = charAnims?.idle?.[0];
          if (idle0 && isValid(idle0)) {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
            ctx.strokeStyle = P1_COLOR;
            ctx.lineWidth = 3;
            ctx.strokeRect(leftPreviewX - 4, leftPreviewY - 4, previewOuter, previewOuter);
            ctx.drawImage(idle0, leftPreviewX, leftPreviewY, leftPreviewSize, leftPreviewSize);
          }
        }
        ctx.textAlign = 'left'; ctx.font = '30px "Press Start 2P"';
        ctx.fillStyle = hostChar?.locked ? '#444' : (hostChar?.color ?? '#ffd700');
        ctx.fillText(hostChar?.locked ? "LOCKED" : (hostChar?.name ?? "P1"), 200, 380);
        const cardX = 618; const cardY = 95; const cardW = 168; const cardH = 260;
        ctx.fillStyle = 'rgba(23, 42, 69, 0.95)';
        ctx.strokeStyle = P2_COLOR;
        ctx.lineWidth = 3;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        const guestIdx = room.guestChar != null ? parseInt(String(room.guestChar), 10) : null;
        const slotIdx = guestIdx != null && !Number.isNaN(guestIdx) ? Math.min(CHAR_SELECT_SLOTS - 1, Math.max(0, guestIdx)) : null;
        if (slotIdx != null && CHARACTERS[slotIdx] && !CHARACTERS[slotIdx].locked) {
          const otherChar = CHARACTERS[slotIdx];
          const otherAnims = anims.current[otherChar.name.toLowerCase()];
          const idle000 = otherAnims?.idle?.[0];
          if (idle000 && isValid(idle000)) {
            const drawW = 140; const drawH = 140;
            const cx = cardX + cardW / 2;
            const topY = cardY + 20;
            ctx.save();
            ctx.translate(cx, topY + drawH / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(idle000, -drawW/2, -drawH/2, drawW, drawH);
            ctx.restore();
          }
        }
        ctx.fillStyle = P2_COLOR;
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(`P2 ${room.guestName ?? '...'}`, cardX + cardW/2, cardY + cardH - 20);
      }
      const panelH = 56;
      const marginBottom = 24;
      const panelY = CANVAS_HEIGHT - panelH - marginBottom;
      ctx.fillStyle = 'rgba(10, 25, 47, 0.95)';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.fillRect(0, panelY, CANVAS_WIDTH, panelH);
      ctx.strokeRect(0, panelY, CANVAS_WIDTH, panelH);
      ctx.fillStyle = '#ffd700';
      ctx.font = '22px "Press Start 2P"';
      ctx.textAlign = 'center';
      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink) ctx.fillText("SPACE PARA CONTINUAR", CANVAS_WIDTH/2, panelY + panelH/2 + 8);
      if (inputCooldownRef.current === 0 && (keys.current['Space'] || keys.current['Enter'])) {
        sounds.playSFX('select');
        roomClientRef.current?.sendAdvanceToStageSelect();
        setGameState('STAGE_SELECT');
      }
    } else if (state === 'STAGE_SELECT') {
      if (isValid(menuBackground.current)) ctx.drawImage(menuBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#0a192f'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }
      const isOnlineStage = !!roomClientRef.current;
      const isHost = isOnlineHostRef.current;
      ctx.fillStyle = '#fff';
      ctx.font = '22px "Press Start 2P"';
      ctx.textAlign = 'center';
      if (isOnlineStage && !isHost) {
        ctx.fillText("ESPERANDO AL HOST...", CANVAS_WIDTH/2, 410);
      } else {
        ctx.fillText(onlineStageConfirmedRef.current ? "SPACE TO START FIGHT" : "SELECT STAGE", CANVAS_WIDTH/2, 410);
      }
      const size = 120; const margin = 24; const cols = 3;
      const gridW = cols * size + (cols - 1) * margin;
      const gridX = (CANVAS_WIDTH - gridW) / 2;
      const gridTopY = 95;
      const selectedIdx = Math.min(selectedStageRef.current, STAGES.length - 1);
      STAGES.forEach((s, i) => {
        const col = i % cols; const row = Math.floor(i / cols);
        const x = gridX + col * (size + margin); const y = gridTopY + row * (size + margin);
        ctx.fillStyle = s.locked ? '#050a14' : '#172a45';
        ctx.fillRect(x, y, size, size);
        if (!s.locked && stageBackgrounds.current[i] && isValid(stageBackgrounds.current[i])) {
          ctx.drawImage(stageBackgrounds.current[i]!, x + 4, y + 4, size - 8, size - 8);
        } else if (s.locked) {
          ctx.fillStyle = '#444'; ctx.font = '24px "Press Start 2P"'; ctx.textAlign = 'center';
          ctx.fillText("?", x + size/2, y + size/2 + 8);
        }
        ctx.strokeStyle = i === selectedIdx ? '#f00' : (s.locked ? '#444' : '#ffd700');
        ctx.lineWidth = i === selectedIdx ? 6 : (s.locked ? 2 : 4);
        ctx.strokeRect(x, y, size, size);
      });
      const currentStage = STAGES[selectedIdx];
      ctx.textAlign = 'left'; ctx.font = '30px "Press Start 2P"';
      ctx.fillStyle = currentStage.locked ? '#444' : '#ffd700';
      ctx.fillText(currentStage.locked ? "LOCKED" : currentStage.name, 200, 400);
      if (isOnlineStage && !isHost) {
        // guest: no input
      } else {
        frameCounter.current++;
        if (frameCounter.current > 10) {
          let changed = false;
          if (keys.current['ArrowRight']) { setSelectedStage(p => (p + 1) % STAGES.length); changed = true; }
          else if (keys.current['ArrowLeft']) { setSelectedStage(p => (p - 1 + STAGES.length) % STAGES.length); changed = true; }
          else if (keys.current['ArrowDown']) { setSelectedStage(p => (p + 3) % STAGES.length); changed = true; }
          else if (keys.current['ArrowUp']) { setSelectedStage(p => (p - 3 + STAGES.length) % STAGES.length); changed = true; }
          if (changed) { frameCounter.current = 0; sounds.playSFX('select'); }
        }
        if (inputCooldownRef.current === 0 && (keys.current['Space'] || keys.current['Enter'])) {
          if (!currentStage.locked) {
            const client = roomClientRef.current;
            if (client && isHost) {
              if (!onlineStageConfirmedRef.current) {
                client.sendSelectStage(String(selectedIdx));
                onlineStageConfirmedRef.current = true;
                sounds.playSFX('select');
              } else {
                client.sendStartFight();
                sounds.playSFX('select');
              }
            } else if (!client) {
              const bg = stageBackgrounds.current[selectedIdx];
              fightBackground.current = bg && isValid(bg) ? bg : null;
              initFighters(selectedCharRef.current, cpuCharRef.current);
              setGameState('FIGHT');
            }
          }
        }
      }
    } else if (state === 'FIGHT') {
      if (isValid(fightBackground.current)) ctx.drawImage(fightBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#111'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }

      const isOnlineFight = !!roomClientRef.current;
      const isHost = isOnlineHostRef.current;
      const runCombat = !isOnlineFight || isHost;

      if (playerRef.current && cpuRef.current) {
        if (runCombat && !fightPausedRef.current) {
          const p2Control: CombatControl = isOnlineFight && isHost ? 'remote' : 'cpu';
          updateCombat(playerRef.current, cpuRef.current, 'player');
          updateCombat(cpuRef.current, playerRef.current, p2Control);
          if (frameCounter.current % 60 === 0 && timer.current > 0 && frameCounter.current >= 120) timer.current--;
          frameCounter.current++;
          if (playerRef.current.hp <= 0 || cpuRef.current.hp <= 0 || timer.current <= 0) {
            const p1Won = playerRef.current.hp > cpuRef.current.hp;
            winnerNameRef.current = p1Won ? playerRef.current.name : cpuRef.current.name;
            roundLoserRef.current = p1Won ? cpuRef.current : playerRef.current;
            if (p1Won) scoreRef.current.p1++; else scoreRef.current.p2++;
            setGameState('ROUND_KO'); frameCounter.current = 0;
          }
        }
        if (isOnlineFight && isHost) {
          const client = roomClientRef.current;
          if (client) {
            client.sendStateSync({
              phase: 'FIGHT',
              p1: { ...playerRef.current },
              p2: { ...cpuRef.current },
              timer: timer.current,
              score: { ...scoreRef.current },
              round: roundRef.current,
              winnerName: winnerNameRef.current,
              frameCounter: frameCounter.current,
            });
          }
        }
        if (isOnlineFight && !isHost && roomClientRef.current && frameCounter.current % 2 === 0) {
          roomClientRef.current.sendInput({
            left: !!(keys.current['KeyA'] || keys.current['ArrowLeft']),
            right: !!(keys.current['KeyD'] || keys.current['ArrowRight']),
            up: !!(keys.current['KeyW'] || keys.current['ArrowUp']),
            attack: !!(keys.current['Space'] || keys.current['KeyK']),
          });
        }
        drawFighter(ctx, playerRef.current); drawFighter(ctx, cpuRef.current);
        ctx.fillStyle = '#fff'; ctx.font = '34px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(timer.current.toString(), CANVAS_WIDTH/2, 65);
        const drawBar = (f: Fighter, x: number, align: 'L'|'R', wins: number) => {
          const w = 280; const barH = 14; const gap = 4; const stamY = 40 + barH + gap;
          const totalH = barH * 2 + gap;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x - 2, 40 - 2, w + 4, totalH + 4);
          ctx.fillStyle = '#000'; ctx.fillRect(x, 40, w, barH); ctx.fillRect(x, stamY, w, barH);
          const hpW = (f.hp / f.maxHp) * w; const stamW = (f.stamina / f.maxStamina) * w;
          ctx.fillStyle = f.hp > 30 ? '#00FF00' : '#FF0000';
          if (align === 'L') { 
            ctx.fillRect(x, 40, hpW, barH); 
            ctx.fillStyle = '#4a9eff'; ctx.fillRect(x, stamY, stamW, barH);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '14px "Press Start 2P"';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(f.name, x, 34); ctx.shadowBlur = 0;
            for(let i=0; i<2; i++) {
              ctx.fillStyle = wins > i ? '#ffd700' : '#333';
              ctx.beginPath(); ctx.arc(x + w - 15 - (i*30), 26, 10, 0, Math.PI*2); ctx.fill();
            }
          } else { 
            ctx.fillRect(x + (w - hpW), 40, hpW, barH); 
            ctx.fillStyle = '#4a9eff'; ctx.fillRect(x + (w - stamW), stamY, stamW, barH);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = '14px "Press Start 2P"';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(f.name, x + w, 34); ctx.shadowBlur = 0;
            for(let i=0; i<2; i++) {
              ctx.fillStyle = wins > i ? '#ffd700' : '#333';
              ctx.beginPath(); ctx.arc(x + 15 + (i*30), 26, 10, 0, Math.PI*2); ctx.fill();
            }
          }
        };
        drawBar(playerRef.current, 20, 'L', scoreRef.current.p1); drawBar(cpuRef.current, 500, 'R', scoreRef.current.p2);
        if (frameCounter.current < 120 && !fightPausedRef.current) {
            ctx.save(); ctx.fillStyle = '#ffd700'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            const msg = frameCounter.current < 60 ? `ROUND ${roundRef.current}` : "FIGHT!";
            ctx.fillText(msg, CANVAS_WIDTH/2, CANVAS_HEIGHT/2); ctx.restore();
        }
      }
    } else if (state === 'ROUND_KO') {
      if (isValid(fightBackground.current)) ctx.drawImage(fightBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#111'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }
      const loser = roundLoserRef.current;
      const winner = playerRef.current && cpuRef.current && loser === playerRef.current ? cpuRef.current : playerRef.current;
      if (winner) drawFighter(ctx, winner);
      if (loser) drawFighterFallen(ctx, loser);
      ctx.fillStyle = '#fff'; ctx.font = '34px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(timer.current.toString(), CANVAS_WIDTH/2, 65);
      const drawBar = (f: Fighter, x: number, align: 'L'|'R', wins: number) => {
        const w = 280; const barH = 14; const gap = 4; const stamY = 40 + barH + gap;
        const totalH = barH * 2 + gap;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x - 2, 40 - 2, w + 4, totalH + 4);
        ctx.fillStyle = '#000'; ctx.fillRect(x, 40, w, barH); ctx.fillRect(x, stamY, w, barH);
        const hpW = (f.hp / f.maxHp) * w; const stamW = (f.stamina / f.maxStamina) * w;
        ctx.fillStyle = f.hp > 30 ? '#00FF00' : '#FF0000';
        if (align === 'L') {
          ctx.fillRect(x, 40, hpW, barH);
          ctx.fillStyle = '#4a9eff'; ctx.fillRect(x, stamY, stamW, barH);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '14px "Press Start 2P"';
          ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(f.name, x, 34); ctx.shadowBlur = 0;
          for(let i=0; i<2; i++) {
            ctx.fillStyle = wins > i ? '#ffd700' : '#333';
            ctx.beginPath(); ctx.arc(x + w - 15 - (i*30), 26, 10, 0, Math.PI*2); ctx.fill();
          }
        } else {
          ctx.fillRect(x + (w - hpW), 40, hpW, barH);
          ctx.fillStyle = '#4a9eff'; ctx.fillRect(x + (w - stamW), stamY, stamW, barH);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = '14px "Press Start 2P"';
          ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(f.name, x + w, 34); ctx.shadowBlur = 0;
          for(let i=0; i<2; i++) {
            ctx.fillStyle = wins > i ? '#ffd700' : '#333';
            ctx.beginPath(); ctx.arc(x + 15 + (i*30), 26, 10, 0, Math.PI*2); ctx.fill();
          }
        }
      };
      if (playerRef.current && cpuRef.current) {
        drawBar(playerRef.current, 20, 'L', scoreRef.current.p1); drawBar(cpuRef.current, 500, 'R', scoreRef.current.p2);
      }
      ctx.fillStyle = '#ffd700'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
      ctx.fillText("K.O.", CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      ctx.shadowBlur = 0;
      if (frameCounter.current === 0) sounds.playBuffer('ko');
      frameCounter.current++;
      if (roomClientRef.current && isOnlineHostRef.current) {
        roomClientRef.current.sendStateSync({
          phase: 'ROUND_KO',
          p1: playerRef.current ? { ...playerRef.current } : {},
          p2: cpuRef.current ? { ...cpuRef.current } : {},
          timer: timer.current,
          score: { ...scoreRef.current },
          round: roundRef.current,
          winnerName: winnerNameRef.current,
          frameCounter: frameCounter.current,
        });
      }
      const koDelayFrames = 120;
      if (frameCounter.current > koDelayFrames) {
        setGameState('ROUND_RESULT'); frameCounter.current = 0;
      }
    } else if (state === 'ROUND_RESULT') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '30px "Press Start 2P"';
      ctx.fillText(`${winnerNameRef.current} WINS ROUND ${roundRef.current}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      frameCounter.current++;
      if (roomClientRef.current && isOnlineHostRef.current) {
        roomClientRef.current.sendStateSync({
          phase: 'ROUND_RESULT',
          p1: playerRef.current ? { ...playerRef.current } : {},
          p2: cpuRef.current ? { ...cpuRef.current } : {},
          timer: timer.current,
          score: { ...scoreRef.current },
          round: roundRef.current,
          winnerName: winnerNameRef.current,
          frameCounter: frameCounter.current,
        });
      }
      if (frameCounter.current > 120) {
        if (scoreRef.current.p1 >= 2 || scoreRef.current.p2 >= 2) setGameState('GAME_OVER');
        else {
          roundRef.current++;
          if (roomClientRef.current) guestKeysRef.current = {};
          initFighters(selectedCharRef.current, cpuCharRef.current);
          setGameState('FIGHT');
        }
        frameCounter.current = 0;
      }
    } else if (state === 'GAME_OVER') {
      if (isValid(menuBackground.current)) ctx.drawImage(menuBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#0a192f'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); }
      const loser = roundLoserRef.current;
      const winner = loser === playerRef.current ? cpuRef.current : playerRef.current;
      if (winner && loser) {
        const winX = 120;
        const loseX = 460;
        const origWx = winner.x;
        const origWy = winner.y;
        const origWd = winner.direction;
        const origLx = loser.x;
        const origLy = loser.y;
        const origLd = loser.direction;
        winner.x = winX;
        winner.y = GROUND_Y;
        winner.direction = 1;
        loser.x = loseX;
        loser.y = GROUND_Y;
        loser.direction = -1;
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 28;
        drawFighter(ctx, winner);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.filter = 'saturate(0.6) brightness(0.85)';
        drawFighter(ctx, loser);
        ctx.restore();
        winner.x = origWx;
        winner.y = origWy;
        winner.direction = origWd;
        loser.x = origLx;
        loser.y = origLy;
        loser.direction = origLd;
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText('VICTORIA', winX + winner.width / 2, GROUND_Y - 20);
        ctx.fillStyle = '#888';
        ctx.fillText('K.O.', loseX + loser.width / 2, GROUND_Y - 20);
        ctx.shadowBlur = 0;
      }
      if (roomClientRef.current && isOnlineHostRef.current) {
        roomClientRef.current.sendStateSync({
          phase: 'GAME_OVER',
          p1: playerRef.current ? { ...playerRef.current } : {},
          p2: cpuRef.current ? { ...cpuRef.current } : {},
          timer: timer.current,
          score: { ...scoreRef.current },
          round: roundRef.current,
          winnerName: winnerNameRef.current,
        });
      }
      if (inputCooldownRef.current === 0 && (keys.current['Space'] || keys.current['Enter'])) {
        sounds.playSFX('select');
        setGameState('TITLE');
        resetMatchState();
      }
    } else if (state === 'STOP') {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
    }
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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `url(${ASSETS_BASE}/backgrounds/menu.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(10, 25, 47, 0.95)',
              border: '4px solid #ffd700',
              borderRadius: 12,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              maxWidth: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <input
              type="text"
              value={onlinePlayerName}
              onChange={(e) => setOnlinePlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOnlineSubmit()}
              placeholder="Tu nombre"
              maxLength={20}
              style={{
                fontFamily: '"Press Start 2P", cursive',
                fontSize: 14,
                padding: 14,
                width: 300,
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleOnlineSubmit}
              disabled={!onlinePlayerName.trim()}
              style={{
                fontFamily: '"Press Start 2P", cursive',
                fontSize: 12,
                padding: 14,
                background: onlinePlayerName.trim() ? '#172a45' : '#333',
                color: '#fff',
                border: '3px solid #ffd700',
                cursor: onlinePlayerName.trim() ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase',
              }}
            >
              {isOnlineHostRef.current ? 'Crear desafío' : 'Unirse al desafío'}
            </button>
          </div>
        </div>
      )}
      {gameState === 'ONLINE_LINK' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `url(${ASSETS_BASE}/backgrounds/menu.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(10, 25, 47, 0.95)',
              border: '4px solid #ffd700',
              borderRadius: 12,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              maxWidth: 520,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {challengeLink ? (
              <>
                <span style={{ fontFamily: '"Press Start 2P", cursive', fontSize: 14, color: '#ffd700' }}>LINK DEL DESAFÍO</span>
                <code
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: '#fff',
                    wordBreak: 'break-all',
                    maxWidth: '100%',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  {challengeLink}
                </code>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    fontFamily: '"Press Start 2P", cursive',
                    fontSize: 12,
                    padding: 12,
                    background: '#172a45',
                    color: '#fff',
                    border: '3px solid #ffd700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  Copiar link
                </button>
              </>
            ) : null}
            <span style={{ fontFamily: '"Press Start 2P", cursive', fontSize: 12, color: '#fff', textAlign: 'center' }}>
              {serverRoomState?.guestId != null || serverRoomState?.status === 'char_select'
                ? '¡Listo! (Próximo: selección de personajes)'
                : isOnlineHostRef.current
                  ? 'Esperando oponente...'
                  : 'Conectado. Esperando al host...'}
            </span>
          </div>
        </div>
      )}
      {gameState === 'FIGHT' && !fightPaused && !roomClientRef.current && (
        <button
          type="button"
          onClick={() => setFightPaused(true)}
          style={{
            position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
            fontFamily: '"Press Start 2P", cursive',
            fontSize: '10px', padding: '6px 10px',
            background: 'rgba(0,0,0,0.7)', color: '#fff', border: '2px solid #fff',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          II Pausa
        </button>
      )}
      {gameState === 'FIGHT' && fightPaused && !roomClientRef.current && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 24,
          }}
        >
          <span style={{ fontFamily: '"Press Start 2P", cursive', fontSize: 24, color: '#ffd700' }}>PAUSA</span>
          <button
            type="button"
            onClick={() => setFightPaused(false)}
            style={{
              fontFamily: '"Press Start 2P", cursive',
              fontSize: '12px', padding: '12px 20px',
              background: '#172a45', color: '#fff', border: '3px solid #fff',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            Resumen
          </button>
          <button
            type="button"
            onClick={() => { setFightPaused(false); setGameState('CHARACTER_SELECT'); }}
            style={{
              fontFamily: '"Press Start 2P", cursive',
              fontSize: '10px', padding: '12px 16px',
              background: '#172a45', color: '#fff', border: '3px solid #fff',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            Volver al menu de personajes
          </button>
        </div>
      )}
      {gameState === 'GAME_OVER' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: 32,
          }}
        >
          <button
            type="button"
            onClick={() => {
              sounds.playSFX('select');
              setGameState('TITLE');
              resetMatchState();
            }}
            style={{
              fontFamily: '"Press Start 2P", cursive',
              fontSize: '12px',
              padding: '14px 24px',
              background: 'rgba(23, 42, 69, 0.95)',
              color: '#ffd700',
              border: '3px solid #ffd700',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Volver al menú
          </button>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<FighterApp />);
