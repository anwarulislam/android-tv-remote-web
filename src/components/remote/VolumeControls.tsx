import { Volume1, Volume2 } from "lucide-react";

export function VolumeControls({
  volume,
  volumeMax,
  muted,
  volPct,
  setVolume,
  sendKey,
}: {
  volume: number;
  volumeMax: number;
  muted: boolean;
  volPct: number;
  setVolume: (value: number | ((prev: number) => number)) => void;
  sendKey: (key: string) => void;
}) {
  return (
    <div className="glass rounded-2xl flex flex-col items-center py-3 gap-1 min-w-[64px]">
      <button
        className="vol-btn w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 cursor-pointer"
        onClick={() => {
          setVolume((v) => Math.min(v + 1, volumeMax));
          sendKey("VOL_UP");
        }}
        title="Volume Up (⇧↑)"
      >
        <Volume2 size={18} />
      </button>
      <div className="flex flex-col items-center gap-1 px-2 w-full">
        <span className="text-[10px] font-semibold text-white/30 tracking-widest uppercase truncate max-w-full">
          {muted ? "MUTED" : "VOL"}
        </span>
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${volPct}%`,
              background: muted ? "#fb923c" : "#6366f1",
            }}
          />
        </div>
        <span className="text-xs font-bold text-white/60">{volume}</span>
      </div>
      <button
        className="vol-btn w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 cursor-pointer"
        onClick={() => {
          setVolume((v) => Math.max(0, v - 1));
          sendKey("VOL_DOWN");
        }}
        title="Volume Down (⇧↓)"
      >
        <Volume1 size={18} />
      </button>
    </div>
  );
}
