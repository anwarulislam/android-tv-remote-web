import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import protobufjs from "protobufjs";
import { system } from "systeminformation";

const directory = dirname(fileURLToPath(import.meta.url));

class RemoteMessageManager {
  constructor() {
    this.root = protobufjs.loadSync(path.join(directory, "remotemessage.proto"));
    this.RemoteMessage = this.root.lookupType("remote.RemoteMessage");
    this.RemoteKeyCode = this.root.lookupEnum("remote.RemoteKeyCode").values;
    this.RemoteDirection = this.root.lookupEnum("remote.RemoteDirection").values;

    system().then((data) => {
      this.manufacturer = data.manufacturer;
      this.model = data.model;
    });
  }

  create(payload) {
    if (!payload.remotePingResponse) {
      console.debug(`Create Remote ${JSON.stringify(payload)}`);
    }

    const errMsg = this.RemoteMessage.verify(payload);
    if (errMsg) throw Error(errMsg);

    const message = this.RemoteMessage.create(payload);

    const array = this.RemoteMessage.encodeDelimited(message).finish();

    if (!payload.remotePingResponse) {
      //console.debug("Sending " + Array.from(array));
      console.debug(`Sending ${JSON.stringify(message.toJSON())}`);
    }

    return array;
  }

  createRemoteConfigure(_code1, _model, _vendor, _unknown1, _unknown2) {
    return this.create({
      remoteConfigure: {
        code1: 622,
        deviceInfo: {
          model: this.model,
          vendor: this.manufacturer,
          unknown1: 1,
          unknown2: "1",
          packageName: "androitv-remote",
          appVersion: "1.0.0",
        },
      },
    });
  }

  createRemoteSetActive(active) {
    return this.create({
      remoteSetActive: {
        active: active,
      },
    });
  }

  createRemotePingResponse(val1) {
    return this.create({
      remotePingResponse: {
        val1: val1,
      },
    });
  }

  createRemoteKeyInject(direction, keyCode) {
    return this.create({
      remoteKeyInject: {
        keyCode: keyCode,
        direction: direction,
      },
    });
  }

  createRemoteAdjustVolumeLevel(level) {
    return this.create({
      remoteAdjustVolumeLevel: level,
    });
  }

  createRemoteResetPreferredAudioDevice() {
    return this.create({
      remoteResetPreferredAudioDevice: {},
    });
  }

  createRemoteImeKeyInject(appPackage, status) {
    return this.create({
      remoteImeKeyInject: {
        textFieldStatus: status,
        appInfo: {
          appPackage: appPackage,
        },
      },
    });
  }

  /**
   * Create a RemoteImeKeyInject message for cursor position updates
   * This is used to sync cursor position changes from the remote to the TV
   * @param {string} appPackage - The app package name
   * @param {object} textFieldStatus - The text field status with updated cursor position
   * @param {number} textFieldStatus.counterField - The counter field from TV
   * @param {string} textFieldStatus.value - The current text value (unchanged)
   * @param {number} textFieldStatus.start - New cursor start position
   * @param {number} textFieldStatus.end - New cursor end position
   */
  createRemoteImeCursorUpdate(appPackage, textFieldStatus) {
    return this.create({
      remoteImeKeyInject: {
        textFieldStatus: textFieldStatus,
        appInfo: {
          appPackage: appPackage,
        },
      },
    });
  }

  /**
   * Create a RemoteImeBatchEdit message for sending text to the TV
   * This is the proper way to send text input to Android TV's IME
   * @param {number} imeCounter - The IME counter (increments with each batch edit)
   * @param {number} fieldCounter - The field counter from TV's textFieldStatus.counterField
   * @param {string|number} insertText - The text to insert (can be a string or character code)
   */
  createRemoteImeBatchEdit(imeCounter, fieldCounter, insertText) {
    return this.create({
      remoteImeBatchEdit: {
        imeCounter: imeCounter,
        fieldCounter: fieldCounter,
        editInfo: {
          insert: insertText,
        },
      },
    });
  }

  createRemoteRemoteAppLinkLaunchRequest(app_link) {
    return this.create({
      remoteAppLinkLaunchRequest: {
        appLink: app_link,
      },
    });
  }

  parse(buffer) {
    return this.RemoteMessage.decodeDelimited(buffer);
  }
}
const remoteMessageManager = new RemoteMessageManager();

export { remoteMessageManager };
