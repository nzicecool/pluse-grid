import { FormEvent, useState } from 'react';
import { Check, Home, RotateCcw, Trophy } from 'lucide-react';
import { HudSnapshot, LeaderboardEntry } from '../types/game';

interface GameOverModalProps {
  hud: HudSnapshot;
  entries: LeaderboardEntry[];
  onSaveScore: (name: string) => void;
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
}

export function GameOverModal({
  hud,
  entries,
  onSaveScore,
  onPlayAgain,
  onReturnToTitle,
}: GameOverModalProps) {
  const [callsign, setCallsign] = useState('PLAYER');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (saved) return;
    onSaveScore(callsign);
    setSaved(true);
  };

  const isNewRecord = hud.score > 0 && hud.score >= hud.highScore;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#05080f]/82 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0c1220] border border-slate-700 p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-rose-400">
              Session Complete
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              Telemetry Debrief
            </h2>
          </div>

          {isNewRecord && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              <span>NEW PERSONAL BEST</span>
            </div>
          )}
        </div>

        {/* Performance Summary Strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="rounded-xl bg-[#080c16] border border-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Final Score</div>
            <div className="text-xl font-extrabold text-cyan-300 font-mono-tabular mt-0.5">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-[#080c16] border border-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Peak Wave</div>
            <div className="text-xl font-extrabold text-white font-mono-tabular mt-0.5">W{hud.wave}</div>
          </div>
          <div className="rounded-xl bg-[#080c16] border border-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg Reaction</div>
            <div className="text-xl font-extrabold text-emerald-300 font-mono-tabular mt-0.5">
              {hud.avgReactionMs > 0 ? `${hud.avgReactionMs}ms` : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-[#080c16] border border-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Accuracy</div>
            <div className="text-xl font-extrabold text-slate-100 font-mono-tabular mt-0.5">
              {hud.accuracy}%
            </div>
          </div>
          <div className="rounded-xl bg-[#080c16] border border-slate-800 p-3 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Best Streak</div>
            <div className="text-xl font-extrabold text-amber-300 font-mono-tabular mt-0.5">
              {hud.maxCombo}
            </div>
          </div>
        </div>

        {/* Save to Local Leaderboard Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            maxLength={14}
            value={callsign}
            disabled={saved}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="ENTER CALLSIGN"
            className="flex-1 px-3.5 py-2 rounded-lg bg-[#080c16] border border-slate-700 focus:border-cyan-400 focus:outline-none text-sm font-bold uppercase tracking-wider text-white placeholder:text-slate-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={saved}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-colors cursor-pointer ${
              saved
                ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 cursor-default'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
            <span>{saved ? 'RECORD SAVED' : 'SAVE SCORE'}</span>
          </button>
        </form>

        {/* Local Top 5 Leaderboard */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-[#080c16] overflow-hidden">
          <div className="px-3.5 py-2 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Local Leaderboard (Top Records)
            </span>
            <span className="text-[11px] font-mono-tabular text-slate-500">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="py-5 text-center text-xs text-slate-500">
              Save your callsign above to claim #1 on the local board.
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-slate-800/70">
                  {entries.slice(0, 6).map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-mono-tabular text-slate-400 w-10">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-100">{entry.name}</td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-bold text-cyan-300">
                        {entry.score.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-slate-400">
                        W{entry.wave}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-emerald-300">
                        {entry.avgReactionMs > 0 ? `${entry.avgReactionMs}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onReturnToTitle}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>

          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN (ENTER)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
