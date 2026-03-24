import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const API = "http://127.0.0.1:59999";

export type DeviceState =
  | "discovering"
  | "discovered"
  | "disconnected"
  | "pairing"
  | "needs_pin"
  | "connected"
  | "select_saved"
  | "no_server";

export type Shortcut = "SELECT_ALL" | "COPY" | "PASTE" | "CUT" | "UNDO" | "REDO";

export interface Device {
  name: string;
  ip: string;
}

interface AndroidTVContextValue {
  // Connection state
  deviceState: DeviceState;
  ip: string;
  pin: string;
  tvName: string;
  savedDevices: Device[];
  discoveredDevices: Device[];
  setIp: (ip: string) => void;
  setPin: (pin: string) => void;
  setDeviceState: (state: DeviceState) => void;

  // Audio state
  volume: number;
  volumeMax: number;
  muted: boolean;
  setVolume: React.Dispatch<React.SetStateAction<number>>;

  // IME state
  imeOpen: boolean;
  imeLabel: string;
  imeValue: string;
  setImeOpen: (open: boolean) => void;

  // Connection actions
  initApp: () => Promise<void>;
  discoverTV: () => Promise<void>;
  connect: (ip: string, name: string) => Promise<void>;
  submitPin: () => Promise<void>;

  // Remote actions
  sendKey: (key: string) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendTextWithCursor: (text: string, cursorStart: number, cursorEnd: number) => Promise<void>;
  sendCursorPosition: (start: number, end: number) => Promise<void>;
  sendShortcut: (shortcut: Shortcut) => Promise<void>;
  getImeValue: () => Promise<string>;
}

const AndroidTVContext = createContext<AndroidTVContextValue | null>(null);

export function AndroidTVProvider({ children }: { children: ReactNode }) {
  // Connection state
  const [deviceState, setDeviceState] = useState<DeviceState>("discovering");
  const [ip, setIp] = useState("");
  const [pin, setPin] = useState("");
  const [tvName, setTvName] = useState("Android TV");
  const [savedDevices, setSavedDevices] = useState<Device[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);

  // Audio state
  const [volume, setVolume] = useState(15);
  const [volumeMax, setVolumeMax] = useState(100);
  const [muted, setMuted] = useState(false);

  // IME state
  const [imeOpen, setImeOpen] = useState(false);
  const [imeLabel, setImeLabel] = useState("");
  const [imeValue, setImeValue] = useState("");

  const sseRef = useRef<EventSource | null>(null);

  // SSE connection
  useEffect(() => {
    if (!ip) return;

    sseRef.current?.close();

    const es = new EventSource(`${API}/events?ip=${encodeURIComponent(ip)}`);

    console.log(
      "[Frontend] SSE connection opened to",
      `${API}/events?ip=${encodeURIComponent(ip)}`,
    );

    es.addEventListener("volume", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ip !== ip) return;
        setVolume(data.level ?? 0);
        setVolumeMax(data.maximum ?? 100);
        setMuted(data.muted ?? false);
      } catch (_err) {}
    });

    es.addEventListener("ime_show", (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log("[Frontend] ime_show SSE event:", data);
        if (data.ip !== ip) return;
        setImeLabel(data.label || "");
        setImeValue(data.value || "");
        setImeOpen(true);
        console.log("[Frontend] Opening IME modal with value:", data.value);
      } catch (err) {
        console.error("[Frontend] Error parsing ime_show:", err);
      }
    });

    es.addEventListener("ime_update", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ip !== ip) return;
        setImeValue(data.value || "");
        setImeOpen(true);
      } catch (_err) {}
    });

    es.addEventListener("ime_hide", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ip !== ip) return;
        setImeOpen(false);
      } catch (_err) {}
    });

    sseRef.current = es;
    return () => es.close();
  }, [ip]);

  // API functions
  const checkServerAlive = useCallback(async () => {
    try {
      const res = await fetch(`${API}/saved-devices`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const initApp = useCallback(async () => {
    setDeviceState("discovering");

    const serverData = await checkServerAlive();
    if (!serverData) {
      setDeviceState("no_server");
      return;
    }

    const sDevs = serverData.devices || [];
    setSavedDevices(sDevs);

    if (sDevs.length > 0) {
      setDeviceState("select_saved");

      if (sDevs.length === 1) {
        connect(sDevs[0].ip, sDevs[0].name);
      }
    } else {
      discoverTV();
    }
  }, [checkServerAlive, connect, discoverTV]);

  const discoverTV = useCallback(async () => {
    setDeviceState("discovering");
    try {
      const serverData = await checkServerAlive();
      if (!serverData) {
        setDeviceState("no_server");
        return;
      }

      const res = await fetch(`${API}/discover`);
      const data = await res.json();
      if (data.devices && data.devices.length > 0) {
        setDiscoveredDevices(data.devices);
        setDeviceState("discovered");
      } else {
        setDeviceState("disconnected");
      }
    } catch {
      setDeviceState("disconnected");
    }
  }, [checkServerAlive]);

  const connect = useCallback(async (targetIp: string, name: string) => {
    if (!targetIp) return;
    setIp(targetIp);
    setTvName(name);
    setDeviceState("pairing");
    try {
      const res = await fetch(`${API}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: targetIp, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      if (data.status === "needs_pin") {
        setDeviceState("needs_pin");
      } else if (data.status === "connected") {
        setDeviceState("connected");
      } else {
        throw new Error("Unknown connection status");
      }
    } catch {
      setDeviceState("disconnected");
    }
  }, []);

  const submitPin = useCallback(async () => {
    try {
      const res = await fetch(`${API}/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, pin }),
      });
      if (!res.ok) throw new Error("Pairing failed");
      setDeviceState("connected");
    } catch {
      setDeviceState("disconnected");
    }
  }, [ip, pin]);

  const sendKey = useCallback(
    async (key: string) => {
      await fetch(`${API}/send-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, keycode: key }),
      }).catch(console.error);
    },
    [ip],
  );

  const sendText = useCallback(
    async (text: string) => {
      await fetch(`${API}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, text }),
      }).catch(console.error);
    },
    [ip],
  );

  const sendTextWithCursor = useCallback(
    async (text: string, cursorStart: number, cursorEnd: number) => {
      await fetch(`${API}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, text, cursorStart, cursorEnd }),
      }).catch(console.error);
    },
    [ip],
  );

  const sendCursorPosition = useCallback(
    async (start: number, end: number) => {
      await fetch(`${API}/move-cursor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, start, end }),
      }).catch(console.error);
    },
    [ip],
  );

  const sendShortcut = useCallback(
    async (shortcut: Shortcut) => {
      await fetch(`${API}/send-shortcut`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, shortcut }),
      }).catch(console.error);
    },
    [ip],
  );

  const getImeValue = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ime-value?ip=${encodeURIComponent(ip)}`);
      if (res.ok) {
        const data = await res.json();
        return data.value || "";
      }
    } catch {
      // ignore
    }
    return "";
  }, [ip]);

  // Initialize on mount
  useEffect(() => {
    initApp();
  }, [initApp]);

  const value: AndroidTVContextValue = {
    deviceState,
    ip,
    pin,
    tvName,
    savedDevices,
    discoveredDevices,
    setIp,
    setPin,
    setDeviceState,
    volume,
    volumeMax,
    muted,
    setVolume,
    imeOpen,
    imeLabel,
    imeValue,
    setImeOpen,
    initApp,
    discoverTV,
    connect,
    submitPin,
    sendKey,
    sendText,
    sendTextWithCursor,
    sendCursorPosition,
    sendShortcut,
    getImeValue,
  };

  return <AndroidTVContext.Provider value={value}>{children}</AndroidTVContext.Provider>;
}

export function useAndroidTV(): AndroidTVContextValue {
  const context = useContext(AndroidTVContext);
  if (!context) {
    throw new Error("useAndroidTV must be used within AndroidTVProvider");
  }
  return context;
}
