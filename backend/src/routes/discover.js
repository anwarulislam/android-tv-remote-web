import express from "express";
import { Bonjour } from "bonjour-service";

const router = express.Router();

const bonjour = new Bonjour();

router.get("/", (req, res) => {
  console.log(`[Server] Discovering Android TVs on network...`);
  let found = [];

  const browser = bonjour.find({ type: "androidtvremote2" });

  browser.on("up", (service) => {
    const ip =
      service.addresses.find((a) => a.includes(".")) || service.addresses[0];
    if (ip && !found.find((d) => d.ip === ip)) {
      found.push({ name: service.name, ip });
    }
  });

  setTimeout(() => {
    browser.stop();
    res.json({ devices: found });
  }, 2500);
});

export default router;
