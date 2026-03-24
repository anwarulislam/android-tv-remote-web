import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

export function DPadControls({ sendKey }: { sendKey: (key: string) => void }) {
  return (
    <div className="glass rounded-3xl p-6 flex items-center justify-center">
      <div className="relative w-[210px] h-[210px] sm:w-[220px] sm:h-[220px]">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, #2a2a38, #111115)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />

        <button
          className="absolute flex items-center justify-center cursor-pointer bg-transparent border-none text-white/50 hover:text-white transition-all active:text-indigo-400 active:scale-90"
          style={{
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 60,
            height: 60,
          }}
          onClick={() => sendKey("UP")}
          title="Up (↑)"
        >
          <ChevronUp size={32} strokeWidth={1.5} />
        </button>
        <button
          className="absolute flex items-center justify-center cursor-pointer bg-transparent border-none text-white/50 hover:text-white transition-all active:text-indigo-400 active:scale-90"
          style={{
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            width: 60,
            height: 60,
          }}
          onClick={() => sendKey("LEFT")}
          title="Left (←)"
        >
          <ChevronLeft size={32} strokeWidth={1.5} />
        </button>

        <button
          className="dpad-center absolute flex items-center justify-center cursor-pointer border border-white/10 rounded-full text-white/80 hover:text-white font-semibold text-xs tracking-widest"
          style={{
            top: "50%",
            left: "50%",
            width: 80,
            height: 80,
            transform: "translate(-50%, -50%)",
          }}
          onClick={() => sendKey("ENTER")}
          title="OK (Enter)"
        >
          OK
        </button>

        <button
          className="absolute flex items-center justify-center cursor-pointer bg-transparent border-none text-white/50 hover:text-white transition-all active:text-indigo-400 active:scale-90"
          style={{
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            width: 60,
            height: 60,
          }}
          onClick={() => sendKey("RIGHT")}
          title="Right (→)"
        >
          <ChevronRight size={32} strokeWidth={1.5} />
        </button>
        <button
          className="absolute flex items-center justify-center cursor-pointer bg-transparent border-none text-white/50 hover:text-white transition-all active:text-indigo-400 active:scale-90"
          style={{
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 60,
            height: 60,
          }}
          onClick={() => sendKey("DOWN")}
          title="Down (↓)"
        >
          <ChevronDown size={32} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
