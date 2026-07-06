/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameMode = 'normal' | 'random' | 'practice';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'shifting' | 'gameover';

export interface GlobalState {
  health: number; // 3 lives max
  coins: number;
  currentGameId: string;
  mode: GameMode;
  status: GameStatus;
  runsCount: number;
  highScoreCoins: number;
  highScoreTime: number; // seconds survived
}

export interface RunStats {
  id: string;
  timestamp: number;
  mode: GameMode;
  coinsEarned: number;
  duration: number; // seconds
  shiftsCount: number;
  gamesPlayed: string[];
}

export interface GameContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  onDamage: () => void;
  onCoin: (amount?: number) => void;
  isPaused: boolean;
  mode: GameMode;
  savedState?: any;
}

export interface MiniGame {
  id: string;
  name: string;
  icon: string;
  description: string;
  controls: string;
  init: (ctx: GameContext) => void;
  update: (ctx: GameContext) => void;
  draw: (ctx: GameContext) => void;
  handleInput: (ctx: GameContext, event: KeyboardEvent | TouchEvent | MouseEvent, type: 'down' | 'up' | 'move') => void;
  pause: (ctx: GameContext) => any; // Returns state to serialize/save
  resume: (ctx: GameContext, savedState: any) => void;
  cleanup: (ctx: GameContext) => void;
}
