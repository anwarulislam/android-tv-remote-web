import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { AndroidRemote, RemoteDirection } from "../../lib/androidtv-remote/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// ── IME State Management ───────────────────────────────────────────────────────────
const remotes = {};
const remotesState = {}; // "pairing" | "connected"
const remoteVolume = {}; // { level, maximum, muted } per IP
const remoteImeLabel = {}; // last known IME field label per IP
const remoteImeValue = {}; // last known IME field value per IP
const remoteImeInfo = {}; // { appPackage, counterField, lastSentText, cursorStart, cursorEnd } per IP
let sseClients = []; // SSE subscriber list

// Get devices file path from environment variable or use default
const DEVICES_FILE = process.env.ANDROIDTV_DEVICES_PATH || path.join(__dirname, "..", "devices.json");
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
router.get("/saved-devices", (_req, res) => {
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
      if (remotesState[ip] === "pairing") return res.json({ status: "needs_pin" });
      if (remotesState[ip] === "connected") return res.json({ status: "connected" });
    }

    let certOption;
    if (savedDevices[ip]?.cert) {
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
      // Store counterField, start, end for text injection
      if (!remoteImeInfo[ip]) remoteImeInfo[ip] = {};
      remoteImeInfo[ip].counterField = data.counterField || 0;
      remoteImeInfo[ip].cursorStart = data.start || 0;
      remoteImeInfo[ip].cursorEnd = data.end || 0;
      broadcast("ime_show", { ip, ...data });
    });

    // Handle ime_key_inject event from patched library (contains appPackage + textFieldStatus)
    remote.on("ime_key_inject", (data) => {
      console.log(`[Server] ime_key_inject EVENT RECEIVED for ${ip}: ${JSON.stringify(data)}`);
      if (!remoteImeInfo[ip]) remoteImeInfo[ip] = {};
      remoteImeInfo[ip].appPackage = data.appPackage || "";
      remoteImeInfo[ip].counterField = data.counterField || 0;
      remoteImeInfo[ip].cursorStart = data.start || 0;
      remoteImeInfo[ip].cursorEnd = data.end || 0;
      // If there's a value, update it
      if (data.value !== undefined) remoteImeValue[ip] = data.value;
      // Broadcast to frontend to open the modal when TV focuses an input
      broadcast("ime_show", {
        ip,
        label: remoteImeLabel[ip] || "",
        value: remoteImeValue[ip] || "",
        counterField: data.counterField || 0,
        start: data.start || 0,
        end: data.end || 0,
      });
    });

    remote.on("ime_batch_edit", (data) => {
      console.log(`[Server] ime_batch_edit EVENT RECEIVED for ${ip}: ${JSON.stringify(data)}`);
      // Extract insert text if available
      const insertText = data.edit_info?.insert;

      // If undefined, keyboard was dismissed
      if (insertText === undefined) {
        broadcast("ime_hide", { ip });
        return;
      }

      // Skip empty string responses from TV (often sent during cursor positioning)
      // This prevents accidentally clearing text when the TV echoes back an empty value
      if (insertText === "") {
        console.log(
          `[Server] Skipping empty insertText from TV (likely cursor positioning response)`,
        );
        return;
      }

      // Process actual text content
      if (typeof insertText === "number") {
        // Single character code - append it
        remoteImeValue[ip] = (remoteImeValue[ip] || "") + String.fromCharCode(insertText);
        broadcast("ime_update", { ip, value: remoteImeValue[ip] || "" });
      } else if (typeof insertText === "string") {
        // Full text - only broadcast if the value actually changed
        const oldValue = remoteImeValue[ip] || "";
        if (insertText !== oldValue) {
          remoteImeValue[ip] = insertText;
          broadcast("ime_update", { ip, value: remoteImeValue[ip] || "" });
        }
        // If values are the same, still update stored value but don't broadcast
        else {
          remoteImeValue[ip] = insertText;
        }
      }
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
  if (!remote) return res.status(400).json({ error: "No connection for this IP" });
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
    ENTER: 23, // DPAD_CENTER (navigation)
    DPAD_CENTER: 23,
    TEXT_ENTER: 66, // KEYCODE_ENTER (for text input/IME)
    BACK: 4,
    HOME: 3,
    POWER: 26,
    VOL_UP: 24, // Shift + Arrow UP
    VOL_DOWN: 25, // Shift + Arrow DOWN
    MUTE: 164,
    PLAY_PAUSE: 85, // Space
    NEXT: 87, // CMD + Arrow Right
    PREV: 88, // CMD + Arrow Left
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
  const { ip, text, cursorStart = 0, cursorEnd = 0 } = req.body;
  const remote = remotes[ip];
  if (!remote) return res.status(400).json({ error: "Not connected" });

  console.log(`[Server] send-text: ip=${ip}, text="${text}", cursor=[${cursorStart},${cursorEnd}]`);
  console.log(`[Server] remoteImeInfo[${ip}]:`, remoteImeInfo[ip]);

  // Store current text for diff calculation
  remoteImeValue[ip] = text;

  // First try direct IME Batch Edit if we have the required info
  const info = remoteImeInfo[ip];
  if (info?.counterField !== undefined) {
    try {
      // Initialize imeCounter if not exists
      if (!remoteImeInfo[ip].imeCounter) {
        remoteImeInfo[ip].imeCounter = 0;
      }

      // Increment ime counter for each batch edit
      const imeCounter = ++remoteImeInfo[ip].imeCounter;
      const fieldCounter = info.counterField;

      console.log(
        `[Server] Using RemoteImeBatchEdit: imeCounter=${imeCounter}, fieldCounter=${fieldCounter}, text="${text}"`,
      );

      // Send the full text using RemoteImeBatchEdit
      remote.sendImeBatchEdit(imeCounter, fieldCounter, text);

      remoteImeInfo[ip].lastSentText = text;
      return res.json({ status: "ok" });
    } catch (e) {
      console.warn(`[Server] RemoteImeBatchEdit failed: ${e.message}`);
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
    if (ch >= "0" && ch <= "9") return { keycode: 7 + (ch.charCodeAt(0) - 48), shift: false };
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
      // NOTE: This approach doesn't sync cursor properly. For proper sync, we should use
      // RemoteImeBatchEdit with empty insert and proper cursor positioning.
      // However, the proper way to handle deletion is to send the new full text
      // with RemoteImeBatchEdit, which will replace the entire field content.
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

// ── Move cursor (send cursor position update) ──────────────────────────────────────────
router.post("/move-cursor", async (req, res) => {
  const { ip, start, end } = req.body;
  const remote = remotes[ip];
  if (!remote) return res.status(400).json({ error: "Not connected" });

  const info = remoteImeInfo[ip];

  try {
    // Try using RemoteImeKeyInject for precise cursor positioning
    if (info?.appPackage && info.counterField !== undefined) {
      const currentValue = remoteImeValue[ip] || "";

      // Increment counter for each cursor update
      const counter = (info.counterField || 0) + 1;
      remoteImeInfo[ip].counterField = counter;

      console.log(
        `[Server] move-cursor using RemoteImeKeyInject: app=${info.appPackage}, start=${start}, end=${end}`,
      );

      remote.sendImeCursorUpdate(info.appPackage, {
        counterField: counter,
        value: currentValue,
        start: start,
        end: end,
      });

      // Update stored cursor position
      remoteImeInfo[ip].cursorStart = start;
      remoteImeInfo[ip].cursorEnd = end;

      return res.json({ status: "ok" });
    }

    // Fallback: Use arrow keys if IME info is not available
    const currentEnd = info?.cursorEnd || 0;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (start < currentEnd) {
      // Move cursor left - send LEFT key events
      const diff = currentEnd - start;
      for (let i = 0; i < diff; i++) {
        remote.sendKey(21, RemoteDirection.SHORT); // KEYCODE_DPAD_LEFT
        await sleep(20);
      }
    } else if (start > currentEnd) {
      // Move cursor right - send RIGHT key events
      const diff = start - currentEnd;
      for (let i = 0; i < diff; i++) {
        remote.sendKey(22, RemoteDirection.SHORT); // KEYCODE_DPAD_RIGHT
        await sleep(20);
      }
    }

    // Update stored cursor position
    if (!remoteImeInfo[ip]) remoteImeInfo[ip] = {};
    remoteImeInfo[ip].cursorStart = start;
    remoteImeInfo[ip].cursorEnd = end;

    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Send keyboard shortcut (Ctrl+key combinations) ───────────────────────────────
router.post("/send-shortcut", async (req, res) => {
  const { ip, shortcut } = req.body;
  const remote = remotes[ip];
  if (!remote) return res.status(400).json({ error: "Not connected" });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Key codes for shortcuts
  const SHORTCUT_KEYS = {
    SELECT_ALL: 30, // KEYCODE_A
    COPY: 35, // KEYCODE_C
    PASTE: 50, // KEYCODE_V
    CUT: 54, // KEYCODE_X
    UNDO: 52, // KEYCODE_Z
    REDO: 29, // KEYCODE_Y
  };

  // Android uses META_LEFT (keycode 117) for Ctrl-like behavior in shortcuts
  // Some devices also support CTRL_LEFT (keycode 113)
  const MODIFIER_KEYCODE = 117; // META_LEFT

  const actionKeycode = SHORTCUT_KEYS[shortcut];
  if (!actionKeycode) {
    return res.status(400).json({ error: "Invalid shortcut" });
  }

  try {
    // Press and hold modifier
    remote.sendKey(MODIFIER_KEYCODE, RemoteDirection.START_LONG);
    await sleep(15);

    // Press the action key
    remote.sendKey(actionKeycode, RemoteDirection.SHORT);
    await sleep(15);

    // Release modifier
    remote.sendKey(MODIFIER_KEYCODE, RemoteDirection.END_LONG);

    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get current IME state (is an input focused?) ─────────────────────────────────────
router.get("/ime-state", (req, res) => {
  const ip = req.query.ip;
  if (
    ip &&
    remoteImeInfo[ip] &&
    (remoteImeInfo[ip].appPackage || remoteImeInfo[ip].counterField !== undefined)
  ) {
    const info = remoteImeInfo[ip];
    return res.json({
      focused: true,
      label: remoteImeLabel[ip] || "",
      value: remoteImeValue[ip] || "",
      start: info.cursorStart || 0,
      end: info.cursorEnd || 0,
    });
  }
  res.json({ focused: false });
});

// ── Get current IME value ───────────────────────────────────────────────────────
router.get("/ime-value", (req, res) => {
  const ip = req.query.ip;
  if (ip && remoteImeValue[ip] !== undefined) {
    const info = remoteImeInfo[ip] || {};
    return res.json({
      value: remoteImeValue[ip],
      start: info.cursorStart || 0,
      end: info.cursorEnd || 0,
    });
  }
  res.json({ value: "", start: 0, end: 0 });
});

// ── Volume polling fallback ───────────────────────────────────────────────────
router.get("/volume", (req, res) => {
  const ip = req.query.ip;
  if (ip && remoteVolume[ip]) return res.json(remoteVolume[ip]);
  res.json({ level: null, maximum: null, muted: false });
});

export default router;
