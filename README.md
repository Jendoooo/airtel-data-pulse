# Airtel Data Pulse

A privacy-first dashboard for turning daily data-usage SMS messages from a compatible ZLT/Airtel router into a clean usage history, chart, and signal-health view.

The project has two modes:

- **Local mode** connects to your router over the same Wi-Fi, reads the SMS inbox, and stores a private snapshot on your computer.
- **Hosted mode** is safe for a public demo. It serves only the synthetic sample in `data/usage.example.json`; it cannot reach a router inside your home network.

## What the dashboard includes

- Latest reading, seven-day total, tracked total, and daily average.
- Peak and lowest usage days.
- Daily usage chart with 7D, 14D, 30D, and all-history views.
- Search, from/to date filters, usage sorting, and incremental “load more” table rendering.
- Local-only signal health: network type, band, RSRP, RSRQ, SINR, RSSI, bandwidth, uptime, firmware, and frequency.
- Privacy defaults that keep phone numbers, IMSI/IMEI, WAN details, cell IDs, and raw router responses out of the browser API.

## The important mental model

```text
Router Wi-Fi → local Node server → private data/usage.json → browser dashboard
                                      └─ public-safe API response only
```

Vercel can host the interface and a demo snapshot, but a Vercel Function cannot initiate a connection to `192.168.x.x` or another private router address. Live readings therefore happen from the local dashboard while your computer is connected to the router Wi-Fi.

## Easiest option for Chrome users

The repository includes a Chrome extension in [`extension/`](extension/). This is the intended non-technical flow:

1. Install the extension once.
2. Connect Chrome to the Airtel/ZLT router Wi-Fi.
3. Click the **Airtel Data Pulse** icon.
4. Enter the router address, username, and password.
5. View the full dashboard in a new Chrome tab: summary cards, chart, router health, filters, and usage history.

The extension talks directly to the router and keeps the credentials/history inside that Chrome profile. It does not send live router data through Vercel. See [`extension/README.md`](extension/README.md) for testing installation; a Chrome Web Store release would make the final installation one click.

The carrier preset is not a hard-coded router promise: MTN and Airtel use multiple router families. MTN commonly starts at `192.168.0.1`, while Airtel commonly uses `192.168.1.1` or `192.168.0.1`. The extension probes the supported ZLT/ZTE CGI interface and stops with a clear unsupported-model message when a router uses a different firmware API.

## Use it with your router

### 1. Connect to the router

Join the Airtel/ZLT router’s Wi-Fi from the computer that will run the dashboard. The computer and router must be on the same local network.

### 2. Install the project

```bash
git clone https://github.com/Jendoooo/airtel-data-pulse.git
cd airtel-data-pulse
npm install
```

### 3. Create your private configuration

Windows PowerShell:

```powershell
Copy-Item .env.example .env
notepad .env
```

macOS/Linux:

```bash
cp .env.example .env
nano .env
```

Fill in the router values in `.env`:

```env
ROUTER_HOST=192.168.1.1
ROUTER_USERNAME=admin
ROUTER_PASSWORD=your-router-password
BIND_HOST=127.0.0.1
PORT=3456
```

Use the router’s real admin password. Do not commit `.env`, and do not paste its contents into an issue or public post.

### 4. Start the local dashboard

```bash
npm run dev
```

Open [http://127.0.0.1:3456](http://127.0.0.1:3456). On first load the server attempts to read the router SMS inbox. It merges recognized messages by date and writes the private result to `data/usage.json`.

To run a manual sync later:

```bash
npm run sync
```

The sync helper is local-only. It never commits or pushes your usage data.

### 5. Read the dashboard

1. **Connection status** tells you whether the current data came from the router, a saved local snapshot, or the synthetic demo.
2. **Summary cards** show the latest reading and totals across the available history.
3. **Daily Data Usage** lets you change the chart window.
4. **Usage History** supports text search, date filters, sorting, and loading additional rows when the history is long.
5. **Live Router Health** appears when the local server can reach the router. Hosted mode intentionally shows static/demo mode instead.

## Expected SMS format

The current parser looks for messages shaped like:

```text
data usage on <number> for YYYY-MM-DD was <number> MB
```

Router command IDs are isolated in `server.js`, so another compatible firmware adapter can replace the transport/parser without changing the dashboard.

## Deploy the safe demo to Vercel

### Git integration

1. Import this GitHub repository into Vercel.
2. Keep the default Node.js build settings.
3. Deploy without adding router credentials.
4. Open the deployment URL. It should show the synthetic sample and clearly indicate demo/hosted mode.

### CLI

```bash
npm install -g vercel
vercel login
vercel
```

The included `vercel.json` bundles only `data/usage.example.json` into the server function. It does not include a private usage snapshot.

### Vercel limitations to understand

- A hosted function cannot see your home router’s private IP or Wi-Fi network.
- The public deployment is demo/read-only by design; `/api/sync` and live router health are disabled there.
- Serverless filesystems are not a durable database. Real usage history stays in your local `data/usage.json` unless you deliberately add a database or storage service.
- Vercel Functions have platform limits such as payload size, execution duration, and bundle size. This project’s small JSON payload and short router request fit comfortably within those limits.
- `express.static()` is not relied on for the hosted asset path; Vercel serves the `public/` directory and runs `server.js` as the function entry point.

See Vercel’s [Express deployment guide](https://vercel.com/docs/frameworks/backend/express) and [Functions limits](https://vercel.com/docs/functions/limitations) for current platform details.

## Privacy and security

- Credentials are environment-only and are never committed.
- `data/usage.json`, private snapshots, router audits, and generated bundles are ignored by Git.
- API responses expose usage totals and non-identifying radio metrics only.
- Hosted mode reads synthetic data and never writes a personal snapshot.
- The local server binds to `127.0.0.1` by default. Set `BIND_HOST=0.0.0.0` only when you intentionally want LAN access.
- Change any default router password before using the project.

Read [SECURITY.md](SECURITY.md) before opening an issue or publishing a fork.

## Project map

| Path | Purpose |
| --- | --- |
| `server.js` | Express server, router client, SMS parser, privacy-safe API |
| `public/` | Dashboard UI, chart, filters, responsive styles |
| `data/usage.example.json` | Synthetic public demo snapshot |
| `data/usage.json` | Private local snapshot, created at runtime and ignored |
| `.env.example` | Configuration template |
| `scripts/sync-and-push.js` | Local sync helper; no Git operations |
| `vercel.json` | Hosted function and safe demo-data configuration |

## Troubleshooting

**The dashboard shows “Router unreachable”**

Confirm that the computer is connected to the router Wi-Fi, `ROUTER_HOST` is correct, and the router credentials work in its own admin UI. Then run `npm run sync` and refresh the browser.

**The dashboard shows demo data**

That is expected on Vercel and on a fresh checkout without `data/usage.json`. Use the local setup above for your own router history.

**I want to open it on my phone**

Run the local server on the computer connected to the router and set `BIND_HOST=0.0.0.0` intentionally. Use the computer’s LAN IP from the same Wi-Fi. Do not expose the dashboard to the public internet without adding authentication and HTTPS.

## License

MIT. See [LICENSE](LICENSE).
