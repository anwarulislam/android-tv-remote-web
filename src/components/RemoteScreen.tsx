import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FastForward,
  Home,
  Keyboard,
  Menu,
  Mic,
  Play,
  Power,
  Rewind,
  Send,
  Settings,
  SkipBack,
  SkipForward,
  Tv2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAndroidTV } from "../hooks/useAndroidTV";

/* ── Small helpers ─────────────────────────────────────── */

const IconBtn = ({
  children,
  onClick,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`action-btn flex items-center justify-center rounded-xl cursor-pointer border-none focus:outline-none ${className}`}
  >
    {children}
  </button>
);

/* ── Main component ────────────────────────────────────── */

export function RemoteScreen() {
  const {
    tvName,
    ip,
    volume,
    volumeMax,
    muted,
    setVolume,
    sendKey,
    sendText,
    sendTextWithCursor,
    sendCursorPosition,
    sendShortcut,
    imeOpen,
    imeLabel,
    imeValue,
    setImeOpen,
    getImeValue,
    initApp,
  } = useAndroidTV();

  // Local IME text input state
  const [imeText, setImeText] = useState("");
  const [imeSending, setImeSending] = useState(false);
  const imeInputRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);
  const sendTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus the IME input when it opens and initialize with existing value
  useEffect(() => {
    if (imeOpen) {
      setImeText(imeValue);
      setTimeout(() => imeInputRef.current?.focus(), 80);
    }
  }, [imeOpen, imeValue]);

  // Sync imeValue from TV to imeText when user is not typing
  useEffect(() => {
    if (imeOpen && !isTypingRef.current && imeValue !== imeText) {
      setImeText(imeValue);
    }
  }, [imeValue, imeOpen, imeText]);

  // ── Global keyboard shortcut handler ──────────────────
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
  }, [sendKey, setVolume, openIme]);

  // ── IME submit ──────────────────────────────────────
  async function handleImeSend() {
    setImeSending(true);
    try {
      await sendText(imeText);
      sendKey("ENTER");
    } finally {
      setImeSending(false);
      setImeOpen(false);
    }
  }

  // ── Open modal directly (for manual keyboard button press) ──
  async function openIme() {
    const value = await getImeValue();
    setImeText(value);
    setImeOpen(true);
  }

  const onSettingsClick = () => initApp();

  const volPct = volumeMax > 0 ? Math.round((volume / volumeMax) * 100) : volume;

  return (
    <div className="flex justify-center items-center min-h-screen w-[min(100vw,420px)] mx-auto bg-zinc-950 p-4 select-none">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 0%, rgba(99,102,241,0.14) 0%, transparent 70%)",
        }}
      />

      {/* ── IME Modal ────────────────────────────────── */}
      {imeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setImeOpen(false);
          }}
        >
          <div className="glass rounded-3xl p-6 w-full max-w-lg animate-fade-in-up shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-indigo-400" />
                <span className="text-sm font-semibold text-white/80">
                  {imeLabel || "TV Input"}
                </span>
              </div>
              <button
                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer"
                onClick={() => setImeOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <textarea
              ref={imeInputRef as any}
              value={imeText}
              onChange={(e) => {
                isTypingRef.current = true;
                const newText = e.target.value;
                const cursorStart = e.target.selectionStart;
                const cursorEnd = e.target.selectionEnd;
                setImeText(newText);

                // Clear previous timeout
                if (sendTimeoutRef.current) {
                  clearTimeout(sendTimeoutRef.current);
                }

                // Send text after a short delay (debounce)
                sendTimeoutRef.current = setTimeout(() => {
                  sendTextWithCursor(newText, cursorStart, cursorEnd);
                }, 50);

                // Reset typing flag after a delay to allow sync from TV
                setTimeout(() => {
                  isTypingRef.current = false;
                }, 500);
              }}
              onFocus={() => {
                isTypingRef.current = false;
              }}
              onBlur={() => {
                isTypingRef.current = false;
                // Send final text when leaving the field
                if (sendTimeoutRef.current) {
                  clearTimeout(sendTimeoutRef.current);
                }
                const cursorStart = imeInputRef.current?.selectionStart || 0;
                const cursorEnd = imeInputRef.current?.selectionEnd || 0;
                sendTextWithCursor(imeText, cursorStart, cursorEnd);
              }}
              onSelect={(e) => {
                // Track cursor movement without text change
                const cursorStart = e.target.selectionStart;
                const cursorEnd = e.target.selectionEnd;
                sendCursorPosition(cursorStart, cursorEnd);
              }}
              onKeyDown={(e) => {
                // Handle Ctrl/Cmd shortcuts
                if (e.ctrlKey || e.metaKey) {
                  const shortcutMap: Record<
                    string,
                    "SELECT_ALL" | "COPY" | "PASTE" | "CUT" | "UNDO" | "REDO"
                  > = {
                    a: "SELECT_ALL",
                    c: "COPY",
                    v: "PASTE",
                    x: "CUT",
                    z: "UNDO",
                    y: "REDO",
                  };

                  const shortcut = shortcutMap[e.key.toLowerCase()];
                  if (shortcut) {
                    e.preventDefault();
                    sendShortcut(shortcut);
                    return;
                  }
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleImeSend();
                }
                if (e.key === "Escape") setImeOpen(false);
              }}
              placeholder={imeLabel || "Type to send to TV…"}
              className="w-full h-40 bg-zinc-950/80 border border-white/12 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 outline-none focus:border-indigo-500/60 transition-colors resize-none"
              style={{ userSelect: "text" }}
            />

            <div className="flex items-center justify-between mt-3">
              <p className="text-white/25 text-xs">
                Ctrl+A:Select All • Ctrl+C:Copy • Ctrl+V:Paste
              </p>
              <button
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-40"
                onClick={handleImeSend}
                disabled={imeSending}
                title="Press Enter"
              >
                {imeSending ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remote body ─────────────────────────────── */}
      <div
        className="relative z-10 w-full flex flex-col gap-5 animate-fade-in-up"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* ── Header ── */}
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
            onClick={() => sendKey("POWER")}
            title="Power"
          >
            <Power size={16} />
          </button>
        </header>

        {/* ── Media controls ── */}
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

        {/* ── D-pad ── */}
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

        {/* ── Volume + Action grid ── */}
        <div className="flex gap-3">
          {/* Volume rocker */}
          <div className="glass rounded-2xl flex flex-col items-center py-3 gap-1 min-w-[64px]">
            <button
              className="vol-btn w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 cursor-pointer"
              onClick={() => {
                setVolume((v) => Math.min(v + 1, volumeMax));
                sendKey("VOL_UP");
              }}
              title="Volume Up (⌘↑)"
            >
              <Volume2 size={18} />
            </button>
            <div className="flex flex-col items-center gap-1 px-2 w-full">
              <span className="text-[10px] font-semibold text-white/30 tracking-widest uppercase truncate max-w-full">
                {muted ? "MUTED" : "VOL"}
              </span>
              {/* Volume bar */}
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
              title="Volume Down (⌘↓)"
            >
              <Volume1 size={18} />
            </button>
          </div>

          {/* Action grid (3×2) */}
          <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3">
            <IconBtn
              onClick={() => openIme()}
              title="Keyboard (⌘K)"
              className="glass min-h-[56px] text-white/55 hover:text-white hover:bg-white/10"
            >
              <Keyboard size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => sendKey("HOME")}
              title="Home (⌘H)"
              className="glass min-h-[56px] text-white/55 hover:text-white hover:bg-white/10"
            >
              <Home size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => sendKey("MUTE")}
              title="Mute (⌘M)"
              className="glass min-h-[56px] text-white/55 hover:text-white hover:bg-white/10"
            >
              <VolumeX size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => sendKey("MIC")}
              title="Voice search"
              className="glass min-h-[56px] text-white/55 hover:text-white hover:bg-white/10"
            >
              <Mic size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => sendKey("MENU")}
              title="Menu"
              className="glass min-h-[56px] text-white/55 hover:text-white hover:bg-white/10"
            >
              <Menu size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => sendKey("BACK")}
              title="Back (Esc/⌫)"
              className="glass min-h-[56px] text-white/55 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft size={18} />
            </IconBtn>
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-center text-white/20 text-[10px] tracking-wide pb-1">
          ↑↓←→ navigate · Space play · ⇧← rewind · ⇧→ ff · ⌘← prev · ⌘→ next
        </p>
      </div>
    </div>
  );
}
