import { useCallback } from "react";
import { ActionGrid } from "./remote/ActionGrid";
import { DPadControls } from "./remote/DPadControls";
import { MediaControls } from "./remote/MediaControls";
import { RemoteHeader } from "./remote/RemoteHeader";
import { VolumeControls } from "./remote/VolumeControls";
import { useRemoteHotkeys } from "../hooks/useRemoteHotkeys";
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
    initApp,
    imeOpen,
    setImeOpen,
  } = useAndroidTV();

  const openIme = useCallback(async () => {
    setImeOpen(true);
  }, [setImeOpen]);

  useRemoteHotkeys({
    sendKey,
    sendText,
    setVolume,
    openIme,
    disabled: imeOpen,
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

          <ActionGrid sendKey={sendKey} />
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-center text-white/20 text-[10px] tracking-wide pb-1">
          ↑↓←→ navigate · Space play · ⇧↑ vol+ · ⇧↓ vol- · ⇧← rewind · ⇧→ ff ·
          ⌘← prev · ⌘→ next · type to send text · ⌫ delete · Esc back
        </p>
      </div>
    </div>
  );
}
