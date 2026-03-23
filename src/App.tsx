import { useState, useEffect, useRef } from "react";
import "./App.css";
import { ConnectionScreen } from "./components/ConnectionScreen";
import { RemoteScreen } from "./components/RemoteScreen";

const API = "http://127.0.0.1:59999";

function App() {
  const [deviceState, setDeviceState] = useState("discovering");
  const [volume, setVolume] = useState(15);
  const [volumeMax, setVolumeMax] = useState(100);
  const [muted, setMuted] = useState(false);
  const [ip, setIp] = useState("");
  const [pin, setPin] = useState("");
  const [tvName, setTvName] = useState("Android TV");
  const [discoveredDevices, setDiscoveredDevices] = useState<{ name: string; ip: string }[]>([]);
  const [savedDevices, setSavedDevices] = useState<{ name: string; ip: string }[]>([]);
  const [imeOpen, setImeOpen] = useState(false);
  const [imeLabel, setImeLabel] = useState("");

  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  // Connect SSE whenever we have an IP
  useEffect(() => {
    if (!ip) return;

    sseRef.current?.close();

    const es = new EventSource(`${API}/events?ip=${encodeURIComponent(ip)}`);

    es.addEventListener("volume", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ip !== ip) return;
        setVolume(data.level ?? 0);
        setVolumeMax(data.maximum ?? 100);
        setMuted(data.muted ?? false);
      } catch (err) { }
    });

    es.addEventListener("ime_show", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ip !== ip) return;
        setImeLabel(data.label || "");
        setImeOpen(true);
      } catch (err) { }
    });

    es.addEventListener("ime_hide", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ip !== ip) return;
        setImeOpen(false);
      } catch (err) { }
    });

    sseRef.current = es;
    return () => es.close();
  }, [ip]);

  async function checkServerAlive() {
    try {
      const res = await fetch(`${API}/saved-devices`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async function initApp() {
    setDeviceState("discovering");

    // First check if the local server is even running
    const serverData = await checkServerAlive();
    if (!serverData) {
      setDeviceState("no_server");
      return;
    }

    const sDevs = serverData.devices || [];
    setSavedDevices(sDevs);

    if (sDevs.length > 0) {
      // Just auto-switch to selection
      setDeviceState("select_saved");

      // Try to auto-connect to the first one if there's only 1
      if (sDevs.length === 1) {
        connect(sDevs[0].ip, sDevs[0].name);
      }
    } else {
      discoverTV();
    }
  }

  async function discoverTV() {
    setDeviceState("discovering");
    try {
      // Check server again just in case they are coming from the 'no_server' screen
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
  }

  async function connect(targetIp = ip, name = "Android TV") {
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
  }

  async function submitPin() {
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
  }

  async function sendKey(key: string) {
    await fetch(`${API}/send-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, keycode: key }),
    }).catch(console.error);
  }

  async function sendText(text: string) {
    await fetch(`${API}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, text }),
    }).catch(console.error);
  }

  const isConnectionScreen = [
    "disconnected", "pairing", "needs_pin",
    "discovering", "discovered", "select_saved",
    "no_server"
  ].includes(deviceState);

  if (isConnectionScreen) {
    return (
      <ConnectionScreen
        deviceState={deviceState}
        tvName={tvName}
        discoveredDevices={discoveredDevices}
        savedDevices={savedDevices}
        ip={ip}
        pin={pin}
        setIp={setIp}
        setPin={setPin}
        connect={connect}
        discoverTV={discoverTV}
        submitPin={submitPin}
        setDeviceState={setDeviceState}
      />
    );
  }

  return (
    <RemoteScreen
      tvName={tvName}
      volume={volume}
      volumeMax={volumeMax}
      muted={muted}
      setVolume={setVolume}
      sendKey={sendKey}
      sendText={sendText}
      imeOpen={imeOpen}
      imeLabel={imeLabel}
      setImeOpen={setImeOpen}
      onSettingsClick={() => initApp()}
    />
  );
}

export default App;
