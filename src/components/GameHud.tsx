import { Pause, Shield, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../types/game';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

export function GameHud({ hud, muted, onToggleMute, onTogglePause }: GameHudProps) {
  const showGrade = hud.reactionGrade && performance.now() - hud.gradeTimestamp < 950;
  const gradeColor =
    hud.reactionGrade === 'LIGHTNING'
      ? 'text-cyan-300'
      : hud.reactionGrade === 'SHARP'
        ? 'text-emerald-300'
        : hud.reactionGrade === 'WAVE CLEAR'
          ? 'text-amber-300'
          : hud.reactionGrade === 'MISS' || hud.reactionGrade === 'HAZARD'
            ? 'text-rose-400'
            : 'text-slate-200';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Perimeter Status Clusters (Zero center occlusion) */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Score, Combo & Wave/Pattern */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-[#0b101b]/90 border border-slate-700/80">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Score</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-cyan-300 font-mono-tabular leading-none mt-0.5">
                {hud.score.toLocaleString()}
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Combo</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold text-white font-mono-tabular leading-none">
                  {hud.combo}
                </span>
                <span className="text-xs font-bold text-amber-400 font-mono-tabular">
                  {hud.multiplier.toFixed(1)}×
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

            <div className="hidden sm:block">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Wave {hud.wave} · {hud.speedFactor.toFixed(2)}×
              </div>
              <div className="text-sm font-bold text-slate-100 tracking-wide mt-0.5">{hud.patternName}</div>
              <div className="w-28 h-1 rounded-full bg-slate-800 mt-1 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150"
                  style={{ width: `${Math.round(hud.waveProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Crisp Reaction Telemetry Badge */}
          {showGrade && (
            <div className="inline-flex self-start items-center gap-2 px-3 py-1 rounded-lg bg-[#0b101b]/90 border border-slate-700/70">
              <span className={`text-xs font-extrabold tracking-wider ${gradeColor}`}>{hud.reactionGrade}</span>
              {hud.lastReactionMs !== null && hud.reactionGrade !== 'WAVE CLEAR' && hud.reactionGrade !== 'MISS' && hud.reactionGrade !== 'HAZARD' && (
                <span className="text-xs font-mono-tabular text-slate-300">{hud.lastReactionMs} ms</span>
              )}
            </div>
          )}
        </div>

        {/* Top-Right: Shields, Avg RT, Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#0b101b]/90 border border-slate-700/80">
            <div className="flex items-center gap-1" title="Remaining Shields">
              {Array.from({ length: hud.maxLives }).map((_, i) => {
                const active = i < hud.lives;
                return (
                  <Shield
                    key={i}
                    className={`w-4 h-4 sm:w-5 sm:h-5 ${
                      active ? 'text-cyan-400 fill-cyan-400/25' : 'text-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            <div className="h-6 w-px bg-slate-800" />

            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Avg RT</div>
              <div className="text-sm font-bold text-slate-100 font-mono-tabular">
                {hud.avgReactionMs > 0 ? `${hud.avgReactionMs} ms` : '—'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            className="pointer-events-auto p-2.5 rounded-xl bg-[#0b101b]/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Mute / Unmute (M)"
          >
            {muted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            className="pointer-events-auto p-2.5 rounded-xl bg-[#0b101b]/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Pause (Esc)"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
