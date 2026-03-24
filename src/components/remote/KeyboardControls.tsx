import { Keyboard } from "lucide-react";
import { IconBtn } from "./IconBtn";

export function KeyboardControls({ openIme }: { openIme: () => void }) {
  return (
    <IconBtn
      onClick={openIme}
      title="Keyboard (⌘K)"
      className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
    >
      <Keyboard size={18} />
    </IconBtn>
  );
}
