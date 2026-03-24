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
  const fillPct = muted ? 0 : Math.max(0, Math.min(100, volPct));

  return (
    <div
      className="glass relative rounded-2xl flex flex-col items-center py-3 gap-1 min-w-[64px] overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 rounded-b-2xl transition-all duration-300 pointer-events-none"
        style={{
          height: `${fillPct}%`,
          background: muted
            ? "linear-gradient(180deg, rgba(251,146,60,0.18) 0%, rgba(251,146,60,0.38) 100%)"
            : "linear-gradient(180deg, rgba(84,160,219,0.18) 0%, rgba(73,145,206,0.42) 55%, rgba(59,130,246,0.7) 100%)",
        }}
      />

      <button
        className="vol-btn relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 cursor-pointer"
        onClick={() => {
          setVolume((v) => Math.min(v + 1, volumeMax));
          sendKey("VOL_UP");
        }}
        title="Volume Up (⇧↑)"
      >
        <span className="text-[28px] leading-none -translate-y-[1px]">+</span>
      </button>

      <div className="relative z-10 flex flex-col items-center gap-1 px-2 w-full pointer-events-none select-none">
        <span className="text-[30px] leading-none font-extralight text-white/90">{volume}</span>
        <span className="text-[10px] mt-0.5 font-semibold text-white/80 tracking-[0.2em] uppercase">
          {muted ? "MUTED" : "VOL"}
        </span>
      </div>

      <button
        className="vol-btn relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 cursor-pointer"
        onClick={() => {
          setVolume((v) => Math.max(0, v - 1));
          sendKey("VOL_DOWN");
        }}
        title="Volume Down (⇧↓)"
      >
        <span className="text-[28px] leading-none -translate-y-[2px]">-</span>
      </button>
    </div>
  );
}
