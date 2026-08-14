# Airtel Data Pulse Chrome extension

The easiest way to use Data Pulse: connect to your router Wi-Fi, click the extension, enter the router login, and read your usage in a full Chrome tab.

## Install for testing

1. Download the extension ZIP from the repository's latest GitHub release and extract it, or clone the repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select this `extension` folder.
6. Pin **Airtel Data Pulse** to the Chrome toolbar.
7. Connect to the router Wi-Fi and click the extension icon.

On first use, choose **Airtel**, **MTN**, or **Other network**, confirm the router address, and enter the router username and password. Chrome will ask for permission to talk to that local router address.

## Dashboard views

- **Overview** keeps the main screen focused on reported totals, Daily/Monthly chart tabs in one workspace, missing-report estimates, filters, CSV export, and daily history.
- **Renewals** identifies bundle transaction messages, calculates known spend, and estimates the typical interval and next renewal when at least two dated events exist.
- **Messages** shows the source SMS inbox. Numeric sender values such as `0` or `1` are labelled `Router service`, and content is rendered safely as text.
- **Network** is a compact secondary diagnostic view for radio and device health when the router exposes it. An included glossary explains RSRP, RSRQ, SINR, RSSI, band, frequency, and bandwidth.

Renewal cadence is an inference from available SMS history, not a guarantee from Airtel or MTN. Transaction IDs are masked in the renewal table.

Missing daily reports are never treated as zero. Short gaps with reported readings on both sides may appear as clearly labelled striped estimates; longer gaps remain **No report**. Estimates are excluded from totals. Monthly bars and exports use reported readings only and include coverage fields so partial months are not mistaken for complete ones.

## Privacy

- Credentials are sent directly to the router over the local network.
- Usage history and source SMS are stored in `chrome.storage.local` for this Chrome profile.
- No hosted account or remote API is required.
- There is no analytics or background upload of router data.
- Use **Remember password on this device** only on a trusted computer.

## Router compatibility

The adapter currently targets the ZLT/ZTE CGI and SMS interface used by the original setup. Airtel and MTN use multiple router models, so the carrier preset changes the common address but does not guarantee that every model has the same API.

Common starting addresses:

- Airtel: `192.168.1.1` or `192.168.0.1`
- MTN: `192.168.0.1`

If a router uses a different firmware API, the extension reports that it is unsupported rather than silently returning incorrect usage.

## After updating the files

If Chrome is already using this folder, open `chrome://extensions` and click **Reload** on Airtel Data Pulse. The current extension package version is `0.7.0`.

## Mobile note

Chrome does not install extensions on mobile devices. The root project README documents an optional same-Wi-Fi local-server route for viewing the dashboard from a phone.
