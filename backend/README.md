# AndroidTV Web Remote — Backend Server

Local backend that bridges **[tv.anwar.bd](https://tv.anwar.bd)** to your Android TV over your home network.

## Quick Start

**Option 1 — npx (no install needed)**

```bash
npx androidtv-remote-server
```

**Option 2 — global install**

```bash
npm install -g androidtv-remote-server
androidtv-remote-server
```

Then open **https://tv.anwar.bd** in your browser.

## How it works

```
Browser (tv.anwar.bd) ──HTTP/SSE──► localhost:59999 ──TLS──► Android TV
```

The server runs on `127.0.0.1:59999` and communicates with tv.anwar.bd via cross-origin requests. Your TV credentials are stored locally in `devices.json` — nothing leaves your machine.

## Requirements

- Node.js 18+
- Android TV on the same local network
