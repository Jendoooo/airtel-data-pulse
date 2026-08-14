# Airtel Data Pulse

A local-first Chrome dashboard for reading mobile-router SMS and turning them into daily usage and bundle-renewal history.

It works while your computer is connected to the router Wi-Fi. No hosted account is required, and your router credentials, usage history, and source SMS stay on that Chrome profile.

## The simple way to use it

The Chrome extension is the recommended path for everyday users.

1. Connect your computer to the Airtel, MTN, or compatible router Wi-Fi.
2. Download `Airtel-Data-Pulse-Chrome-Extension.zip` from the [latest release](https://github.com/Jendoooo/airtel-data-pulse/releases/latest) and extract it.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Choose **Load unpacked** and select the extracted `extension` folder.
6. Click the **Airtel Data Pulse** icon.
7. Choose your network, confirm the router address, and enter the router login.

The extension opens the dashboard in a full browser tab. See [`extension/README.md`](extension/README.md) for the short installation guide.

## What the dashboard includes

- **Overview:** latest reading, seven-day reported total, tracked total, average, daily/monthly chart tabs, gap detection, filters, CSV export, and usage history.
- **Renewals:** bundle transactions, known spend, typical subscription interval, and an estimated next-renewal date inferred from dated SMS records.
- **Messages:** the source SMS inbox used to build the history, with unreliable numeric sender labels shown as `Router service`.
- **Network:** signal and device diagnostics plus an optional speed test with download, upload, latency, and a practical suitability guide for messaging, calls, streaming, gaming, remote work, and shared households.
- Airtel/MTN-aware colours and router-address presets.
- Airtel/MTN provider badges and a system-native type stack that remains crisp without downloading fonts.
- Lazy-loaded history tables and responsive layouts for smaller screens.

When a daily SMS is missing, Data Pulse marks the date as unreported instead of counting it as zero. The Daily chart may show a striped estimate for a short gap of up to six missing days when reported readings exist on both sides. Longer gaps stay labelled **No report**. Estimates are excluded from official totals, averages, history rows, and monthly totals. Monthly bars stack reported usage with a separate coverage-adjusted estimate based on that month’s reported-day average; the projected amount is clearly labelled and never replaces the official reported total. The Overview also shows a separate projected-period card, while the Weekday chart compares average reported usage per weekday. First and last partial months use the observed router window rather than assuming a full calendar month, so the current month is not projected past the latest router message.

Renewal estimates depend on the messages still present in the router inbox. They are not carrier billing records and may be incomplete after SMS deletion or a router reset.

## Supported routers

The current adapter supports the ZLT/ZTE CGI and SMS interface used by the original router setup. The carrier name alone does not guarantee compatibility because Airtel and MTN distribute multiple router models and firmware versions.

Common starting addresses:

- Airtel: `192.168.1.1` or `192.168.0.1`
- MTN: `192.168.0.1`

You can edit the address during setup. If the router uses a different firmware API, Data Pulse stops with a clear unsupported-router message instead of showing incorrect totals.

Network diagnostics are optional and firmware-dependent. Data Pulse tries both the pre-login and authenticated status paths used by compatible ZLT/ZTE variants. Usage and renewal history can still work when a router does not expose radio metrics.

## Privacy model

- The extension talks directly to the router over the local network.
- Credentials are kept in Chrome local storage only when **Remember password on this device** is selected.
- Usage history and source SMS remain in that Chrome profile.
- SMS content is rendered as text and is not uploaded to a remote service.
- Transaction identifiers are masked in the renewal table; the original message remains available only in the local Messages view.
- The speed test never runs automatically. A run transfers about 13 MB of generated test data to Cloudflare's nearest edge and stores only the resulting measurements locally. Router credentials, SMS, and usage history are not included.
- There is no analytics, hosted login, or required online account.

Only use the remember-password option on a trusted computer. Never publish `.env`, router passwords, `data/usage.json`, or personal SMS exports.

The activity guide uses practical thresholds informed by [Cloudflare's connection-quality methodology](https://developers.cloudflare.com/speed/aim/), [Netflix's streaming recommendations](https://help.netflix.com/en/node/306), and [Zoom's published call requirements](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060748). It is guidance rather than a promise: Wi-Fi interference, carrier congestion, server location, and time of day can change real-world performance.

## Mobile use

Chrome extensions can only be installed on computers, so the extension cannot run directly in Chrome on Android or iPhone.

A same-Wi-Fi phone can use the optional local Node dashboard running on a computer:

1. Copy `.env.example` to `.env` and enter the router address and login.
2. Set `BIND_HOST=0.0.0.0` in `.env`.
3. Run `npm install` and `npm run dev` on the computer.
4. Find the computer's local IPv4 address with `ipconfig`.
5. On the phone, open `http://COMPUTER_IP:3456` while connected to the same router Wi-Fi.

This intentionally makes the local dashboard reachable by other devices on that Wi-Fi. Use it only on a trusted private network, keep `.env` out of source control, and stop the server when finished. Windows Firewall may ask once whether Node.js can accept private-network connections.

## Optional developer mode

The repository also contains a local Node dashboard for developers who prefer a server workflow. It is optional; the Chrome extension is the simplest public-facing experience.

```bash
npm install
npm run dev
```

The local server reads router data while the computer is on the router Wi-Fi. Keep `.env` private and leave `BIND_HOST=127.0.0.1` unless you intentionally need the mobile LAN mode described above.

## Project map

| Path | Purpose |
| --- | --- |
| `extension/` | Recommended Chrome extension |
| `server.js` | Optional local Node router adapter and API |
| `public/` | Optional local dashboard assets |
| `.env.example` | Local configuration template |
| `data/usage.example.json` | Safe example data for development |
| `SECURITY.md` | Security and privacy notes |
| `DESIGN.md` | Visual system and interface guardrails |

## Troubleshooting

**The extension cannot connect**

Confirm that the computer is connected to the router Wi-Fi, check the router address printed on the router label, and verify the username and password in the router admin page.

**The router is unsupported**

Share the router model and firmware version when opening an issue. Do not share passwords, IMEI/IMSI values, phone numbers, or raw SMS exports.

**I changed the code and Chrome still shows the old version**

Open `chrome://extensions` and click **Reload** on Airtel Data Pulse. The extension reads the files from the folder that was loaded there.

## License

MIT. See [LICENSE](LICENSE).
