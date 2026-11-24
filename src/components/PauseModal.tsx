import { Home, Play, RotateCcw } from 'lucide-react';
import { HudSnapshot } from '../types/game';

interface PauseModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PauseModal({ hud, onResume, onRestart, onQuitToTitle }: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#05080f]/75 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0c1220] border border-slate-700 p-6 shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-400">Session Paused</div>
        <h2 className="text-2xl font-extrabold text-white mt-1">Take a Breather</h2>

        <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-lg bg-[#080c16] border border-slate-800 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Score</div>
            <div className="text-base font-bold text-cyan-300 font-mono-tabular mt-0.5">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-[#080c16] border border-slate-800 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Wave</div>
            <div className="text-base font-bold text-white font-mono-tabular mt-0.5">{hud.wave}</div>
          </div>
          <div className="rounded-lg bg-[#080c16] border border-slate-800 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg RT</div>
            <div className="text-base font-bold text-emerald-300 font-mono-tabular mt-0.5">
              {hud.avgReactionMs > 0 ? `${hud.avgReactionMs}ms` : '—'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME (ESC)</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTART SESSION</span>
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-transparent hover:bg-slate-800/70 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
}
