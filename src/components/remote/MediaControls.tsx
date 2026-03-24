import { FastForward, Play, Rewind, SkipBack, SkipForward } from "lucide-react";

export function MediaControls({ sendKey }: { sendKey: (key: string) => void }) {
  return (
    <div className="glass rounded-2xl px-3 py-3 flex items-center justify-between">
      <button
        className="media-btn w-10 h-10 rounded-xl text-white/40 hover:text-white hover:bg-white/8 flex items-center justify-center cursor-pointer"
        onClick={() => sendKey("PREV")}
        title="Prev (⌘←)"
      >
        <SkipBack size={18} />
      </button>
      <button
        className="media-btn w-10 h-10 rounded-xl text-white/40 hover:text-white hover:bg-white/8 flex items-center justify-center cursor-pointer"
        onClick={() => sendKey("REWIND")}
        title="Rewind (⇧←)"
      >
        <Rewind size={18} />
      </button>

      <button
        className="media-btn rounded-2xl bg-white text-zinc-900 flex items-center justify-center cursor-pointer hover:bg-zinc-100 shadow-lg shadow-white/10 active:scale-90"
        style={{ width: 52, height: 52 }}
        onClick={() => sendKey("PLAY_PAUSE")}
        title="Play/Pause (Space)"
      >
        <Play size={22} fill="currentColor" className="translate-x-0.5" />
      </button>

      <button
        className="media-btn w-10 h-10 rounded-xl text-white/40 hover:text-white hover:bg-white/8 flex items-center justify-center cursor-pointer"
        onClick={() => sendKey("FF")}
        title="Fast Forward (⇧→)"
      >
        <FastForward size={18} />
      </button>
      <button
        className="media-btn w-10 h-10 rounded-xl text-white/40 hover:text-white hover:bg-white/8 flex items-center justify-center cursor-pointer"
        onClick={() => sendKey("NEXT")}
        title="Next (⌘→)"
      >
        <SkipForward size={18} />
      </button>
    </div>
  );
}
