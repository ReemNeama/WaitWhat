/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Coins,
  Play,
  RotateCcw,
  Cpu,
  Database,
  Shuffle,
  ChevronRight,
  Info,
  Terminal,
  Code,
  ArrowRight,
  Sparkles,
  Wifi,
  Shield,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
  CircleDot,
  BookOpen
} from 'lucide-react';
import { GameMode, GameStatus, GlobalState, RunStats, MiniGame, GameContext } from './types';
import { ALL_MINI_GAMES, addParticles, updateAndDrawParticles } from './games/allGames';

export default function App() {
  const [isPending, startTransition] = useTransition();

  // --- Core Game State ---
  const [health, setHealth] = useState<number>(3);
  const [coins, setCoins] = useState<number>(0);
  const [currentGameId, setCurrentGameId] = useState<string>('snake');
  const [mode, setMode] = useState<GameMode>('normal');
  const [status, setStatus] = useState<GameStatus>('menu');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGodMode, setIsGodMode] = useState<boolean>(false);

  // --- High Scores & Stats ---
  const [runsCount, setRunsCount] = useState<number>(0);
  const [highScoreCoins, setHighScoreCoins] = useState<number>(0);
  const [highScoreTime, setHighScoreTime] = useState<number>(0);
  const [runHistory, setRunHistory] = useState<RunStats[]>([]);

  // --- Shifting Mechanics ---
  const [shiftIntervalType, setShiftIntervalType] = useState<'standard' | 'turbo'>('turbo');
  const [timeUntilShift, setTimeUntilShift] = useState<number>(15); // Dynamic countdown display
  const [nextGamePreview, setNextGamePreview] = useState<string>('pong');
  const [shiftsCount, setShiftsCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'database'>('telemetry');
  const [dbTab, setDbTab] = useState<'firestore' | 'supabase' | 'mongodb'>('firestore');
  const [isPracticeSelectorOpen, setIsPracticeSelectorOpen] = useState<boolean>(false);

  // --- Canvas & Core Loops Ref ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeGameRef = useRef<MiniGame | null>(null);
  const savedStatesRef = useRef<Record<string, any>>({});
  const gameLoopRef = useRef<number | null>(null);
  const shiftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shiftCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const survivalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);
  const gamesPlayedInRunRef = useRef<Set<string>>(new Set(['snake']));

  // For touch controller input triggers
  const touchDpadRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean; action: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
  });

  // Load persistence
  useEffect(() => {
    const savedStats = localStorage.getItem('shift_arcade_stats');
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats);
        setRunsCount(parsed.runsCount || 0);
        setHighScoreCoins(parsed.highScoreCoins || 0);
        setHighScoreTime(parsed.highScoreTime || 0);
        setRunHistory(parsed.runHistory || []);
      } catch (e) {
        console.error('Failed to load storage', e);
      }
    }
  }, []);

  // Sync state reference to help callbacks avoid stale closures
  const stateRef = useRef({ health, coins, status, isPaused, mode, currentGameId, isGodMode });
  useEffect(() => {
    stateRef.current = { health, coins, status, isPaused, mode, currentGameId, isGodMode };
  }, [health, coins, status, isPaused, mode, currentGameId, isGodMode]);

  const activeGame = ALL_MINI_GAMES.find((g) => g.id === currentGameId) || ALL_MINI_GAMES[0];
  activeGameRef.current = activeGame;

  // Global Context provided to all mini-games
  const getGameContext = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): GameContext => {
    const gameId = stateRef.current.currentGameId;
    return {
      canvas,
      ctx,
      onDamage: () => {
        if (stateRef.current.isGodMode) return;
        setHealth((prev) => {
          const next = Math.max(0, prev - 1);
          if (next === 0) {
            if (stateRef.current.mode === 'practice') {
              addParticles(200, 200, '#ef4444', 30);
              return 3;
            }
            triggerGameOver();
          }
          return next;
        });
        // Screen shake or flash can be handled visually
        const screen = document.getElementById('arcade-screen-container');
        if (screen) {
          screen.classList.add('animate-shake');
          setTimeout(() => screen.classList.remove('animate-shake'), 400);
        }
      },
      onCoin: (amount = 1) => {
        setCoins((prev) => {
          const next = prev + amount;
          return next;
        });
      },
      isPaused: stateRef.current.isPaused,
      mode: stateRef.current.mode,
      get savedState() {
        return savedStatesRef.current[gameId];
      },
      set savedState(val) {
        savedStatesRef.current[gameId] = val;
      }
    };
  };

  // --- START GAME RUN ---
  const startGame = (selectedMode: GameMode) => {
    startTransition(() => {
      setMode(selectedMode);
      setHealth(3);
      setCoins(0);
      setShiftsCount(0);
      setStatus('playing');
      setIsPaused(false);
      savedStatesRef.current = {};
      durationRef.current = 0;
      // Select initial game randomly to start fresh each run
      const randomInitialIndex = Math.floor(Math.random() * ALL_MINI_GAMES.length);
      const firstGame = ALL_MINI_GAMES[randomInitialIndex];
      gamesPlayedInRunRef.current = new Set([firstGame.id]);
      setCurrentGameId(firstGame.id);

      // Start core loops
      setupShiftingTimer();
      startSurvivalTimer();
    });
  };

  const startPracticeGame = (gameId: string) => {
    startTransition(() => {
      setMode('practice');
      setHealth(3);
      setCoins(0);
      setShiftsCount(0);
      setStatus('playing');
      setIsPaused(false);
      savedStatesRef.current = {};
      durationRef.current = 0;
      gamesPlayedInRunRef.current = new Set([gameId]);
      setCurrentGameId(gameId);

      // Start core loops
      setupShiftingTimer();
      startSurvivalTimer();
    });
  };

  const startSurvivalTimer = () => {
    if (survivalTimerRef.current) clearInterval(survivalTimerRef.current);
    survivalTimerRef.current = setInterval(() => {
      if (stateRef.current.status === 'playing' && !stateRef.current.isPaused) {
        durationRef.current += 1;
      }
    }, 1000);
  };

  // --- SETUP AUTOMATIC SHIFTING TIMER ---
  const setupShiftingTimer = () => {
    if (shiftTimerRef.current) clearTimeout(shiftTimerRef.current);
    if (shiftCountdownRef.current) clearInterval(shiftCountdownRef.current);

    if (stateRef.current.mode === 'practice') {
      setTimeUntilShift(9999);
      setNextGamePreview('None - Practice Mode');
      return;
    }

    // Randomized duration:
    // Standard: 30s to 5m (300s)
    // Turbo: 8s to 20s for fast gameplay demo
    let nextDuration = 15;
    if (shiftIntervalType === 'standard') {
      nextDuration = Math.floor(30 + Math.random() * 270);
    } else {
      nextDuration = Math.floor(10 + Math.random() * 15);
    }

    setTimeUntilShift(nextDuration);

    // Pick next randomized game preview
    const available = ALL_MINI_GAMES.filter((g) => g.id !== stateRef.current.currentGameId);
    const nextGame = available[Math.floor(Math.random() * available.length)];
    setNextGamePreview(nextGame.name);

    // Countdown clock update
    shiftCountdownRef.current = setInterval(() => {
      setTimeUntilShift((prev) => {
        if (prev <= 1) {
          clearInterval(shiftCountdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Shift trigger timeout
    shiftTimerRef.current = setTimeout(() => {
      triggerShift();
    }, nextDuration * 1000);
  };

  // --- MANUAL SHIFT SWITCH ---
  const forceManualShift = () => {
    if (status !== 'playing') return;
    triggerShift();
  };

  // --- THE CORE SHIFT MECHANISM ---
  const triggerShift = () => {
    setStatus('shifting');
    if (shiftTimerRef.current) clearTimeout(shiftTimerRef.current);
    if (shiftCountdownRef.current) clearInterval(shiftCountdownRef.current);

    // 1. Freeze & Cache current game state if in Normal Mode
    const canvas = canvasRef.current;
    if (canvas && activeGameRef.current) {
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        const gameContext = getGameContext(canvas, ctx2d);
        if (stateRef.current.mode === 'normal') {
          // Freeze variables
          const snap = activeGameRef.current.pause(gameContext);
          savedStatesRef.current[stateRef.current.currentGameId] = snap;
        }
      }
    }

    // Sound frequency synthesis for vintage glitch effect
    playGlitchSound();

    // 2. Select random next mini-game
    setTimeout(() => {
      const available = ALL_MINI_GAMES.filter((g) => g.id !== stateRef.current.currentGameId);
      const chosen = available[Math.floor(Math.random() * available.length)];

      gamesPlayedInRunRef.current.add(chosen.id);
      setCurrentGameId(chosen.id);
      setShiftsCount((prev) => prev + 1);
      setStatus('playing');

      // 3. Setup new timer
      setupShiftingTimer();
    }, 1500); // 1.5 seconds glitch transition duration
  };

  // --- GAME OVER ---
  const triggerGameOver = () => {
    setStatus('gameover');
    if (shiftTimerRef.current) clearTimeout(shiftTimerRef.current);
    if (shiftCountdownRef.current) clearInterval(shiftCountdownRef.current);
    if (survivalTimerRef.current) clearInterval(survivalTimerRef.current);

    // Save statistics
    const finalCoins = stateRef.current.coins;
    const finalDuration = durationRef.current;
    const finalMode = stateRef.current.mode;

    setRunsCount((prev) => {
      const nextRuns = prev + 1;
      const nextCoinsMax = Math.max(highScoreCoins, finalCoins);
      const nextTimeMax = Math.max(highScoreTime, finalDuration);

      const newRun: RunStats = {
        id: 'run_' + Date.now(),
        timestamp: Date.now(),
        mode: finalMode,
        coinsEarned: finalCoins,
        duration: finalDuration,
        shiftsCount: shiftsCount,
        gamesPlayed: Array.from(gamesPlayedInRunRef.current),
      };

      const updatedHistory = [newRun, ...runHistory].slice(0, 10);
      setRunHistory(updatedHistory);

      localStorage.setItem(
        'shift_arcade_stats',
        JSON.stringify({
          runsCount: nextRuns,
          highScoreCoins: nextCoinsMax,
          highScoreTime: nextTimeMax,
          runHistory: updatedHistory,
        })
      );

      setHighScoreCoins(nextCoinsMax);
      setHighScoreTime(nextTimeMax);

      return nextRuns;
    });
  };

  // --- RENDER GAME LOOP IN THE CANVAS ---
  useEffect(() => {
    if (status !== 'playing' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset dimensions
    canvas.width = 400;
    canvas.height = 400;

    // Call active game initialization if there's no cached state, or if Random Mode is active
    const gameContext = getGameContext(canvas, ctx);
    const hasCache = savedStatesRef.current[currentGameId] !== undefined;

    if (mode === 'normal' && hasCache) {
      activeGameRef.current?.resume(gameContext, savedStatesRef.current[currentGameId]);
    } else {
      activeGameRef.current?.init(gameContext);
    }

    let animId: number;

    const renderLoop = () => {
      if (stateRef.current.status === 'playing') {
        const currentCtx = canvas.getContext('2d');
        if (currentCtx) {
          const currentContext = getGameContext(canvas, currentCtx);

          // Clear background
          currentCtx.fillStyle = '#090d16';
          currentCtx.fillRect(0, 0, 400, 400);

          // Update and Draw active game
          if (activeGameRef.current && !stateRef.current.isPaused) {
            activeGameRef.current.update(currentContext);
          }

          if (activeGameRef.current) {
            activeGameRef.current.draw(currentContext);
          }

          // Render particles on top
          updateAndDrawParticles(currentCtx);
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    gameLoopRef.current = animId;

    return () => {
      if (animId) cancelAnimationFrame(animId);
      activeGameRef.current?.cleanup(gameContext);
    };
  }, [currentGameId, status, isPaused, mode]);

  // --- KEYBOARD LISTENERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.status !== 'playing' || stateRef.current.isPaused) return;

      // Prevent scrolling on arrows/space while playing
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (canvasRef.current && activeGameRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const context = getGameContext(canvasRef.current, ctx);
          activeGameRef.current.handleInput(context, e, 'down');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current.status !== 'playing' || stateRef.current.isPaused) return;

      if (canvasRef.current && activeGameRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const context = getGameContext(canvasRef.current, ctx);
          activeGameRef.current.handleInput(context, e, 'up');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentGameId, status]);

  // --- TOUCH CONTROLLER SIMULATION TRIGGERS ---
  const sendTouchInput = (keyName: string, type: 'down' | 'up') => {
    if (status !== 'playing' || isPaused) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const context = getGameContext(canvas, ctx);

    // Map Virtual Keys to standard Key Events
    let mappedKey = '';
    if (keyName === 'up') mappedKey = 'ArrowUp';
    if (keyName === 'down') mappedKey = 'ArrowDown';
    if (keyName === 'left') mappedKey = 'ArrowLeft';
    if (keyName === 'right') mappedKey = 'ArrowRight';
    if (keyName === 'action') mappedKey = ' ';

    const mockEvent = new KeyboardEvent(type === 'down' ? 'keydown' : 'keyup', {
      key: mappedKey,
      bubbles: true,
    });

    if (type === 'down') {
      activeGameRef.current?.handleInput(context, mockEvent, 'down');
    } else {
      activeGameRef.current?.handleInput(context, mockEvent, 'up');
    }
  };

  // Sound effects utilizing the Web Audio API
  const playGlitchSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const actx = new AudioContextClass();
      const osc = actx.createOscillator();
      const gain = actx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, actx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.08, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 1.4);

      osc.connect(gain);
      gain.connect(actx.destination);

      osc.start();
      osc.stop(actx.currentTime + 1.5);
    } catch (err) {
      // Audio context might be blocked by user-interaction policy
    }
  };

  // Helper to trigger coin sounds
  const playCoinSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const actx = new AudioContextClass();
      const osc = actx.createOscillator();
      const gain = actx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, actx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, actx.currentTime + 0.1); // E6

      gain.gain.setValueAtTime(0.04, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(actx.destination);

      osc.start();
      osc.stop(actx.currentTime + 0.4);
    } catch (e) {}
  };

  // Play sound when coins update
  useEffect(() => {
    if (coins > 0) playCoinSound();
  }, [coins]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-[#38bdf8] selection:text-slate-900 overflow-x-hidden pb-12">
      {/* Decorative Arcade Background Stars & Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Retro Arcade Header */}
      <header className="relative w-full max-w-7xl mx-auto px-4 pt-6 pb-2 flex flex-col md:flex-row justify-between items-center border-b border-[#1e293b]/60 gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded bg-gradient-to-tr from-[#db2777] to-[#0ea5e9] flex items-center justify-center shadow-lg shadow-[#0ea5e9]/20 animate-pulse">
            <Shuffle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400">
              SHIFT ARCADE <span className="text-xs bg-[#1e293b] text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">20-IN-1</span>
            </h1>
            <p className="text-xs text-slate-400">Continuous Multi-Game Multiverse Simulator</p>
          </div>
        </div>

        {/* Global Stats Bar */}
        <div className="flex items-center gap-6 bg-slate-900/60 backdrop-blur border border-slate-800 px-4 py-2 rounded-lg">
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium">Global Runs</span>
            <span className="font-mono text-sm font-bold text-slate-200">{runsCount}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium">Record Coins</span>
            <span className="font-mono text-sm font-bold text-yellow-400 flex items-center justify-center gap-1">
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
              {highScoreCoins}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium">Longest Survival</span>
            <span className="font-mono text-sm font-bold text-cyan-400">{highScoreTime}s</span>
          </div>
        </div>
      </header>

      {/* Main Container Grid */}
      <main className="w-full max-w-7xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

        {/* ==================== LEFT COLUMN: THE ARCADE CABINET (Lg: 7) ==================== */}
        <section className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[480px] bg-slate-900 border-2 border-[#1e293b] rounded-2xl shadow-2xl shadow-cyan-500/5 overflow-hidden flex flex-col">

            {/* Cabinet Header Display (Global State HUD) */}
            <div className="bg-slate-950 px-4 py-3 border-b-2 border-slate-800 flex items-center justify-between">
              {/* Hearts Health Pool */}
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold mr-1">Health:</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((h) => (
                    <motion.div
                      key={h}
                      animate={h <= health ? { scale: [1, 1.15, 1] } : { scale: 0.8 }}
                      transition={{ repeat: h <= health ? Infinity : 0, repeatDelay: 3 + h, duration: 0.3 }}
                    >
                      <Heart
                        className={`w-6 h-6 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] ${
                          h <= health ? 'text-rose-500 fill-rose-500' : 'text-slate-800 fill-slate-900'
                        }`}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Exit Practice Button */}
              {mode === 'practice' && status === 'playing' && (
                <button
                  onClick={() => setStatus('menu')}
                  className="bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-400 px-3 py-1 rounded text-[11px] font-black font-mono tracking-widest uppercase animate-pulse shadow-md transition-all active:scale-95"
                >
                  Exit Practice
                </button>
              )}

              {/* Coins Pool */}
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Coins:</span>
                <div className="bg-yellow-950/40 border border-yellow-500/20 px-3 py-1 rounded flex items-center gap-1.5 text-yellow-400 font-mono font-black text-lg filter drop-shadow-[0_0_6px_rgba(234,179,8,0.3)]">
                  <Coins className="w-4.5 h-4.5 text-yellow-500 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>{coins}</span>
                </div>
              </div>
            </div>

            {/* Game Screen Canvas Box */}
            <div className="p-4 bg-slate-950 flex flex-col items-center relative">
              {/* Screen Bezel Decorative Overlay */}
              <div
                id="arcade-screen-container"
                className="relative w-full aspect-square max-w-[400px] bg-black rounded-lg border-4 border-slate-800 shadow-inner overflow-hidden"
              >
                {/* CRT Scanline Glitch Filter Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/10 to-transparent pointer-events-none z-10 opacity-30" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-10" />

                {/* --- MENU OVERLAY --- */}
                {status === 'menu' && (
                  <div className="absolute inset-0 bg-[#090d16]/95 z-20 flex flex-col items-center justify-center p-4 text-center">
                    {!isPracticeSelectorOpen ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-3 w-full"
                      >
                        <Sparkles className="w-10 h-10 text-cyan-400 mx-auto animate-bounce" />
                        <h2 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 font-mono">
                          INSERT RUN
                        </h2>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          Your dimensions will shift randomly between 20 retro games. Health and Coins are pooled globally across space and time.
                        </p>

                        <div className="pt-2 flex flex-col gap-2 max-w-[280px] mx-auto">
                          <button
                            id="btn-play-normal"
                            onClick={() => startGame('normal')}
                            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg shadow-pink-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-b-4 border-pink-800"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            Play Normal Mode
                          </button>

                          <button
                            id="btn-play-random"
                            onClick={() => startGame('random')}
                            className="w-full bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-cyan-400 border border-cyan-500/30 font-bold py-1.5 px-4 rounded-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                            Play Random Mode
                          </button>

                          <div className="h-px bg-slate-800/80 my-1" />

                          <button
                            id="btn-practice-arena"
                            onClick={() => setIsPracticeSelectorOpen(true)}
                            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-2 px-4 rounded-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-b-4 border-indigo-800"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Practice Arena
                          </button>
                          <span className="text-[9px] text-slate-400 italic">Select any game to practice and learn controls</span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full h-full flex flex-col p-1 text-left"
                      >
                        {/* Practice Selector Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <h3 className="text-sm font-black text-cyan-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-cyan-400" />
                            Practice Arena
                          </h3>
                          <button
                            onClick={() => setIsPracticeSelectorOpen(false)}
                            className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1 active:scale-95"
                          >
                            <ArrowLeft className="w-3 h-3" /> Back
                          </button>
                        </div>

                        <p className="text-[10px] text-slate-400 my-2">
                          Practice any of the 20 dimensions with infinite lives. Game resets on defeat.
                        </p>

                        {/* Scrollable Grid of 20 Games */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                          {ALL_MINI_GAMES.map((game, idx) => (
                            <button
                              key={game.id}
                              onClick={() => {
                                setIsPracticeSelectorOpen(false);
                                startPracticeGame(game.id);
                              }}
                              className="w-full bg-slate-900/80 hover:bg-slate-850 border border-slate-800/60 p-2 rounded flex items-center gap-3 transition-all hover:border-cyan-500/40 text-slate-200 group"
                            >
                              <div className="bg-slate-950 px-2 py-1 rounded font-mono text-[9px] text-cyan-400 border border-slate-800">
                                {String(idx + 1).padStart(2, '0')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold font-mono text-cyan-300 group-hover:text-cyan-200 flex items-center justify-between">
                                  <span>{game.name}</span>
                                  <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {game.description}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* --- SHIFTING GLITCH TRANSITION --- */}
                {status === 'shifting' && (
                  <div className="absolute inset-0 bg-[#0f172a] z-20 flex flex-col items-center justify-center p-6 text-center overflow-hidden animate-flash">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.2),transparent_70%)] animate-pulse" />
                    <motion.div
                      animate={{ scale: [1, 1.2, 0.9, 1.1, 1], x: [0, -5, 5, -3, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="space-y-4 relative z-30"
                    >
                      <div className="text-[#ef4444] animate-pulse font-black text-2xl tracking-widest uppercase font-mono">
                        ⚠️ SHIFTING WARNING ⚠️
                      </div>
                      <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 font-mono">
                        DIMENSION FAULT
                      </div>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto animate-pulse">
                        Slicing active matrix. Storing local vectors. Next destination:
                      </p>
                      <div className="bg-slate-900/90 border border-[#ef4444]/40 px-4 py-2 rounded font-mono text-cyan-300 font-bold inline-block text-lg shadow-lg">
                        {nextGamePreview}
                      </div>
                    </motion.div>
                    {/* Retro Static lines */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none bg-cover bg-[url('https://media.giphy.com/media/oEI9uBYSzLpBK/giphy.gif')]" />
                  </div>
                )}

                {/* --- GAME OVER --- */}
                {status === 'gameover' && (
                  <div className="absolute inset-0 bg-[#090d16]/95 z-20 flex flex-col items-center justify-center p-6 text-center">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="text-rose-500 font-black text-4xl font-mono tracking-wider">
                        GAME OVER
                      </div>
                      <p className="text-xs text-slate-400">Your universal lives hit 0. Run logs saved to Local Core.</p>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg font-mono text-xs max-w-xs mx-auto space-y-2 text-left">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Coins Secured:</span>
                          <span className="text-yellow-400 font-bold">{coins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Dimensions Shifted:</span>
                          <span className="text-cyan-400 font-bold">{shiftsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Survival Duration:</span>
                          <span className="text-indigo-400 font-bold">{durationRef.current} seconds</span>
                        </div>
                      </div>

                      <button
                        id="btn-restart"
                        onClick={() => setStatus('menu')}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold py-2 px-6 rounded-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 mx-auto"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Back to Launcher
                      </button>
                    </motion.div>
                  </div>
                )}

                {/* Canvas Render viewport */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full block touch-none"
                  style={{ display: status === 'playing' || status === 'paused' ? 'block' : 'none' }}
                />
              </div>
            </div>

            {/* Game Helper / Control Display Area */}
            <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 font-black uppercase tracking-wider font-mono bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  {activeGame.name}
                </span>
              </div>
              <span className="text-slate-400 italic text-right truncate max-w-[240px]">
                {activeGame.description}
              </span>
            </div>

            {/* Cabinet Physical Panel Controls Wrapper */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-4 border-t-2 border-slate-800 space-y-4">
              {/* Manual Control help text */}
              <div className="bg-slate-950 border border-slate-800/80 rounded p-2 text-[11px] text-slate-400 font-mono flex items-start gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-cyan-400 font-bold">Input Bind:</span> {activeGame.controls}
                </div>
              </div>

              {/* Joystick / D-pad and Action button touch controllers for mobile/iframe */}
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Simulated D-pad */}
                <div className="col-span-7 flex justify-center">
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-2 rounded-xl border border-slate-800 max-w-[150px]">
                    <div />
                    <button
                      onMouseDown={() => sendTouchInput('up', 'down')}
                      onMouseUp={() => sendTouchInput('up', 'up')}
                      onTouchStart={(e) => { e.preventDefault(); sendTouchInput('up', 'down'); }}
                      onTouchEnd={(e) => { e.preventDefault(); sendTouchInput('up', 'up'); }}
                      className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-cyan-600 rounded flex items-center justify-center text-slate-300 active:text-white border border-slate-700 select-none shadow"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                    <div />

                    <button
                      onMouseDown={() => sendTouchInput('left', 'down')}
                      onMouseUp={() => sendTouchInput('left', 'up')}
                      onTouchStart={(e) => { e.preventDefault(); sendTouchInput('left', 'down'); }}
                      onTouchEnd={(e) => { e.preventDefault(); sendTouchInput('left', 'up'); }}
                      className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-cyan-600 rounded flex items-center justify-center text-slate-300 active:text-white border border-slate-700 select-none shadow"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">
                      <div className="w-3.5 h-3.5 bg-cyan-500 rounded-full animate-ping" />
                    </div>
                    <button
                      onMouseDown={() => sendTouchInput('right', 'down')}
                      onMouseUp={() => sendTouchInput('right', 'up')}
                      onTouchStart={(e) => { e.preventDefault(); sendTouchInput('right', 'down'); }}
                      onTouchEnd={(e) => { e.preventDefault(); sendTouchInput('right', 'up'); }}
                      className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-cyan-600 rounded flex items-center justify-center text-slate-300 active:text-white border border-slate-700 select-none shadow"
                    >
                      <ArrowRightIcon className="w-5 h-5" />
                    </button>

                    <div />
                    <button
                      onMouseDown={() => sendTouchInput('down', 'down')}
                      onMouseUp={() => sendTouchInput('down', 'up')}
                      onTouchStart={(e) => { e.preventDefault(); sendTouchInput('down', 'down'); }}
                      onTouchEnd={(e) => { e.preventDefault(); sendTouchInput('down', 'up'); }}
                      className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-cyan-600 rounded flex items-center justify-center text-slate-300 active:text-white border border-slate-700 select-none shadow"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                    <div />
                  </div>
                </div>

                {/* Simulated Large RED/PINK ACTION Button */}
                <div className="col-span-5 flex flex-col items-center gap-1.5">
                  <button
                    onMouseDown={() => sendTouchInput('action', 'down')}
                    onMouseUp={() => sendTouchInput('action', 'up')}
                    onTouchStart={(e) => { e.preventDefault(); sendTouchInput('action', 'down'); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendTouchInput('action', 'up'); }}
                    className="w-16 h-16 bg-gradient-to-tr from-pink-700 to-pink-500 hover:from-pink-600 hover:to-pink-400 border-b-4 border-pink-900 rounded-full flex items-center justify-center shadow-lg shadow-pink-500/10 active:scale-95 active:border-b-0 select-none text-white font-black text-sm tracking-widest font-mono"
                  >
                    ACTION
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Shoot/Jump</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ==================== RIGHT COLUMN: ARCHITECTURAL TELEMETRY & DB (Lg: 5) ==================== */}
        <section className="lg:col-span-5 flex flex-col gap-6">

          {/* Navigation Tab Header */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800/80 flex">
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${
                activeTab === 'telemetry'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              Machine Telemetry
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${
                activeTab === 'database'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              Database Architect
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* --- TAB 1: TELEMETRY & MEMORY CACHE --- */}
            {activeTab === 'telemetry' && (
              <motion.div
                key="telemetry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Shifting Core Metrics Panel */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                    <h3 className="text-sm font-black text-cyan-400 tracking-wider uppercase flex items-center gap-2 font-mono">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
                      Dimensional Shifter
                    </h3>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] bg-emerald-950/55 border border-emerald-500/20 px-2 py-0.5 rounded">
                      <Wifi className="w-3 h-3 animate-pulse" />
                      Active
                    </span>
                  </div>

                  {/* Hidden timer indicator */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Shift Timer Countdown</span>
                      <span className="font-mono text-2xl font-black text-rose-400 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                        {mode === 'practice' ? 'PRACTICE' : status === 'playing' ? `${timeUntilShift}s` : 'FROZEN'}
                      </span>
                      <span className="block text-[9px] text-slate-500 italic mt-0.5">Invisible to normal player</span>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Portal Target Grid</span>
                      <span className="font-mono text-sm font-black text-indigo-400 block truncate mt-1">
                        {mode === 'practice' ? 'N/A' : nextGamePreview}
                      </span>
                      <span className="block text-[9px] text-slate-500 mt-1">Random next node</span>
                    </div>
                  </div>

                  {/* Shifter Configuration controls */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-mono font-bold">SHIFT FREQUENCY FREQ:</span>
                      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded border border-slate-800">
                        <button
                          onClick={() => {
                            setShiftIntervalType('turbo');
                            setupShiftingTimer();
                          }}
                          className={`py-1 text-[11px] font-bold font-mono uppercase rounded transition-all ${
                            shiftIntervalType === 'turbo'
                              ? 'bg-pink-600 text-white shadow'
                              : 'text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          TURBO RATE (10s-15s)
                        </button>
                        <button
                          onClick={() => {
                            setShiftIntervalType('standard');
                            setupShiftingTimer();
                          }}
                          className={`py-1 text-[11px] font-bold font-mono uppercase rounded transition-all ${
                            shiftIntervalType === 'standard'
                              ? 'bg-pink-600 text-white shadow'
                              : 'text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          STANDARD (30s-5m)
                        </button>
                      </div>
                    </div>

                    {/* Shifter commands */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={forceManualShift}
                        disabled={status !== 'playing'}
                        className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 py-2 rounded font-mono text-xs font-bold active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        ⚡ FORCE SHIFT DIRECT
                      </button>
                      <button
                        onClick={() => setIsGodMode(!isGodMode)}
                        className={`py-2 rounded font-mono text-xs font-bold transition-all border ${
                          isGodMode
                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800/80 hover:text-slate-400'
                        }`}
                      >
                        🛡️ GOD MODE ({isGodMode ? 'ON' : 'OFF'})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Caching variables panel */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h3 className="text-sm font-black text-indigo-400 tracking-wider uppercase flex items-center gap-2 font-mono">
                      <Cpu className="w-4 h-4" />
                      Normal Mode RAM Cache (Frozen states)
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {Object.keys(savedStatesRef.current).length} / 20 Saved
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed font-mono">
                    When shifting in <span className="text-pink-400 font-semibold">Normal Mode</span>, the active micro-game's thread registers are compiled and cached instantly below:
                  </p>

                  {/* RAM Log JSON Box */}
                  <div className="bg-slate-950 rounded-lg border border-slate-850 p-4 font-mono text-xs h-[180px] overflow-y-auto space-y-2">
                    {Object.keys(savedStatesRef.current).length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-600 italic">
                        [Registers clear. Start run and shift to cache state]
                      </div>
                    ) : (
                      Object.entries(savedStatesRef.current).map(([gameId, state]) => (
                        <div key={gameId} className="border-b border-slate-800/40 pb-2 last:border-b-0">
                          <span className="text-pink-400 font-bold font-mono">RAM.{gameId.toUpperCase()}: </span>
                          <span className="text-cyan-400 font-mono break-all font-light">
                            {JSON.stringify(state)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TAB 2: DATABASE SCHEMA & RECRUITS --- */}
            {activeTab === 'database' && (
              <motion.div
                key="database"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Database Architect explanation */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h3 className="text-sm font-black text-cyan-400 tracking-wider uppercase flex items-center gap-2 font-mono">
                      <Database className="w-4 h-4" />
                      Persistent Cloud Storage Architect
                    </h3>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upon a <span className="text-rose-400 font-bold">GAME OVER</span> trigger, run telemetry splits and pushes to standard cloud databases. Here is the recommended structure and live schema:
                  </p>

                  {/* Schema DB selector tab */}
                  <div className="flex border-b border-slate-800">
                    {['firestore', 'supabase', 'mongodb'].map((db) => (
                      <button
                        key={db}
                        onClick={() => setDbTab(db as any)}
                        className={`flex-1 py-1 text-[11px] font-black tracking-widest uppercase border-b-2 font-mono transition-all ${
                          dbTab === db
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {db}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic schema definition and boilerplate code blocks */}
                  <div className="space-y-3">
                    {dbTab === 'firestore' && (
                      <div className="space-y-3">
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] space-y-1.5 text-slate-300">
                          <span className="text-cyan-400 font-bold block">// Firestore /runs collection document:</span>
                          <div>
                            <span className="text-pink-400">runs/</span><span className="text-slate-400">{"{runId}"}</span> : {"{"}
                          </div>
                          <div className="pl-4">timestamp: <span className="text-yellow-500">number</span>, <span className="text-slate-500">// epoch</span></div>
                          <div className="pl-4">mode: <span className="text-yellow-500">"normal" | "random"</span>,</div>
                          <div className="pl-4">coinsEarned: <span className="text-yellow-500">number</span>,</div>
                          <div className="pl-4">duration: <span className="text-yellow-500">number</span>, <span className="text-slate-500">// seconds</span></div>
                          <div className="pl-4">shiftsCount: <span className="text-yellow-500">number</span>,</div>
                          <div className="pl-4">gamesPlayed: <span className="text-yellow-500">string[]</span> <span className="text-slate-500">// unique game IDs</span></div>
                          <div>{"}"}</div>
                        </div>

                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                          <span className="text-indigo-400 font-bold block">// Write SDK Boilerplate:</span>
                          <span className="text-slate-400">import {"{ addDoc, collection }"} from 'firebase/firestore';</span>
                          <span className="text-slate-400">const saveRun = async (runData) =&gt; {"{"}</span>
                          <span className="text-slate-400 pl-4">await addDoc(collection(db, 'runs'), runData);</span>
                          <span className="text-slate-400">{"}"};</span>
                        </div>
                      </div>
                    )}

                    {dbTab === 'supabase' && (
                      <div className="space-y-3">
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] space-y-1.5 text-slate-300">
                          <span className="text-cyan-400 font-bold block">-- PostgreSQL DDL Table Script:</span>
                          <div className="text-slate-400">CREATE TABLE run_history (</div>
                          <div className="pl-4 text-slate-400">id UUID PRIMARY KEY DEFAULT gen_random_uuid(),</div>
                          <div className="pl-4 text-slate-400">created_at TIMESTAMPTZ DEFAULT NOW(),</div>
                          <div className="pl-4 text-slate-400">game_mode VARCHAR(20) NOT NULL,</div>
                          <div className="pl-4 text-slate-400">coins INT DEFAULT 0,</div>
                          <div className="pl-4 text-slate-400">survival_time INT DEFAULT 0,</div>
                          <div className="pl-4 text-slate-400">shifts INT DEFAULT 0,</div>
                          <div className="pl-4 text-slate-400">games_played TEXT[]</div>
                          <div className="text-slate-400">);</div>
                        </div>

                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                          <span className="text-indigo-400 font-bold block">// client insert:</span>
                          <span className="text-slate-400">const {"{ data, error }"} = await supabase</span>
                          <span className="text-slate-400 pl-4">.from('run_history')</span>
                          <span className="text-slate-400 pl-4">.insert([runData]);</span>
                        </div>
                      </div>
                    )}

                    {dbTab === 'mongodb' && (
                      <div className="space-y-3">
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] space-y-1.5 text-slate-300">
                          <span className="text-cyan-400 font-bold block">// MongoDB Mongoose schema design:</span>
                          <span className="text-slate-400">const RunSchema = new mongoose.Schema({"{"}</span>
                          <div className="pl-4 text-slate-400">mode: {"{ type: String, enum: ['normal', 'random'] }"},</div>
                          <div className="pl-4 text-slate-400">coinsEarned: Number,</div>
                          <div className="pl-4 text-slate-400">duration: Number,</div>
                          <div className="pl-4 text-slate-400">shiftsCount: Number,</div>
                          <div className="pl-4 text-slate-400">gamesPlayed: [String]</div>
                          <span className="text-slate-400">{"}, { timestamps: true });"}</span>
                        </div>

                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                          <span className="text-indigo-400 font-bold block">// insertion:</span>
                          <span className="text-slate-400">const Run = mongoose.model('Run', RunSchema);</span>
                          <span className="text-slate-400">await Run.create(runData);</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Local Run Logs database viewer */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h3 className="text-sm font-black text-indigo-400 tracking-wider uppercase flex items-center gap-2 font-mono">
                      <Terminal className="w-4 h-4" />
                      Live Core Local DB Run Logger
                    </h3>
                  </div>

                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto">
                    {runHistory.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-600 italic">
                        [No runs logged yet. Complete a game run to log statistics]
                      </div>
                    ) : (
                      runHistory.map((run, i) => (
                        <div key={run.id} className="bg-slate-950 p-3 rounded border border-slate-850 space-y-2">
                          <div className="flex justify-between text-[11px] border-b border-slate-850 pb-1.5">
                            <span className="text-indigo-400 font-bold">#RUN {runHistory.length - i}</span>
                            <span className="text-slate-500 font-mono">{new Date(run.timestamp).toLocaleTimeString()}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-500">MODE:</span>
                              <span className="text-slate-300 font-bold uppercase">{run.mode}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">COINS:</span>
                              <span className="text-yellow-400 font-bold">{run.coinsEarned}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">TIME:</span>
                              <span className="text-cyan-400 font-bold">{run.duration}s</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">SHIFTS:</span>
                              <span className="text-pink-400 font-bold">{run.shiftsCount}</span>
                            </div>
                          </div>

                          <div className="text-[9px] font-mono text-slate-500 truncate mt-1">
                            🎮 GAMES: {run.gamesPlayed.join(', ').toUpperCase()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </section>

      </main>

      {/* Decorative Technical Info Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 mt-12 text-center text-[11px] text-slate-500 font-mono border-t border-slate-900 pt-6">
        <p className="flex justify-center items-center gap-1">
          <Cpu className="w-3.5 h-3.5" />
          ShiftArcade Matrix Core • Compiled with React + TypeScript • Virtual Display Resolution 400x400
        </p>
      </footer>
    </div>
  );
}
