import { ArrowLeft, Home, Menu, Mic, VolumeX } from "lucide-react";
import { KeyboardControls } from "./KeyboardControls";
import { IconBtn } from "./IconBtn";

export function ActionGrid({ sendKey }: { sendKey: (key: string) => void }) {
  return (
    <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3">
      <KeyboardControls />
      <IconBtn
        onClick={() => sendKey("HOME")}
        title="Home (⌘H)"
        className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
      >
        <Home size={18} />
      </IconBtn>
      <IconBtn
        onClick={() => sendKey("MUTE")}
        title="Mute (⌘M)"
        className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
      >
        <VolumeX size={18} />
      </IconBtn>
      <IconBtn
        onClick={() => sendKey("MIC")}
        title="Voice search"
        className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
      >
        <Mic size={18} />
      </IconBtn>
      <IconBtn
        onClick={() => sendKey("MENU")}
        title="Menu"
        className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
      >
        <Menu size={18} />
      </IconBtn>
      <IconBtn
        onClick={() => sendKey("BACK")}
        title="Back (Esc/⌫)"
        className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
      >
        <ArrowLeft size={18} />
      </IconBtn>
    </div>
  );
}
