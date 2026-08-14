# Airtel Data Pulse Chrome extension

This is the easiest version for ordinary Chrome users: connect to the Airtel/ZLT router Wi-Fi, click the extension icon, enter the router login once, and get the full Data Pulse dashboard in a browser tab.

## Install for testing

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select this `extension` folder.
6. Pin **Airtel Data Pulse** to the Chrome toolbar.
7. Connect to the router Wi-Fi and click the extension icon. It opens the full dashboard in a new tab.

The first connection asks Chrome for permission to talk to the router’s local address. The extension then performs the router login and reads the SMS inbox and safe radio-health metrics directly. It does not use the public Vercel deployment for router access.

## Privacy model

- Router credentials are sent directly to the router over the local network.
- Usage history is stored in `chrome.storage.local` for this Chrome profile.
- The extension has no analytics, remote API, or Vercel dependency for live readings.
- Use **Remember password on this device** only on a trusted computer. Chrome extension storage is local convenience storage, not a hardware security vault.

## Supported router

The current adapter targets the same ZLT/Airtel router API and SMS format as the Node dashboard:

```text
data usage on <number> for YYYY-MM-DD was <number> MB
```

For broad public distribution, package this folder through the Chrome Web Store after testing against the target router model. The store version will make installation much easier than **Load unpacked**.
