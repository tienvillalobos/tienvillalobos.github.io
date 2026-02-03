
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'https://esm.sh/jszip@3.10.1';

/**
 * Prompt Fighter - AI Arcade Edition
 */

// Added 'STOP' to GameState union to fix TypeScript comparison error on line 191
type GameState = 'BOOT' | 'LOADING' | 'INTRO' | 'TITLE' | 'CHARACTER_SELECT' | 'FIGHT' | 'ROUND_RESULT' | 'GAME_OVER' | 'ERROR' | 'STOP';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;
const GROUND_Y = 190;
const MARGIN_X = 15; // Margen horizontal por lado: los personajes no pueden pasar de este borde
const CHAR_SELECT_SLOTS = 8; // Slots visibles en el menú de selección (grid 4x2)

const CHARACTERS = [
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

// --- Audio Engine ---
class SoundManager {
  private ctx: AudioContext | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private currentMusicMode: string | null = null;

  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async loadBuffer(name: string, arrayBuffer: ArrayBuffer) {
    this.init();
    try {
      const buffer = await this.ctx!.decodeAudioData(arrayBuffer);
      this.buffers[name] = buffer;
    } catch (e) {
      console.error(`Error decoding audio: ${name}`, e);
    }
  }

  playSFX(type: 'select' | 'hit' | 'start' | 'ko' | 'jump' | 'attack') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'select') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(40, t + 0.2);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    } else if (type === 'attack') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'start') {
      osc.type = 'square';
      [440, 554, 659].forEach((f, i) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'square'; o.frequency.value = f;
        o.connect(g); g.connect(this.ctx!.destination);
        g.gain.setValueAtTime(0, t + i * 0.1);
        g.gain.linearRampToValueAtTime(0.1, t + i * 0.1 + 0.05);
        g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.1);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.1);
      });
    }
  }

  playMusic(mode: 'menu' | 'fight' | 'stop') {
    if (this.currentMusicMode === mode) return;
    this.currentMusicMode = mode;

    if (!this.ctx) this.init();
    
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch(e) {}
      this.musicSource = null;
    }
    
    if (mode === 'stop') return;

    const buffer = this.buffers[mode];
    if (!buffer) {
      console.warn(`Buffer de música no encontrado para: ${mode}`);
      return;
    }

    this.musicSource = this.ctx!.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;

    this.musicGain = this.ctx!.createGain();
    // Bajamos sutilmente el volumen de fight (0.25) vs menu (0.4)
    this.musicGain.gain.value = mode === 'fight' ? 0.25 : 0.4;
    this.musicGain.connect(this.ctx!.destination);

    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
  }
}

const sounds = new SoundManager();

interface Fighter {
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
  attackCooldown: number;
  color: string;
  name: string;
  charId: number;
}

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

  // Core Game Refs
  const roundRef = useRef(1);
  const scoreRef = useRef({ p1: 0, p2: 0 });
  const winnerNameRef = useRef<string | null>(null);
  const playerRef = useRef<Fighter | null>(null);
  const cpuRef = useRef<Fighter | null>(null);
  const keys = useRef<{ [key: string]: boolean }>({});
  const gameLoopId = useRef<number>(0);
  const timer = useRef<number>(99);
  const frameCounter = useRef<number>(0);
  const inputCooldownRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);

  // Asset Refs
  const mugshots = useRef<Record<string, HTMLImageElement>>({});
  const homeBackground = useRef<HTMLImageElement | null>(null);
  const fightBackground = useRef<HTMLImageElement | null>(null);
  const anims = useRef<Record<string, {
    idle: HTMLImageElement[];
    walk: HTMLImageElement[];
    attack: HTMLImageElement[];
  }>>({});

  useEffect(() => { 
    const oldState = gameStateRef.current;
    gameStateRef.current = gameState;
    inputCooldownRef.current = 20;

    // Actualizado: INTRO y TITLE (Home) usan fight.ogg
    if (gameState === 'INTRO' || gameState === 'TITLE' || gameState === 'FIGHT') {
      sounds.playMusic('fight');
    } else if (gameState === 'CHARACTER_SELECT') {
      sounds.playMusic('menu');
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

  const isValid = (img: HTMLImageElement | null): img is HTMLImageElement => {
    return !!(img && img.complete && img.naturalWidth > 0);
  };

  const resetMatchState = () => {
    scoreRef.current = { p1: 0, p2: 0 };
    roundRef.current = 1;
    winnerNameRef.current = null;
    frameCounter.current = 0;
    screenShakeRef.current = 0;
  };

  const processZipData = async (data: Blob) => {
    setGameState('LOADING');
    setErrorMessage("");
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(data);
      const assets: Record<string, string> = {};
      const audioBuffersRaw: Record<string, ArrayBuffer> = {};
      const filePromises: Promise<void>[] = [];
      
      content.forEach((relativePath, zipEntry) => {
        const path = relativePath.toLowerCase();
        if (!zipEntry.dir && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg'))) {
          const promise = zipEntry.async('blob').then(blob => {
            const url = URL.createObjectURL(blob);
            const parts = path.split('/');
            
            if (path.includes('backgrounds/home')) assets['home_bg'] = url;
            else if (path.includes('backgrounds/fight')) assets['fight_bg'] = url;
            else if (path.includes('characters/')) {
              const charName = parts[2];
              if (path.includes('mugshot')) {
                assets[`${charName}_mugshot`] = url;
              } else {
                const category = parts[3];
                const frameName = parts[4];
                assets[`${charName}_${category}_${frameName}`] = url;
              }
            }
          });
          filePromises.push(promise);
        } else if (!zipEntry.dir && path.endsWith('.ogg')) {
          const promise = zipEntry.async('arraybuffer').then(ab => {
            const parts = path.split('/');
            const filename = parts[parts.length - 1];
            const name = filename.split('.')[0];
            audioBuffersRaw[name] = ab;
          });
          filePromises.push(promise);
        }
      });

      await Promise.all(filePromises);
      await loadEngineAssets(assets, audioBuffersRaw);
    } catch (e) {
      console.error("Error procesando ZIP:", e);
      setErrorMessage("Error: assets.zip no es un archivo válido o está corrupto.");
      setGameState('ERROR');
    }
  };

  useEffect(() => {
    const attemptAutoLoad = async () => {
      try {
        const response = await fetch('assets.zip');
        if (response.ok) {
          const blob = await response.blob();
          await processZipData(blob);
        } else {
          throw new Error("Local assets.zip not found (404)");
        }
      } catch (err: any) {
        console.error("Error cargando assets local:", err);
        setErrorMessage("Error: No se encontró 'assets.zip' en el servidor.");
        setGameState('ERROR');
      }
    };
    if (gameState === 'BOOT') attemptAutoLoad();
  }, []);

  const loadEngineAssets = async (assets: Record<string, string>, audioBuffersRaw: Record<string, ArrayBuffer>) => {
    sounds.init();
    
    // Cargar sonidos primero
    for (const [name, ab] of Object.entries(audioBuffersRaw)) {
      await sounds.loadBuffer(name, ab);
    }

    const totalFrames = 36;
    const categories = ['idle', 'walk', 'attack'];
    const playableChars = ['eric', 'david', 'jostin', 'manu'];
    const totalToLoad = (playableChars.length * 3 * 36) + playableChars.length + 2;
    let loadedCount = 0;

    const getImg = (key: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { loadedCount++; setLoadProgress(Math.floor((loadedCount / totalToLoad) * 100)); resolve(img); };
        img.onerror = () => { loadedCount++; setLoadProgress(Math.floor((loadedCount / totalToLoad) * 100)); resolve(img); };
        if (assets[key]) img.src = assets[key];
        else { loadedCount++; resolve(img); }
      });
    };

    homeBackground.current = await getImg('home_bg');
    fightBackground.current = await getImg('fight_bg');
    
    for (const charName of playableChars) {
      mugshots.current[charName] = await getImg(`${charName}_mugshot`);
      anims.current[charName] = { idle: [], walk: [], attack: [] };
      for (const cat of categories) {
        const promises = [];
        for (let i = 1; i <= totalFrames; i++) {
          const f = i.toString().padStart(3, '0');
          const filename = `frame_${f}.png`;
          promises.push(getImg(`${charName}_${cat}_${filename}`));
        }
        const results = await Promise.all(promises);
        anims.current[charName][cat as keyof typeof anims.current[string]] = results.filter(img => isValid(img));
      }
    }
    setGameState('INTRO');
  };

  const initFighters = (pIdx: number, cIdx: number) => {
    playerRef.current = {
      x: 100, y: GROUND_Y, width: 220, height: 220, hp: 100, maxHp: 100,
      direction: 1, state: 'IDLE', animFrame: 0, animTimer: 0,
      velocityX: 0, velocityY: 0, isAttacking: false, attackCooldown: 0,
      color: CHARACTERS[pIdx].color, name: CHARACTERS[pIdx].name, charId: pIdx
    };
    cpuRef.current = {
      x: 480, y: GROUND_Y, width: 220, height: 220, hp: 100, maxHp: 100,
      direction: -1, state: 'IDLE', animFrame: 0, animTimer: 0,
      velocityX: 0, velocityY: 0, isAttacking: false, attackCooldown: 0,
      color: CHARACTERS[cIdx].color, name: CHARACTERS[cIdx].name, charId: cIdx
    };
    timer.current = 99;
    frameCounter.current = 0;
    screenShakeRef.current = 0;
    sounds.playSFX('start');
  };

  const updateCombat = (f: Fighter, opp: Fighter, isCpu: boolean) => {
    if (f.y < GROUND_Y) { f.velocityY += 0.9; f.state = 'JUMP'; } 
    else { f.y = GROUND_Y; f.velocityY = 0; if (f.state === 'JUMP') f.state = 'IDLE'; }

    const canAct = frameCounter.current >= 120;

    if (!isCpu && canAct) {
      if (!f.isAttacking && f.state !== 'HIT') {
        if (keys.current['KeyA'] || keys.current['ArrowLeft']) { f.velocityX = -4; f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP'; f.direction = -1; }
        else if (keys.current['KeyD'] || keys.current['ArrowRight']) { f.velocityX = 4; f.state = f.y === GROUND_Y ? 'WALK' : 'JUMP'; f.direction = 1; }
        else { f.velocityX = 0; if (f.y === GROUND_Y) f.state = 'IDLE'; }
        if ((keys.current['KeyW'] || keys.current['ArrowUp']) && f.y === GROUND_Y) f.velocityY = -15;
        if ((keys.current['Space'] || keys.current['KeyK']) && f.attackCooldown <= 0) {
          f.isAttacking = true; f.state = 'ATTACK'; f.animFrame = 0; f.attackCooldown = 40;
          sounds.playSFX('attack');
        }
      }
    } else if (isCpu && canAct) {
      const dist = Math.abs(f.x - opp.x);
      if (!f.isAttacking && f.state !== 'HIT') {
        if (dist > 180) { f.velocityX = f.x < opp.x ? 2.5 : -2.5; f.direction = f.x < opp.x ? 1 : -1; f.state = 'WALK'; }
        else { f.velocityX = 0; f.state = 'IDLE'; if (Math.random() < 0.05 && f.attackCooldown <= 0) { f.isAttacking = true; f.state = 'ATTACK'; f.animFrame = 0; f.attackCooldown = 40; sounds.playSFX('attack'); } }
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
    if (f.attackCooldown > 0) f.attackCooldown--;
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
        setGameState('CHARACTER_SELECT'); 
      }
    } else if (state === 'CHARACTER_SELECT') {
      ctx.fillStyle = '#0a192f'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; ctx.font = '22px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText("CHOOSE YOUR MAXXITO", CANVAS_WIDTH/2, 60);
      
      const size = 90; const margin = 20; const gridX = (CANVAS_WIDTH - (4*size + 3*margin))/2;
      const charsInSelect = CHARACTERS.slice(0, CHAR_SELECT_SLOTS);
      const selectedIdx = Math.min(selectedCharRef.current, CHAR_SELECT_SLOTS - 1);
      
      charsInSelect.forEach((c, i) => {
        const x = gridX + (i % 4) * (size + margin); const y = 110 + Math.floor(i / 4) * (size + margin);
        ctx.fillStyle = c.locked ? '#050a14' : '#172a45'; 
        ctx.fillRect(x, y, size, size);
        
        if (!c.locked) {
          const mug = mugshots.current[c.name.toLowerCase()];
          if (isValid(mug)) ctx.drawImage(mug, x+5, y+5, size-10, size-10);
        } else {
          ctx.fillStyle = '#444'; ctx.font = '30px "Press Start 2P"'; ctx.textAlign = 'center';
          ctx.fillText("?", x + size/2, y + size/2 + 10);
        }
        
        ctx.strokeStyle = i === selectedIdx ? '#f00' : '#444'; 
        ctx.lineWidth = i === selectedIdx ? 6 : 2; ctx.strokeRect(x,y,size,size);
      });
      
      const currentChar = CHARACTERS[selectedIdx];
      ctx.textAlign = 'left'; ctx.font = '30px "Press Start 2P"'; 
      ctx.fillStyle = currentChar.locked ? '#444' : currentChar.color;
      ctx.fillText(currentChar.locked ? "LOCKED" : currentChar.name, 200, 380);
      
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
          // CPU elige al azar entre los personajes jugables (no bloqueados) que no eligió el usuario
          const candidates = charsInSelect
            .map((_, i) => i)
            .filter(i => i !== selectedIdx && !CHARACTERS[i].locked);
          const cpu = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
          setCpuChar(cpu);
          cpuCharRef.current = cpu;
          resetMatchState(); 
          initFighters(selectedIdx, cpu); 
          setGameState('FIGHT'); 
        }
      }
    } else if (state === 'FIGHT') {
      if (isValid(fightBackground.current)) ctx.drawImage(fightBackground.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      else { ctx.fillStyle = '#111'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }

      if (playerRef.current && cpuRef.current) {
        updateCombat(playerRef.current, cpuRef.current, false); updateCombat(cpuRef.current, playerRef.current, true);
        drawFighter(ctx, playerRef.current); drawFighter(ctx, cpuRef.current);
        
        if (frameCounter.current % 60 === 0 && timer.current > 0 && frameCounter.current >= 120) timer.current--;
        frameCounter.current++;
        
        ctx.fillStyle = '#fff'; ctx.font = '34px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(timer.current.toString(), CANVAS_WIDTH/2, 65);
        
        const drawBar = (f: Fighter, x: number, align: 'L'|'R', wins: number) => {
          const w = 340; const barH = 30;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(x - 2, 40 - 2, w + 4, barH + 4);
          ctx.fillStyle = '#000'; ctx.fillRect(x, 40, w, barH);
          const hpW = (f.hp / f.maxHp) * w; 
          ctx.fillStyle = f.hp > 30 ? '#00FF00' : '#FF0000';
          if (align === 'L') { 
            ctx.fillRect(x, 40, hpW, barH); 
            ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '18px "Press Start 2P"';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillText(f.name, x, 30);
            ctx.shadowBlur = 0;
            for(let i=0; i<2; i++) {
              ctx.fillStyle = wins > i ? '#ffd700' : '#333';
              ctx.beginPath(); ctx.arc(x + w - 15 - (i*30), 20, 10, 0, Math.PI*2); ctx.fill();
            }
          } else { 
            ctx.fillRect(x + (w - hpW), 40, hpW, barH); 
            ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = '18px "Press Start 2P"';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillText(f.name, x + w, 30);
            ctx.shadowBlur = 0;
            for(let i=0; i<2; i++) {
              ctx.fillStyle = wins > i ? '#ffd700' : '#333';
              ctx.beginPath(); ctx.arc(x + 15 + (i*30), 20, 10, 0, Math.PI*2); ctx.fill();
            }
          }
        };
        drawBar(playerRef.current, 20, 'L', scoreRef.current.p1); drawBar(cpuRef.current, 440, 'R', scoreRef.current.p2);

        if (frameCounter.current < 120) {
            ctx.save(); ctx.fillStyle = '#ffd700'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            const msg = frameCounter.current < 60 ? `ROUND ${roundRef.current}` : "FIGHT!";
            ctx.fillText(msg, CANVAS_WIDTH/2, CANVAS_HEIGHT/2); ctx.restore();
        }

        if (playerRef.current.hp <= 0 || cpuRef.current.hp <= 0 || timer.current <= 0) {
          const p1Won = playerRef.current.hp > cpuRef.current.hp;
          winnerNameRef.current = p1Won ? playerRef.current.name : cpuRef.current.name;
          if (p1Won) scoreRef.current.p1++; else scoreRef.current.p2++;
          setGameState('ROUND_RESULT'); frameCounter.current = 0;
        }
      }
    } else if (state === 'ROUND_RESULT') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '30px "Press Start 2P"';
      ctx.fillText(`${winnerNameRef.current} WINS ROUND ${roundRef.current}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      frameCounter.current++;
      if (frameCounter.current > 120) {
        if (scoreRef.current.p1 >= 2 || scoreRef.current.p2 >= 2) setGameState('GAME_OVER');
        else { 
          roundRef.current++; 
          initFighters(selectedCharRef.current, cpuCharRef.current); 
          setGameState('FIGHT'); 
        }
        frameCounter.current = 0;
      }
    } else if (state === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '50px "Press Start 2P"'; ctx.fillText("K.O.", CANVAS_WIDTH/2, 180);
      ctx.font = '22px "Press Start 2P"'; ctx.fillText(`${winnerNameRef.current} TOTAL VICTORY`, CANVAS_WIDTH/2, 250);
      ctx.font = '10px "Press Start 2P"'; ctx.fillText("PRESS SPACE TO RETURN TO MENU", CANVAS_WIDTH/2, 350);
      
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
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<FighterApp />);
