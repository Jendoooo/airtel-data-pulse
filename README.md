# Airtel Data Pulse

A local-first Chrome dashboard for reading mobile-router usage SMS and turning them into a clear history of daily data use.

It works while your computer is connected to the router Wi-Fi. No hosted account is required, and your router credentials, usage history, and source SMS stay on that Chrome profile.

## The simple way to use it

The Chrome extension is the recommended path for everyday users.

1. Connect your computer to the Airtel, MTN, or compatible router Wi-Fi.
2. Download or clone this repository.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Choose **Load unpacked** and select the repository's `extension` folder.
6. Click the **Airtel Data Pulse** icon.
7. Choose your network, confirm the router address, and enter the router login.

The extension opens the dashboard in a full browser tab. See [`extension/README.md`](extension/README.md) for the short installation guide.

## What the dashboard includes

- **Overview:** latest reading, seven-day total, tracked total, average, trend chart, filters, and usage history.
- **Network:** signal quality, network type, band, RSRP, RSRQ, SINR, RSSI, bandwidth, uptime, firmware, and frequency when the router provides them.
- **Messages:** the source SMS inbox used to build the usage history, shown only after you choose to open it.
- Airtel/MTN-aware colours and router-address presets.
- Lazy-loaded history tables and responsive layouts for smaller screens.

## Supported routers

The current adapter supports the ZLT/ZTE CGI and SMS interface used by the original router setup. The carrier name alone does not guarantee compatibility because Airtel and MTN distribute multiple router models and firmware versions.

Common starting addresses:

- Airtel: `192.168.1.1` or `192.168.0.1`
- MTN: `192.168.0.1`

You can edit the address during setup. If the router uses a different firmware API, Data Pulse stops with a clear unsupported-router message instead of showing incorrect totals.

## Privacy model

- The extension talks directly to the router over the local network.
- Credentials are kept in Chrome local storage only when **Remember password on this device** is selected.
- Usage history and source SMS remain in that Chrome profile.
- SMS content is rendered as text and is not uploaded to a remote service.
- There is no analytics, hosted login, or required online account.

Only use the remember-password option on a trusted computer. Never publish `.env`, router passwords, `data/usage.json`, or personal SMS exports.

## Optional developer mode

The repository also contains a local Node dashboard for developers who prefer a server workflow. It is optional; the Chrome extension is the simplest public-facing experience.

```bash
npm install
npm run dev
```

The local server reads router data while the computer is on the router Wi-Fi. Keep `.env` private and bind the server to `127.0.0.1` unless you intentionally need LAN access.

## Project map

| Path | Purpose |
| --- | --- |
| `extension/` | Recommended Chrome extension |
| `server.js` | Optional local Node router adapter and API |
| `public/` | Optional local dashboard assets |
| `.env.example` | Local configuration template |
| `data/usage.example.json` | Safe example data for development |
| `SECURITY.md` | Security and privacy notes |

## Troubleshooting

**The extension cannot connect**

Confirm that the computer is connected to the router Wi-Fi, check the router address printed on the router label, and verify the username and password in the router admin page.

**The router is unsupported**

Share the router model and firmware version when opening an issue. Do not share passwords, IMEI/IMSI values, phone numbers, or raw SMS exports.

**I changed the code and Chrome still shows the old version**

Open `chrome://extensions` and click **Reload** on Airtel Data Pulse. The extension reads the files from the folder that was loaded there.

## License

MIT. See [LICENSE](LICENSE).
