#!/usr/bin/env node
import express from "express";
import cors from "cors";
import discoverRouter from "./routes/discover.js";
import remoteRouter from "./routes/remote.js";

const app = express();

// Allow requests from tv.anwar.bd and localhost (dev)
app.use(
  cors({
    origin: [
      "https://tv.anwar.bd",
      "http://tv.anwar.bd",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  }),
);

app.use(express.json());

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
