# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Android TV Web Remote** application that allows controlling Android TVs through a web browser. The project consists of:

- **Frontend**: React + TypeScript + Vite app running on tv.anwar.bd or localhost:5173
- **Backend**: Node.js/Express server running on 127.0.0.1:59999 that bridges HTTP requests to Android TV via TLS

## Development Commands

### Frontend (root directory)
```bash
# Run dev server
bun run dev  # or: npm run dev

# Build for production
bun run build  # or: npm run build

# Lint with Biome
bun run lint  # or: npm run lint

# Format code
bun run format  # or: npm run format

# Preview production build
bun run preview  # or: npm run preview
```

### Backend (backend/ directory)
```bash
# Run local server
bun run dev  # or: npm run dev

# Start production server
bun run start  # or: npm run start

# Or run directly with node
node backend/src/server.js
```

## Architecture

### Communication Flow
```
Browser (tv.anwar.bd) ──HTTP/SSE──► localhost:59999 ──TLS/protobuf──► Android TV
```

1. Frontend communicates with backend via REST API and SSE (Server-Sent Events)
2. Backend communicates with Android TV using custom TLS protocol with protobuf messages
3. Device discovery uses mDNS/Bonjour (service type: `androidtvremote2`)

### Frontend Architecture

**State Management** (`src/hooks/useAndroidTV.tsx`):
- Central React Context (`AndroidTVProvider`) manages all connection and remote state
- Device states: `discovering`, `discovered`, `disconnected`, `pairing`, `needs_pin`, `connected`, `select_saved`, `no_server`, `connection_timeout`
- SSE connection for real-time volume and IME (Input Method Editor) updates

**Key Hooks**:
- `useAndroidTV` - Main state and API functions
- `useKeyboardImeControls` - IME/text input modal with cursor management
- `useRemoteHotkeys` - Keyboard shortcuts for remote control

**Components**:
- `ConnectionScreen` - Device discovery and pairing UI
- `RemoteScreen` - Main remote control interface
- `remote/*` - DPad, volume, media controls, action buttons, keyboard

### Backend Architecture

**Server** (`backend/src/server.js`):
- Express server on port 59999
- CORS configured for tv.anwar.bd and localhost
- Routes: `/discover` and `/` (remote operations)

**State Management** (`backend/src/routes/remote.js`):
- `remotes` - Map of `AndroidRemote` instances per IP
- `remotesState` - Connection state per IP
- `remoteVolume` - Volume state per IP
- `remoteImeLabel`, `remoteImeValue`, `remoteImeInfo` - IME state per IP
- `sseClients` - SSE subscribers for broadcasting events
- `savedDevices` - Persisted to `devices.json` with certificates

**SSE Events**:
- `volume` - Volume level changes
- `ime_show` - Open keyboard input modal
- `ime_update` - Text field value updates
- `ime_hide` - Close keyboard modal

### Android TV Library

Located in `backend/lib/androidtv-remote/`:
- `index.js` - Main `AndroidRemote` class
- `pairing/*` - Certificate generation and TLS pairing
- `remote/*` - `RemoteManager` and `RemoteMessageManager` for protobuf communication
- Uses patched version of `androidtv-remote` npm package with custom event handlers

## Code Style

- Uses **Biome** for linting and formatting (configured in `biome.json`)
- 2-space indentation, 100 char line width
- Double quotes, trailing commas, semicolons
- TypeScript strict mode enabled

## Key Implementation Details

### IME (Input Method Editor) Synchronization
The app handles text input with cursor synchronization:
1. TV sends `ime_show` event with current text and cursor position
2. Frontend opens modal and focuses textarea
3. User types locally with debounced sync (30ms) to TV
4. TV sends `ime_batch_edit` events with text changes
5. Frontend uses `isTypingRef` to prevent TV echo from overwriting user input

### Certificate Persistence
- Paired devices store certificates in `backend/src/devices.json`
- Certificates are reused for auto-reconnect on saved devices
- 5-second connection timeout with retry UI

### Keyboard Shortcuts
Documented in `RemoteScreen.tsx`:
- Arrow keys for navigation
- Space for play/pause
- Shift + arrows for volume and seek
- Cmd + arrows for prev/next track
- Typing sends text directly to TV
- Escape for back
