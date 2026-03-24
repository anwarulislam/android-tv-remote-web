const express = require("express");
const { AndroidRemote, RemoteDirection } = require("androidtv-remote");
const fs = require("fs");
const path = require("path");
const protobufjs = require("protobufjs");
const router = express.Router();

// ── Monkey-patch AndroidRemote to add IME support ─────────────────────────────
// Note: Don't try to import RemoteManager directly - it's an ES module
// We'll access it through the AndroidRemote instance after start()
const protoPath = path.join(__dirname, "../../node_modules/.pnpm/androidtv-remote@1.0.10/node_modules/androidtv-remote/src/remote/remotemessage.proto");
let RemoteMessageProto;
try {
  const root = protobufjs.loadSync(protoPath);
  RemoteMessageProto = root.lookupType("remote.RemoteMessage");
  console.log("[Server] Protobuf loaded successfully");
} catch (e) {
  console.error("[Server] Failed to load protobuf:", e);
}

// Per-connection IME counter
const imeCounters = new Map();

// Add sendImeText method to AndroidRemote
AndroidRemote.prototype.sendImeText = function(appPackage, counterField, text) {
  if (!RemoteMessageProto || !this.remoteManager?.client) {
    throw new Error("Cannot send IME text: not properly initialized");
  }

  // Use provided counterField, stored counter, or 0
  const counter = counterField ?? imeCounters.get(this.host) ?? 0;

  console.log(`[Library] sendImeText: app=${appPackage}, counter=${counter}, text="${text}"`);

  const message = RemoteMessageProto.create({
    remoteImeKeyInject: {
      textFieldStatus: {
        counterField: counter,
        value: text,
      },
      appInfo: {
        appPackage: appPackage || "",
      }
    }
  });

  const array = RemoteMessageProto.encodeDelimited(message).finish();
  this.remoteManager.client.write(array);

  // Increment counter for next use
  imeCounters.set(this.host, counter + 1);
  return true;
};

// Patch AndroidRemote.start to forward IME events from remoteManager
const originalAndroidStart = AndroidRemote.prototype.start;
AndroidRemote.prototype.start = async function() {
  console.log(`[Library] AndroidRemote.start() called for ${this.host}`);

  const result = await originalAndroidStart.call(this);
  console.log(`[Library] Original start() completed for ${this.host}, remoteManager exists:`, !!this.remoteManager);

  if (this.remoteManager) {
    console.log(`[Library] Setting up IME event listeners on remoteManager for ${this.host}`);

    // Debug: Log ALL events emitted by remoteManager
    const originalEmit = this.remoteManager.emit.bind(this.remoteManager);
    this.remoteManager.emit = function(event, ...args) {
      if (event.startsWith('ime_')) {
        console.log(`[Library] remoteManager.emit('${event}', ${JSON.stringify(args).slice(0, 100)})`);
      }
      return originalEmit(event, ...args);
    };

    // Forward IME events to AndroidRemote
    this.remoteManager.on('ime_show', (data) => {
      console.log(`[Library] ime_show listener triggered: ${JSON.stringify(data)}`);
      // Initialize counter if not set
      if (!imeCounters.has(this.host)) {
        imeCounters.set(this.host, 0);
      }
      console.log(`[Library] Forwarding ime_show to AndroidRemote`);
      this.emit('ime_show', data);
    });

    this.remoteManager.on('ime_hide', () => {
      console.log("[Library] ime_hide listener triggered");
      this.emit('ime_hide');
    });

    // Intercept ime_batch_edit to extract insert text and emit ime_update event
    this.remoteManager.on('ime_batch_edit', (data) => {
      console.log(`[Library] ime_batch_edit listener triggered: ${JSON.stringify(data)}`);
      // The library's RemoteManager emits ime_hide for batch edits
      // We want to emit ime_update with the insert text
      const insertText = data?.edit_info?.insert;
      if (typeof insertText === 'string' || typeof insertText === 'number') {
        // Convert number to string if needed (insert can be a number for some reason)
        const text = String(insertText);
        console.log(`[Library] ime_update: "${text}"`);
        this.emit('ime_update', { text });
      } else {
        // No insert text = keyboard dismissed
        console.log("[Library] No insert text, emitting ime_hide");
        this.emit('ime_hide');
      }
    });
  } else {
    console.log(`[Library] WARNING: remoteManager not available!`);
  }

  return result;
};
// ──────────────────────────────────────────────────────────────────────────────

let remotes = {};
let remotesState = {}; // "pairing" | "connected"
let remoteVolume = {}; // { level, maximum, muted } per IP
let remoteImeLabel = {}; // last known IME field label per IP
let remoteImeValue = {}; // last known IME field value per IP
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
      console.log(`[Server] ime_show EVENT RECEIVED for ${ip}: ${JSON.stringify(data)}`);
      remoteImeLabel[ip] = data.label || "";
      if (data.value !== undefined) remoteImeValue[ip] = data.value;
      // Store counterField for text injection
      if (!remoteImeInfo[ip]) remoteImeInfo[ip] = {};
      if (data.counterField !== undefined) remoteImeInfo[ip].counterField = data.counterField;
      console.log(`[Server] Broadcasting ime_show to SSE clients`);
      broadcast("ime_show", { ip, ...data });
    });

    // Store app package when current_app event fires (from remoteImeKeyInject)
    remote.on("current_app", (appPackage) => {
      console.log(`[Server] current_app: ${appPackage}`);
      if (!remoteImeInfo[ip]) remoteImeInfo[ip] = {};
      remoteImeInfo[ip].appPackage = appPackage;
    });

    // Handle ime_update - new text from TV (typing on TV)
    remote.on("ime_update", (data) => {
      console.log(`[Server] ime_update: "${data.text}"`);
      const currentText = remoteImeValue[ip] || "";
      const newText = data.text || "";

      // If it's a single character, append it
      // If it's multiple characters, it might be a replacement
      if (newText.length === 1) {
        remoteImeValue[ip] = currentText + newText;
      } else {
        remoteImeValue[ip] = newText;
      }

      // Broadcast the update to frontend
      broadcast("ime_update", { ip, value: remoteImeValue[ip] });
    });

    remote.on("ime_batch_edit", (data) => {
      if (data.value !== undefined) remoteImeValue[ip] = data.value;
      broadcast("ime_show", { ip, label: remoteImeLabel[ip] || "", value: data.value || remoteImeValue[ip] || "" });
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

  console.log(`[Server] send-text: ip=${ip}, text="${text}"`);
  console.log(`[Server] remoteImeInfo[${ip}]:`, remoteImeInfo[ip]);

  // For real-time sync, track what we're sending but don't overwrite TV's value
  // The TV will send back updates via ime_show/ime_update events

  // First try direct IME injection if we have the required info
  const info = remoteImeInfo[ip];
  if (info && info.appPackage) {
    try {
      console.log(`[Server] Using direct IME inject: app=${info.appPackage}, counter=${info.counterField ?? 0}`);
      remote.sendImeText(info.appPackage, info.counterField ?? 0, text);
      return res.json({ status: "ok" });
    } catch (e) {
      console.warn(`[Server] Direct IME inject failed: ${e.message}`);
    }
  } else {
    console.warn(`[Server] No IME info available, falling back to key simulation`);
  }

  // Fallback: keycode simulation (for when direct IME injection is not available)
  const DELAY_MS = 30; // Faster for real-time typing
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

  // Track last sent text to calculate diff for key simulation
  const lastSent = remoteImeInfo[ip]?.lastSentText || "";

  try {
    // Calculate the difference: only send new characters
    if (text.startsWith(lastSent) && text.length > lastSent.length) {
      // User is typing - send only new characters
      const newChars = text.slice(lastSent.length);
      for (const ch of newChars) {
        const mapped = charToKey(ch);
        if (!mapped) continue;
        if (mapped.shift) {
          remote.sendKey(59, RemoteDirection.START_LONG);
          await sleep(15);
          remote.sendKey(mapped.keycode, RemoteDirection.SHORT);
          await sleep(15);
          remote.sendKey(59, RemoteDirection.END_LONG);
        } else {
          remote.sendKey(mapped.keycode, RemoteDirection.SHORT);
        }
        await sleep(DELAY_MS);
      }
    } else if (text.length < lastSent.length) {
      // User deleted characters - send backspace for each deleted char
      const deleteCount = lastSent.length - text.length;
      for (let i = 0; i < deleteCount; i++) {
        remote.sendKey(67, RemoteDirection.SHORT); // KEYCODE_DEL (backspace)
        await sleep(DELAY_MS);
      }
    } else {
      // Complete replacement needed (e.g., user selected all and typed)
      // Send backspace for old text, then type new text
      for (let i = 0; i < lastSent.length; i++) {
        remote.sendKey(67, RemoteDirection.SHORT);
        await sleep(20);
      }
      for (const ch of text) {
        const mapped = charToKey(ch);
        if (!mapped) continue;
        if (mapped.shift) {
          remote.sendKey(59, RemoteDirection.START_LONG);
          await sleep(15);
          remote.sendKey(mapped.keycode, RemoteDirection.SHORT);
          await sleep(15);
          remote.sendKey(59, RemoteDirection.END_LONG);
        } else {
          remote.sendKey(mapped.keycode, RemoteDirection.SHORT);
        }
        await sleep(DELAY_MS);
      }
    }

    // Store the sent text for next comparison
    if (!remoteImeInfo[ip]) remoteImeInfo[ip] = {};
    remoteImeInfo[ip].lastSentText = text;

    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get current IME value ───────────────────────────────────────────────────────
router.get("/ime-value", (req, res) => {
  const ip = req.query.ip;
  if (ip && remoteImeValue[ip] !== undefined) {
    return res.json({ value: remoteImeValue[ip] });
  }
  res.json({ value: "" });
});

// ── Volume polling fallback ───────────────────────────────────────────────────
router.get("/volume", (req, res) => {
  const ip = req.query.ip;
  if (ip && remoteVolume[ip]) return res.json(remoteVolume[ip]);
  res.json({ level: null, maximum: null, muted: false });
});

module.exports = router;
