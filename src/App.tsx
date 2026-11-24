import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { BottomDock } from './components/BottomDock';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { PauseModal } from './components/PauseModal';
import { TitleOverlay } from './components/TitleOverlay';
import { ReflexGameEngine } from './three/ReflexGameEngine';
import { CameraPreset, HudSnapshot, LeaderboardEntry } from './types/game';
import {
  clearLeaderboard,
  getPersonalBest,
  loadLeaderboard,
  saveLeaderboardEntry,
} from './utils/leaderboard';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  highScore: getPersonalBest(),
  wave: 1,
  patternName: 'SINGLE PULSE',
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  lives: 3,
  maxLives: 3,
  avgReactionMs: 0,
  lastReactionMs: null,
  accuracy: 100,
  hits: 0,
  totalAttempts: 0,
  waveProgress: 0,
  speedFactor: 1,
  reactionGrade: '',
  gradeTimestamp: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReflexGameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('front');
  const [muted, setMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());

  const phaseRef = useRef(hud.phase);
  phaseRef.current = hud.phase;

  const leaderboardOpenRef = useRef(leaderboardOpen);
  leaderboardOpenRef.current = leaderboardOpen;

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new ReflexGameEngine(mountEl, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      if (!next) soundEngine.playUiClick();
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    setLeaderboardOpen(false);
    engineRef.current?.startGame();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleReturnToTitle = useCallback(() => {
    soundEngine.playUiClick();
    engineRef.current?.returnToTitle();
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
  }, []);

  const handleSaveScore = useCallback(
    (name: string) => {
      const updated = saveLeaderboardEntry({
        name,
        score: hud.score,
        wave: hud.wave,
        avgReactionMs: hud.avgReactionMs,
        accuracy: hud.accuracy,
        maxCombo: hud.maxCombo,
      });
      setLeaderboard(updated);
      engineRef.current?.refreshHighScore();
      soundEngine.playUiClick();
    },
    [hud.score, hud.wave, hud.avgReactionMs, hud.accuracy, hud.maxCombo],
  );

  const handleClearLeaderboard = useCallback(() => {
    clearLeaderboard();
    setLeaderboard([]);
    engineRef.current?.refreshHighScore();
    soundEngine.playUiClick();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Escape') {
        if (leaderboardOpenRef.current) {
          setLeaderboardOpen(false);
          return;
        }
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          engineRef.current?.togglePause();
        }
        return;
      }

      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        if (leaderboardOpenRef.current) return;
        if (phaseRef.current === 'title' || phaseRef.current === 'gameover') {
          e.preventDefault();
          engineRef.current?.startGame();
        }
        return;
      }

      if (e.code === 'KeyM' && !e.repeat) {
        handleToggleMute();
      } else if (e.code === 'KeyH' && !e.repeat) {
        setDockCollapsed((c) => !c);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleMute]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070a10]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen Overlay */}
      {hud.phase === 'title' && (
        <TitleOverlay
          highScore={hud.highScore}
          onStart={handleStart}
          onOpenLeaderboard={() => {
            soundEngine.playUiClick();
            setLeaderboard(loadLeaderboard());
            setLeaderboardOpen(true);
          }}
        />
      )}

      {/* Active Gameplay Perimeter HUD */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
        />
      )}

      {/* Collapsible Bottom Control Dock (Title + Playing) */}
      {(hud.phase === 'title' || hud.phase === 'playing') && !leaderboardOpen && (
        <BottomDock
          phase={hud.phase}
          collapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
          cameraPreset={cameraPreset}
          onSelectCamera={handleSelectCamera}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <PauseModal
          hud={hud}
          onResume={handleTogglePause}
          onRestart={handleStart}
          onQuitToTitle={handleReturnToTitle}
        />
      )}

      {/* Game Over + Local Leaderboard Modal */}
      {hud.phase === 'gameover' && (
        <GameOverModal
          hud={hud}
          entries={leaderboard}
          onSaveScore={handleSaveScore}
          onPlayAgain={handleStart}
          onReturnToTitle={handleReturnToTitle}
        />
      )}

      {/* Standalone Local Leaderboard Modal (from Title Screen) */}
      {leaderboardOpen && hud.phase === 'title' && (
        <LeaderboardModal
          entries={leaderboard}
          onClose={() => setLeaderboardOpen(false)}
          onClear={handleClearLeaderboard}
        />
      )}
    </div>
  );
}
