import { Keyboard, Send, X } from "lucide-react";
import { useKeyboardImeControls } from "../../hooks/useKeyboardImeControls";
import { IconBtn } from "./IconBtn";

export function KeyboardControls() {
  const {
    imeOpen,
    imeLabel,
    imeText,
    imeSending,
    imeInputRef,
    openIme,
    closeIme,
    handleImeSend,
    handleChange,
    handleFocus,
    handleBlur,
    handleSelect,
    handleKeyDown,
  } = useKeyboardImeControls();

  return (
    <>
      <IconBtn
        onClick={() => {
          void openIme();
        }}
        title="Keyboard (⌘K)"
        className="glass min-h-[56px] h-full text-white/55 hover:text-white hover:bg-white/10"
      >
        <Keyboard size={18} />
      </IconBtn>

      {imeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeIme();
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
                onClick={closeIme}
              >
                <X size={15} />
              </button>
            </div>

            <textarea
              ref={imeInputRef}
              value={imeText}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onSelect={handleSelect}
              onKeyDown={handleKeyDown}
              placeholder={imeLabel || "Type to send to TV..."}
              className="w-full h-40 bg-zinc-950/80 border border-white/12 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 outline-none focus:border-indigo-500/60 transition-colors resize-none"
              style={{ userSelect: "text" }}
            />

            <div className="flex items-center justify-between mt-3">
              <p className="text-white/25 text-xs">
                Ctrl+A:Select All • Ctrl+C:Copy • Ctrl+V:Paste
              </p>
              <button
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-40"
                onClick={() => {
                  void handleImeSend();
                }}
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
    </>
  );
}
