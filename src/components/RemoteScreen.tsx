import { Keyboard, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionGrid } from "./remote/ActionGrid";
import { DPadControls } from "./remote/DPadControls";
import { MediaControls } from "./remote/MediaControls";
import { RemoteHeader } from "./remote/RemoteHeader";
import { VolumeControls } from "./remote/VolumeControls";
import { useRemoteKeyboardShortcuts } from "../hooks/useRemoteKeyboardShortcuts";
import { useAndroidTV } from "../hooks/useAndroidTV";

/* ── Main component ────────────────────────────────────── */

export function RemoteScreen() {
  const {
    tvName,
    volume,
    volumeMax,
    muted,
    setVolume,
    sendKey,
    sendText,
    sendTextWithCursor,
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
  const imeInputRef = useRef<HTMLTextAreaElement>(null);
  const isTypingRef = useRef(false);
  const sendTimeoutRef = useRef<any | null>(null);

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
  const openIme = useCallback(async () => {
    const value = await getImeValue();
    setImeText(value);
    setImeOpen(true);
  }, [getImeValue, setImeOpen]);

  useRemoteKeyboardShortcuts({
    imeInputRef,
    sendKey,
    setVolume,
    openIme,
  });

  const onSettingsClick = () => initApp();

  const volPct =
    volumeMax > 0 ? Math.round((volume / volumeMax) * 100) : volume;

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
              ref={imeInputRef}
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
                // Track cursor movement by sending current text with updated cursor positions
                const target = e.target as HTMLTextAreaElement;
                const cursorStart = target.selectionStart;
                const cursorEnd = target.selectionEnd;
                // Send the current text with new cursor positions to update TV cursor
                sendTextWithCursor(imeText, cursorStart, cursorEnd);
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
                    // For SELECT_ALL, let default happen AND send to TV
                    // For clipboard operations, only let default happen (textarea clipboard)
                    // For UNDO/REDO, send to TV without preventing default
                    if (shortcut === "SELECT_ALL") {
                      // Let default select all happen in textarea, then sync to TV
                      setTimeout(() => {
                        const start = imeInputRef.current?.selectionStart || 0;
                        const end = imeInputRef.current?.selectionEnd || 0;
                        sendShortcut(shortcut);
                        sendTextWithCursor(imeText, start, end);
                      }, 10);
                    } else if (
                      shortcut === "COPY" ||
                      shortcut === "PASTE" ||
                      shortcut === "CUT"
                    ) {
                      // Let default clipboard behavior work in textarea
                      // Also send to TV for TV-side operations
                      setTimeout(() => sendShortcut(shortcut), 10);
                    } else {
                      // UNDO/REDO - send to TV, don't prevent default
                      setTimeout(() => sendShortcut(shortcut), 10);
                    }
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
        <RemoteHeader
          tvName={tvName}
          muted={muted}
          onSettingsClick={onSettingsClick}
          onPowerClick={() => sendKey("POWER")}
        />

        <MediaControls sendKey={sendKey} />

        <DPadControls sendKey={sendKey} />

        <div className="flex gap-3">
          <VolumeControls
            volume={volume}
            volumeMax={volumeMax}
            muted={muted}
            volPct={volPct}
            setVolume={setVolume}
            sendKey={sendKey}
          />

          <ActionGrid openIme={openIme} sendKey={sendKey} />
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-center text-white/20 text-[10px] tracking-wide pb-1">
          ↑↓←→ navigate · Space play · ⇧↑ vol+ · ⇧↓ vol- · ⇧← rewind · ⇧→ ff ·
          ⌘← prev · ⌘→ next
        </p>
      </div>
    </div>
  );
}
