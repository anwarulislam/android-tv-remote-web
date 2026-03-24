import { useEffect } from "react";

export function useRemoteHotkeys({
  sendKey,
  sendText,
  setVolume,
  openIme,
  disabled = false,
}: {
  sendKey: (key: string) => void;
  sendText: (text: string) => void;
  setVolume: (value: number | ((prev: number) => number)) => void;
  openIme: () => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (disabled) return;

      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const meta = e.metaKey || e.ctrlKey;

      if (!meta && !e.shiftKey) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          void sendKey("UP");
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          void sendKey("DOWN");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          void sendKey("LEFT");
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          void sendKey("RIGHT");
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          void sendKey("ENTER");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          void sendKey("BACK");
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          void sendKey("BACKSPACE");
          return;
        }
        if (e.key === " ") {
          e.preventDefault();
          void sendKey("PLAY_PAUSE");
          return;
        }
      }

      if (e.shiftKey && !meta) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setVolume((v) => v + 1);
          void sendKey("VOL_UP");
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 1));
          void sendKey("VOL_DOWN");
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          void sendKey("FF");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          void sendKey("REWIND");
          return;
        }
      }

      if (meta) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          void sendKey("NEXT");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          void sendKey("PREV");
          return;
        }
        if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          void sendKey("MUTE");
          return;
        }
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          void sendKey("HOME");
          return;
        }
        if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          void openIme();
          return;
        }
      }

      if (!meta && !e.altKey && e.key.length === 1) {
        e.preventDefault();
        void sendText(e.key);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, openIme, sendKey, sendText, setVolume]);
}
