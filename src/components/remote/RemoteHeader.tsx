import { Power, Settings, Tv2 } from "lucide-react";

export function RemoteHeader({
  tvName,
  muted,
  onSettingsClick,
  onPowerClick,
}: {
  tvName: string;
  muted: boolean;
  onSettingsClick: () => void;
  onPowerClick: () => void;
}) {
  return (
    <header className="flex justify-between items-center px-1">
      <button
        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-all active:scale-90"
        onClick={onSettingsClick}
        title="Switch device (Settings)"
      >
        <Settings size={16} />
      </button>

      <div className="flex items-center gap-2.5 bg-white/5 border border-white/8 rounded-full px-4 py-2">
        <Tv2 size={14} className="text-indigo-400" />
        <span className="text-sm font-medium text-white/85">{tvName}</span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: muted ? "#fb923c" : "#34d399",
            boxShadow: muted ? "0 0 6px #fb923c" : "0 0 6px #34d399",
          }}
        />
      </div>

      <button
        className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 cursor-pointer transition-all active:scale-90"
        onClick={onPowerClick}
        title="Power"
      >
        <Power size={16} />
      </button>
    </header>
  );
}
