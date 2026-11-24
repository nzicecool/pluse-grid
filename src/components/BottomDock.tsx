import { Camera, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { CameraPreset, GamePhase } from '../types/game';

interface BottomDockProps {
  phase: GamePhase;
  collapsed: boolean;
  onToggleCollapse: () => void;
  cameraPreset: CameraPreset;
  onSelectCamera: (preset: CameraPreset) => void;
  muted: boolean;
  onToggleMute: () => void;
}

const PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'angled', label: 'Angled' },
  { id: 'wide', label: 'Wide' },
];

export function BottomDock({
  phase,
  collapsed,
  onToggleCollapse,
  cameraPreset,
  onSelectCamera,
  muted,
  onToggleMute,
}: BottomDockProps) {
  return (
    <div
      className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-transform duration-200"
      style={{
        transform: collapsed ? 'translate(-50%, calc(100% - 28px))' : 'translate(-50%, 0)',
        maxWidth: 'min(940px, 94vw)',
      }}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0d131f]/95 border border-b-0 border-slate-700/80 text-[11px] font-semibold tracking-wider uppercase text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
        title="Toggle Controls (H)"
      >
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span>{collapsed ? 'Show Controls' : 'Hide Controls'}</span>
      </button>

      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 sm:gap-4 px-4 py-2.5 rounded-xl bg-[#0b101b]/95 border border-slate-700/80 shadow-2xl">
        {/* Signal Legend Swatches */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-300 pr-2 border-r border-slate-800">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span>Tap</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>×2 Double</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            <span>1·2·3 Order</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>✕ Avoid</span>
          </span>
        </div>

        {/* Camera Angle Presets */}
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
          {PRESETS.map((p) => {
            const active = cameraPreset === p.id && phase !== 'title';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectCamera(p.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                    : 'bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:text-white hover:border-slate-500'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Audio Toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-200 hover:text-cyan-300 hover:border-slate-500 transition-colors cursor-pointer"
          title="Mute / Unmute Audio (M)"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          <span>{muted ? 'Muted' : 'Audio On'}</span>
        </button>
      </div>
    </div>
  );
}
