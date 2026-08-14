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

- **Overview** keeps the main screen focused on reported totals, a separate projected-period total, Daily/Monthly/Weekday chart tabs in one workspace, missing-report estimates, filters, CSV export, and daily history.
- **Renewals** identifies bundle transaction messages, calculates known spend, and estimates the typical interval and next renewal when at least two dated events exist.
- **Messages** shows the source SMS inbox. Numeric sender values such as `0` or `1` are labelled `Router service`, and content is rendered safely as text.
- **Network** combines radio and device health with an optional speed test. It reports download, upload, latency, and what the result should comfortably handle for common household activities. The included glossary explains RSRP, RSRQ, SINR, RSSI, band, frequency, and bandwidth.

Renewal cadence is an inference from available SMS history, not a guarantee from Airtel or MTN. Transaction IDs are masked in the renewal table.

Missing daily reports are never treated as zero. Short gaps with reported readings on both sides may appear as clearly labelled striped estimates; longer gaps remain **No report**. Estimates are excluded from official totals. Monthly bars stack reported usage with a separate, clearly labelled coverage-adjusted projection based on the month’s reported-day average. The top-level projected-period card is an additive view of reported usage plus those missing-day estimates; it never replaces the official tracked total. Weekday analysis shows average reported usage per weekday so weekdays with more calendar occurrences do not look artificially larger. Exports include reported, estimated, projected, and coverage fields; first and last partial months use the observed router window, so the current month is not projected into future dates beyond the latest router message.

## Privacy

- Credentials are sent directly to the router over the local network.
- Usage history and source SMS are stored in `chrome.storage.local` for this Chrome profile.
- No hosted account is required, and router usage works without a remote API. Cloudflare is contacted only when you choose to run the optional speed test.
- There is no analytics or background upload of router data.
- The speed test is user-triggered, uses about 13 MB per run against Cloudflare's nearest edge, and stores only the result locally. It never sends router credentials, SMS, or usage history.
- Use **Remember password on this device** only on a trusted computer.

## Router compatibility

The adapter currently targets the ZLT/ZTE CGI and SMS interface used by the original setup. Airtel and MTN use multiple router models, so the carrier preset changes the common address but does not guarantee that every model has the same API.

Common starting addresses:

- Airtel: `192.168.1.1` or `192.168.0.1`
- MTN: `192.168.0.1`

If a router uses a different firmware API, the extension reports that it is unsupported rather than silently returning incorrect usage.

## After updating the files

If Chrome is already using this folder, open `chrome://extensions` and click **Reload** on Airtel Data Pulse. The current extension package version is `1.0.0`.

## Mobile note

Chrome does not install extensions on mobile devices. The root project README documents an optional same-Wi-Fi local-server route for viewing the dashboard from a phone.
