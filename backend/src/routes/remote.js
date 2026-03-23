const express = require("express");
const { AndroidRemote, RemoteDirection } = require("androidtv-remote");
const fs = require("fs");
const path = require("path");
const router = express.Router();

let remotes = {};
let remotesState = {}; // "pairing" | "connected"
let remoteVolume = {}; // { level, maximum, muted } per IP
let remoteImeLabel = {}; // last known IME field label per IP
let remoteImeInfo = {}; // { appPackage, counterField } per IP – for text injection
let sseClients = []; // SSE subscriber list

const DEVICES_FILE = path.join(__dirname, "..", "devices.json");
let savedDevices = {};
try {
  if (fs.existsSync(DEVICES_FILE)) {
    savedDevices = JSON.parse(fs.readFileSync(DEVICES_FILE, "utf-8"));
  }
} catch (e) {
  console.error("Failed to parse devices file", e);
}

function saveDevices() {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(savedDevices, null, 2));
}

/** Broadcast an event to all connected SSE clients */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((res) => !res.writableEnded);
  sseClients.forEach((res) => res.write(payload));
}

// ── SSE stream endpoint ──────────────────────────────────────────────────────
router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const ip = req.query.ip;
  if (ip && remoteVolume[ip]) {
    res.write(`event: volume\ndata: ${JSON.stringify(remoteVolume[ip])}\n\n`);
  }

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// ── Saved devices ────────────────────────────────────────────────────────────
router.get("/saved-devices", (req, res) => {
  const list = Object.values(savedDevices).map((d) => ({
    name: d.name,
    ip: d.ip,
  }));
  res.json({ devices: list });
});

// ── Connect ──────────────────────────────────────────────────────────────────
router.post("/connect", async (req, res) => {
  const { ip, name } = req.body;
  if (!ip) return res.status(400).json({ error: "IP required" });

  console.log(`[Server] Connecting to ${ip}...`);

  try {
    if (remotes[ip] && remotesState[ip]) {
      if (remotesState[ip] === "pairing")
        return res.json({ status: "needs_pin" });
      if (remotesState[ip] === "connected")
        return res.json({ status: "connected" });
    }

    let certOption = undefined;
    if (savedDevices[ip] && savedDevices[ip].cert) {
      certOption = savedDevices[ip].cert;
    }

    const remote = new AndroidRemote(ip, { cert: certOption });
    remotes[ip] = remote;
    remotesState[ip] = "connecting";
    let responded = false;

    remote.on("secret", () => {
      remotesState[ip] = "pairing";
      if (!responded) {
        responded = true;
        res.json({ status: "needs_pin" });
      }
    });

    remote.on("powered", (powered) => broadcast("powered", { ip, powered }));

    remote.on("volume", (vol) => {
      remoteVolume[ip] = { ...vol, ip };
      broadcast("volume", { ...vol, ip });
    });

    remote.on("current_app", (app) => broadcast("current_app", { ip, app }));

    remote.on("ime_show", (data) => {
      remoteImeLabel[ip] = data.label || "";
      broadcast("ime_show", { ip, ...data });
    });

    remote.on("ime_key_inject", (data) => {
      remoteImeInfo[ip] = {
        appPackage: data.appPackage,
        counterField: data.counterField,
      };
    });

    remote.on("ime_batch_edit", () => {
      broadcast("ime_show", { ip, label: remoteImeLabel[ip] || "", value: "" });
    });

    remote.on("ime_hide", () => broadcast("ime_hide", { ip }));

    remote.on("ready", () => {
      remotesState[ip] = "connected";
      if (!savedDevices[ip]) savedDevices[ip] = { ip, name: name || ip };
      savedDevices[ip].cert = remote.getCertificate();
      saveDevices();
      if (!responded) {
        responded = true;
        res.json({ status: "connected" });
      }
    });

    remote.on("error", (err) => {
      remotesState[ip] = "error";
      if (!responded) {
        responded = true;
        res.status(500).json({ error: err.message });
      }
    });

    const started = await remote.start();
    if (started && remotesState[ip] !== "pairing") {
      remotesState[ip] = "connected";
      if (!savedDevices[ip]) savedDevices[ip] = { ip, name: name || ip };
      savedDevices[ip].cert = remote.getCertificate();
      saveDevices();
      if (!responded) {
        responded = true;
        res.json({ status: "connected" });
      }
    }
  } catch (e) {
    remotesState[ip] = "error";
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── Pair ─────────────────────────────────────────────────────────────────────
router.post("/pair", async (req, res) => {
  const { ip, pin } = req.body;
  const remote = remotes[ip];
  if (!remote)
    return res.status(400).json({ error: "No connection for this IP" });
  try {
    remote.sendCode(pin);
    res.json({ status: "success" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Send key ─────────────────────────────────────────────────────────────────
router.post("/send-key", (req, res) => {
  const { ip, keycode } = req.body;
  const remote = remotes[ip];
  if (!remote) return res.status(400).json({ error: "Not connected" });

  const map = {
    UP: 19,
    DOWN: 20,
    LEFT: 21,
    RIGHT: 22,
    ENTER: 23,
    BACK: 4,
    HOME: 3,
    POWER: 26,
    VOL_UP: 24,
    VOL_DOWN: 25,
    MUTE: 164,
    PLAY_PAUSE: 85,
    NEXT: 87,
    PREV: 88,
    REWIND: 89,
    FF: 90,
    MENU: 82,
    MIC: 84, // Triggers Voice Assistant/Search
    KEYBOARD: 84,
    BACKSPACE: 67, // KEYCODE_DEL
  };

  if (map[keycode] !== undefined) {
    remote.sendKey(map[keycode], RemoteDirection.SHORT);
    return res.json({ status: "sent" });
  }
  return res.status(400).json({ error: "Invalid keycode" });
});

// ── Send text (IME inject) ────────────────────────────────────────────────────
router.post("/send-text", async (req, res) => {
  const { ip, text } = req.body;
  const remote = remotes[ip];
  if (!remote) return res.status(400).json({ error: "Not connected" });

  try {
    const info = remoteImeInfo[ip];
    remote.sendImeText(info?.appPackage || "", info?.counterField ?? 0, text);
    return res.json({ status: "ok" });
  } catch (e) {
    console.warn(
      `[Server] Direct IME inject failed, falling back: ${e.message}`,
    );
  }

  // Fallback: keycode simulation
  const DELAY_MS = 60;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function charToKey(ch) {
    const lower = ch.toLowerCase();
    if (lower >= "a" && lower <= "z")
      return { keycode: 29 + (lower.charCodeAt(0) - 97), shift: ch !== lower };
    if (ch >= "0" && ch <= "9")
      return { keycode: 7 + (ch.charCodeAt(0) - 48), shift: false };
    const s = {
      " ": { keycode: 62, shift: false },
      ".": { keycode: 56, shift: false },
      ",": { keycode: 55, shift: false },
      "!": { keycode: 8, shift: true },
      "@": { keycode: 77, shift: false },
      "#": { keycode: 10, shift: true },
      $: { keycode: 11, shift: true },
      "-": { keycode: 69, shift: false },
      "=": { keycode: 70, shift: false },
      "/": { keycode: 76, shift: false },
      "?": { keycode: 76, shift: true },
      ":": { keycode: 74, shift: true },
      "'": { keycode: 75, shift: false },
      "\n": { keycode: 66, shift: false },
    };
    return s[ch] || null;
  }
  try {
    for (const ch of text) {
      const mapped = charToKey(ch);
      if (!mapped) continue;
      if (mapped.shift) {
        remote.sendKey(59, RemoteDirection.START_LONG);
        await sleep(25);
        remote.sendKey(mapped.keycode, RemoteDirection.SHORT);
        await sleep(25);
        remote.sendKey(59, RemoteDirection.END_LONG);
      } else {
        remote.sendKey(mapped.keycode, RemoteDirection.SHORT);
      }
      await sleep(DELAY_MS);
    }
    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Volume polling fallback ───────────────────────────────────────────────────
router.get("/volume", (req, res) => {
  const ip = req.query.ip;
  if (ip && remoteVolume[ip]) return res.json(remoteVolume[ip]);
  res.json({ level: null, maximum: null, muted: false });
});

module.exports = router;
