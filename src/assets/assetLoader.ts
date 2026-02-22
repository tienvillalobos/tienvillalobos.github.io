/**
 * Carga de assets: sonidos, fondos, sprites y animaciones.
 * El componente llama loadAllAssets con refs y callbacks; la decisión ONLINE_NAME vs INTRO queda en el componente.
 */

import { sounds } from '../audio/SoundManager';
import { ASSETS_BASE, CHARACTERS, STORY_TOWER_ORDER } from '../game/constants';

/** Animaciones de sprites que no son personajes jugables (créditos, público, etc.). */
export interface ExtraAnimSpec {
  key: string;
  path: string;
  frameCount: number;
}

export const EXTRA_ANIM_SPECS: ExtraAnimSpec[] = [
  { key: 'bruno_bachatin/transformation', path: 'bruno_bachatin/transformation', frameCount: 36 },
  { key: 'bruno_bachatin/dance', path: 'bruno_bachatin/dance', frameCount: 36 },
];

export interface AssetRefs {
  homeBackground: { current: HTMLImageElement | null };
  menuBackground: { current: HTMLImageElement | null };
  fightBackground: { current: HTMLImageElement | null };
  towerBackground: { current: HTMLImageElement | null };
  stageBackgrounds: { current: (HTMLImageElement | null)[] };
  mugshots: { current: Record<string, HTMLImageElement> };
  anims: { current: Record<string, { idle: HTMLImageElement[]; walk: HTMLImageElement[]; attack: HTMLImageElement[] }> };
  extraAnims: { current: Record<string, HTMLImageElement[]> };
}

export interface LoadAllAssetsOptions {
  setLoadProgress: (value: number | ((prev: number) => number)) => void;
  setErrorMessage: (value: string) => void;
  setGameState: (state: string) => void;
  /** Ref actualizado en cada avance para que el game loop muestre el % en tiempo real. */
  loadProgressRef: { current: number };
  assetRefs: AssetRefs;
  /** Si tiene room en URL, ir a ONLINE_NAME; si no, a INTRO. Llamado al terminar la carga. */
  onComplete: (initialState: 'ONLINE_NAME' | 'INTRO') => void;
}

function isValid(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!(img && img.complete && img.naturalWidth > 0);
}

export async function loadAllAssets(options: LoadAllAssetsOptions): Promise<void> {
  const { setLoadProgress, setErrorMessage, setGameState, loadProgressRef, assetRefs, onComplete } = options;
  setGameState('LOADING');
  setErrorMessage('');
  loadProgressRef.current = 0;

  try {
    sounds.init();

    const soundNames = ['menu', 'fight', 'ko', 'menu_voice', 'enemy_tower'];
    for (const name of soundNames) {
      const res = await fetch(`${ASSETS_BASE}/sounds/${name}.ogg`);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        await sounds.loadBuffer(name, ab);
      }
    }

    const totalFrames = 36;
    const categories = ['idle', 'walk', 'attack'];
    const playableChars = CHARACTERS.filter((c) => !c.locked).map(
      (c) => c.assetKey ?? c.name.toLowerCase().replace(/\s+/g, '_'),
    );
    const storyOnlyKeys = STORY_TOWER_ORDER.filter((idx) => CHARACTERS[idx]?.locked).map(
      (idx) => CHARACTERS[idx].assetKey ?? CHARACTERS[idx].name.toLowerCase().replace(/\s+/g, '_'),
    );
    const charKeysToLoad = [...new Set([...playableChars, ...storyOnlyKeys])];
    const extraFramesCount = EXTRA_ANIM_SPECS.reduce((acc, spec) => acc + spec.frameCount, 0);
    const totalToLoad = charKeysToLoad.length * 3 * 36 + charKeysToLoad.length + 6 + extraFramesCount;
    let loadedCount = 0;

    const getImg = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        const updateProgress = () => {
          loadedCount++;
          const pct = Math.floor((loadedCount / totalToLoad) * 100);
          loadProgressRef.current = pct;
          setLoadProgress(pct);
        };
        img.onload = () => {
          updateProgress();
          resolve(img);
        };
        img.onerror = () => {
          updateProgress();
          resolve(img);
        };
        img.src = url;
      });
    };

    assetRefs.homeBackground.current = await getImg(`${ASSETS_BASE}/backgrounds/home.png`);
    assetRefs.menuBackground.current = await getImg(`${ASSETS_BASE}/backgrounds/menu.png`);
    assetRefs.towerBackground.current = await getImg(`${ASSETS_BASE}/backgrounds/enemy_tower.png`);
    assetRefs.stageBackgrounds.current = [
      await getImg(`${ASSETS_BASE}/backgrounds/stages/arena.png`),
      await getImg(`${ASSETS_BASE}/backgrounds/stages/coffee_room.png`),
      await getImg(`${ASSETS_BASE}/backgrounds/stages/lobby.png`),
      null,
      null,
      null,
    ];

    for (const charName of charKeysToLoad) {
      assetRefs.mugshots.current[charName] = await getImg(`${ASSETS_BASE}/characters/${charName}/mugshot.png`);
      assetRefs.anims.current[charName] = { idle: [], walk: [], attack: [] };
      for (const cat of categories) {
        const promises: Promise<HTMLImageElement>[] = [];
        for (let i = 1; i <= totalFrames; i++) {
          const f = i.toString().padStart(3, '0');
          promises.push(getImg(`${ASSETS_BASE}/characters/${charName}/${cat}/frame_${f}.png`));
        }
        const results = await Promise.all(promises);
        assetRefs.anims.current[charName][cat as 'idle' | 'walk' | 'attack'] = results.filter(isValid);
      }
    }

    for (const spec of EXTRA_ANIM_SPECS) {
      const promises: Promise<HTMLImageElement>[] = [];
      for (let i = 1; i <= spec.frameCount; i++) {
        const f = i.toString().padStart(3, '0');
        promises.push(getImg(`${ASSETS_BASE}/characters/${spec.path}/frame_${f}.png`));
      }
      const results = await Promise.all(promises);
      assetRefs.extraAnims.current[spec.key] = results.filter(isValid);
    }

    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const initialState = params.get('room') ? 'ONLINE_NAME' : 'INTRO';
    onComplete(initialState);
  } catch (e) {
    console.error('Error cargando assets:', e);
    setErrorMessage('Error al cargar assets desde /assets/');
    setGameState('ERROR');
  }
}
