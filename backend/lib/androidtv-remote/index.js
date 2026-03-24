import EventEmitter from "node:events";
import { CertificateGenerator } from "./certificate/CertificateGenerator.js";
import { PairingManager } from "./pairing/PairingManager.js";
import { RemoteManager } from "./remote/RemoteManager.js";
import { remoteMessageManager } from "./remote/RemoteMessageManager.js";

export class AndroidRemote extends EventEmitter {
  constructor(host, options) {
    super();
    this.host = host;
    this.cert = {
      key: options.cert?.key,
      cert: options.cert?.cert,
    };
    this.pairing_port = options.pairing_port ? options.pairing_port : 6467;
    this.remote_port = options.remote_port ? options.remote_port : 6466;
    this.service_name = options.service_name ? options.service_name : "Service Name";
  }

  async start() {
    if (!this.cert.key || !this.cert.cert) {
      this.cert = CertificateGenerator.generateFull(
        this.service_name,
        "CNT",
        "ST",
        "LOC",
        "O",
        "OU",
      );

      this.pairingManager = new PairingManager(
        this.host,
        this.pairing_port,
        this.cert,
        this.service_name,
      );
      this.pairingManager.on("secret", () => this.emit("secret"));

      const paired = await this.pairingManager.start().catch((error) => {
        console.error(error);
      });

      if (!paired) {
        return;
      }
    }

    this.remoteManager = new RemoteManager(this.host, this.remote_port, this.cert);

    this.remoteManager.on("powered", (powered) => this.emit("powered", powered));

    this.remoteManager.on("volume", (volume) => this.emit("volume", volume));

    this.remoteManager.on("current_app", (current_app) => this.emit("current_app", current_app));

    this.remoteManager.on("ready", () => this.emit("ready"));

    this.remoteManager.on("unpaired", () => this.emit("unpaired"));

    // ── IME Event Forwarding (PATCHED) ───────────────────────────────────────
    this.remoteManager.on("ime_show", (data) => this.emit("ime_show", data));
    this.remoteManager.on("ime_hide", () => this.emit("ime_hide"));
    this.remoteManager.on("ime_batch_edit", (data) => this.emit("ime_batch_edit", data));
    // ────────────────────────────────────────────────────────────────────────────

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const started = await this.remoteManager.start().catch((error) => {
      console.error(error);
    });

    return started;
  }

  sendCode(code) {
    return this.pairingManager.sendCode(code);
  }

  sendPower() {
    return this.remoteManager.sendPower();
  }

  sendAppLink(app_link) {
    return this.remoteManager.sendAppLink(app_link);
  }

  sendKey(key, direction) {
    return this.remoteManager.sendKey(key, direction);
  }

  // ── IME Text Injection (PATCHED) ───────────────────────────────────────────────
  /**
   * Send text to the TV's IME input field using RemoteImeBatchEdit
   * This is the proper way to send text to Android TV's IME for real-time synchronization
   * @param {number} imeCounter - The IME counter (increments with each batch edit)
   * @param {number} fieldCounter - The field counter from TV's textFieldStatus.counterField
   * @param {string|number} insertText - The text to insert (string or character code)
   */
  sendImeBatchEdit(imeCounter, fieldCounter, insertText) {
    const message = remoteMessageManager.createRemoteImeBatchEdit(
      imeCounter,
      fieldCounter,
      insertText,
    );
    this.remoteManager.client.write(message);
    return true;
  }

  /**
   * Send text using RemoteImeKeyInject (legacy method, less reliable)
   * @param {string} appPackage - The app package name (e.g., "com.youtube.vtube")
   * @param {object} textFieldStatus - The text field status object
   * @param {number} textFieldStatus.counterField - The counter field (incrementing number)
   * @param {string} textFieldStatus.value - The text value to send
   * @param {number} textFieldStatus.start - Selection start position
   * @param {number} textFieldStatus.end - Selection end position
   */
  sendImeText(appPackage, textFieldStatus) {
    const message = remoteMessageManager.createRemoteImeKeyInject(appPackage, textFieldStatus);
    this.remoteManager.client.write(message);
    return true;
  }

  /**
   * Send cursor position update to the TV
   * This is used to sync cursor position changes from the remote to the TV
   * @param {string} appPackage - The app package name
   * @param {object} textFieldStatus - The text field status with updated cursor position
   * @param {number} textFieldStatus.counterField - The counter field from TV
   * @param {string} textFieldStatus.value - The current text value (unchanged)
   * @param {number} textFieldStatus.start - New cursor start position
   * @param {number} textFieldStatus.end - New cursor end position
   */
  sendImeCursorUpdate(appPackage, textFieldStatus) {
    const message = remoteMessageManager.createRemoteImeCursorUpdate(appPackage, textFieldStatus);
    this.remoteManager.client.write(message);
    return true;
  }
  // ────────────────────────────────────────────────────────────────────────────

  getCertificate() {
    return {
      key: this.cert.key,
      cert: this.cert.cert,
    };
  }

  stop() {
    this.remoteManager.stop();
  }
}

const RemoteKeyCode = remoteMessageManager.RemoteKeyCode;
const RemoteDirection = remoteMessageManager.RemoteDirection;

export { RemoteDirection, RemoteKeyCode };
export default {
  AndroidRemote,
  CertificateGenerator,
  RemoteKeyCode,
  RemoteDirection,
};
