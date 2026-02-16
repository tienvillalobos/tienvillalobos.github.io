/**
 * Punto de entrada: mapeo GameState -> función de dibujado.
 */

import type { GameState } from '../types';
import type { GameLoopContext } from '../loopContext';
import {
  drawBoot,
  drawError,
  drawLoading,
  drawIntro,
  drawTitle,
  drawMainMenu,
  drawOnlineNameOrLink,
  drawCharacterSelect,
  drawOnlineCharsReady,
  drawStageSelect,
  drawFight,
  drawRoundKo,
  drawRoundResult,
  drawGameOver,
  drawStop,
} from './allScreens';

export type ScreenDrawer = (ctx: CanvasRenderingContext2D, context: GameLoopContext, state?: GameState) => void;

const screenMap: Record<GameState, ScreenDrawer> = {
  BOOT: drawBoot,
  ERROR: drawError,
  LOADING: drawLoading,
  INTRO: drawIntro,
  TITLE: drawTitle,
  MAIN_MENU: drawMainMenu,
  ONLINE_NAME: (ctx, context, state) => drawOnlineNameOrLink(ctx, context, state ?? 'ONLINE_NAME'),
  ONLINE_LINK: (ctx, context, state) => drawOnlineNameOrLink(ctx, context, state ?? 'ONLINE_LINK'),
  CHARACTER_SELECT: drawCharacterSelect,
  ONLINE_CHARS_READY: drawOnlineCharsReady,
  STAGE_SELECT: drawStageSelect,
  FIGHT: drawFight,
  ROUND_KO: drawRoundKo,
  ROUND_RESULT: drawRoundResult,
  GAME_OVER: drawGameOver,
  STOP: drawStop,
};

export function drawScreen(state: GameState, ctx: CanvasRenderingContext2D, context: GameLoopContext): void {
  const draw = screenMap[state];
  if (draw) {
    if (state === 'ONLINE_NAME' || state === 'ONLINE_LINK') {
      draw(ctx, context, state);
    } else {
      draw(ctx, context);
    }
  }
}

export { drawBoot, drawError, drawLoading, drawIntro, drawTitle, drawMainMenu, drawOnlineNameOrLink, drawCharacterSelect, drawOnlineCharsReady, drawStageSelect, drawFight, drawRoundKo, drawRoundResult, drawGameOver, drawStop } from './allScreens';
