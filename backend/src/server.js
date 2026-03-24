#!/usr/bin/env node
import cors from "cors";
import express from "express";
import discoverRouter from "./routes/discover.js";
import remoteRouter from "./routes/remote.js";

// Set process name for system monitors
process.title = "androidtv";

const app = express();

// Allow requests from tv.anwar.bd, localhost (dev), and Tauri app (tauri://)
app.use(
  cors({
    origin: [
      "https://tv.anwar.bd",
      "http://tv.anwar.bd",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "tauri://localhost",
      "http://tauri.localhost",
    ],
    credentials: true,
  }),
);

app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url} - Body: ${JSON.stringify(req.body)}`);
  next();
});

app.use("/discover", discoverRouter);
app.use("/", remoteRouter);

const PORT = process.env.PORT || 59999;
const HOST = "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║       AndroidTV Web Remote — Local Server            ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Listening on  http://${HOST}:${PORT}          ║`);
  console.log("║  Open https://tv.anwar.bd in your browser to start  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
});
