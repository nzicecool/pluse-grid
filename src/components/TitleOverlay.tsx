import { Play, Trophy } from 'lucide-react';

interface TitleOverlayProps {
  highScore: number;
  onStart: () => void;
  onOpenLeaderboard: () => void;
}

export function TitleOverlay({ highScore, onStart, onOpenLeaderboard }: TitleOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-8">
      {/* Top-Left Bespoke Inline SVG Title Lockup (Calm Negative Space) */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto max-w-md">
          <svg
            viewBox="0 0 380 84"
            className="w-[260px] sm:w-[340px] h-auto"
            role="img"
            aria-label="Pulse Grid 3D"
          >
            <defs>
              <linearGradient id="pgCyan" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            {/* Geometric 4-Node Reflex Emblem */}
            <rect x="4" y="10" width="54" height="54" rx="10" fill="#0d1524" stroke="#1e293b" strokeWidth="2.5" />
            <circle cx="21" cy="27" r="7" fill="#00f0ff" />
            <circle cx="41" cy="27" r="7" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="21" cy="47" r="7" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="41" cy="47" r="7" fill="#ffaa00" />
            <path d="M21 27 L41 47" stroke="#00f0ff" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />

            {/* Wordmark */}
            <text
              x="74"
              y="36"
              fill="#f8fafc"
              fontSize="30"
              fontWeight="800"
              letterSpacing="1.5"
              fontFamily="Inter, system-ui, sans-serif"
            >
              PULSE GRID
            </text>
            <rect x="278" y="15" width="44" height="24" rx="5" fill="url(#pgCyan)" />
            <text
              x="300"
              y="32"
              textAnchor="middle"
              fill="#06101c"
              fontSize="15"
              fontWeight="900"
              fontFamily="ui-monospace, monospace"
            >
              3D
            </text>
            <text
              x="75"
              y="58"
              fill="#94a3b8"
              fontSize="12"
              fontWeight="600"
              letterSpacing="2.4"
              fontFamily="ui-monospace, monospace"
            >
              HAND-EYE REFLEX TRAINER
            </text>
          </svg>

          <p className="mt-2 text-xs sm:text-sm text-slate-300/90 max-w-xs leading-relaxed">
            Strike illuminated pods on the 3D board as reaction windows tighten and multi-node patterns escalate.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START SESSION</span>
            </button>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0d1422]/95 hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>LEADERBOARD</span>
              {highScore > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-xs font-mono-tabular">
                  {highScore.toLocaleString()}
                </span>
              )}
            </button>
          </div>

          <div className="mt-3 text-[11px] font-mono-tabular tracking-wide text-slate-400">
            Click / Tap Lit Pods · Enter Start · Esc Pause · M Mute · H Controls
          </div>
        </div>
      </div>
    </div>
  );
}
