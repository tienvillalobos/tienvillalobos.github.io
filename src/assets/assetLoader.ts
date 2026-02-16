/**
 * Carga de assets: sonidos, fondos, sprites y animaciones.
 * El componente llama loadAllAssets con refs y callbacks; la decisión ONLINE_NAME vs INTRO queda en el componente.
 */

import { sounds } from '../audio/SoundManager';
import { ASSETS_BASE, CHARACTERS } from '../game/constants';

export interface AssetRefs {
  homeBackground: { current: HTMLImageElement | null };
  menuBackground: { current: HTMLImageElement | null };
  fightBackground: { current: HTMLImageElement | null };
  stageBackgrounds: { current: (HTMLImageElement | null)[] };
  mugshots: { current: Record<string, HTMLImageElement> };
  anims: { current: Record<string, { idle: HTMLImageElement[]; walk: HTMLImageElement[]; attack: HTMLImageElement[] }> };
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
    const playableChars = CHARACTERS.filter((c) => !c.locked).map(
      (c) => c.assetKey ?? c.name.toLowerCase().replace(/\s+/g, '_'),
    );
    const totalToLoad = playableChars.length * 3 * 36 + playableChars.length + 5;
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
    assetRefs.stageBackgrounds.current = [
      await getImg(`${ASSETS_BASE}/backgrounds/stages/arena.png`),
      await getImg(`${ASSETS_BASE}/backgrounds/stages/coffee_room.png`),
      await getImg(`${ASSETS_BASE}/backgrounds/stages/lobby.png`),
      null,
      null,
      null,
    ];

    for (const charName of playableChars) {
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

    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const initialState = params.get('room') ? 'ONLINE_NAME' : 'INTRO';
    onComplete(initialState);
  } catch (e) {
    console.error('Error cargando assets:', e);
    setErrorMessage('Error al cargar assets desde /assets/');
    setGameState('ERROR');
  }
}
