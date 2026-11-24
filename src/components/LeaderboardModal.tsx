import { Trash2, Trophy, X } from 'lucide-react';
import { LeaderboardEntry } from '../types/game';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  onClose: () => void;
  onClear: () => void;
}

export function LeaderboardModal({ entries, onClose, onClear }: LeaderboardModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#05080f]/80 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#0c1220] border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">Local Leaderboard</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Leaderboard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-800 bg-[#080c16]">
          {entries.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-400">
              No recorded sessions yet. Complete a run to set the benchmark on this device.
            </div>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#0d1424] text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Callsign</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-3 text-right">Wave</th>
                  <th className="py-2.5 px-3 text-right">Avg RT</th>
                  <th className="py-2.5 px-3 text-right hidden sm:table-cell">Acc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {entries.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-400">
                      {idx === 0 ? (
                        <span className="text-amber-400 font-bold">01</span>
                      ) : (
                        String(idx + 1).padStart(2, '0')
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-100">{entry.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-cyan-300">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-300">W{entry.wave}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-300">
                      {entry.avgReactionMs > 0 ? `${entry.avgReactionMs}ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-300 hidden sm:table-cell">
                      {entry.accuracy}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Local Scores</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold tracking-wide transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
