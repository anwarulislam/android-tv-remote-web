import { useEffect } from "react";
import type React from "react";

export function useRemoteKeyboardShortcuts({
  imeInputRef,
  sendKey,
  setVolume,
  openIme,
}: {
  imeInputRef: React.RefObject<HTMLTextAreaElement | null>;
  sendKey: (key: string) => void;
  setVolume: (value: number | ((prev: number) => number)) => void;
  openIme: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (document.activeElement === imeInputRef.current) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const meta = e.metaKey || e.ctrlKey;

      if (!meta && !e.shiftKey) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          sendKey("UP");
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          sendKey("DOWN");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          sendKey("LEFT");
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          sendKey("RIGHT");
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          sendKey("ENTER");
          return;
        }
        if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          sendKey("BACK");
          return;
        }
        if (e.key === " ") {
          e.preventDefault();
          sendKey("PLAY_PAUSE");
          return;
        }
      }

      if (e.shiftKey && !meta) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setVolume((v) => v + 1);
          sendKey("VOL_UP");
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 1));
          sendKey("VOL_DOWN");
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          sendKey("FF");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          sendKey("REWIND");
          return;
        }
      }

      if (meta) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          sendKey("NEXT");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          sendKey("PREV");
          return;
        }
        if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          sendKey("MUTE");
          return;
        }
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          sendKey("HOME");
          return;
        }
        if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          openIme();
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imeInputRef, openIme, sendKey, setVolume]);
}
