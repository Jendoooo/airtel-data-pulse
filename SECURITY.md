# Security policy

Please do not report router passwords, phone numbers, IMSIs, IMEIs, private IP addresses, or usage exports in a public issue.

For a private report, contact the repository owner directly with:

- the affected version or commit
- the route or file involved
- safe reproduction steps with secrets removed
- the potential impact

This project is designed for local use. Do not expose the local server directly to the public internet without adding authentication, HTTPS, and a deliberate data store.

The Chrome extension stores credentials and history locally for convenience. Chrome local storage is not a password vault, so use "Remember password on this device" only on a trusted, encrypted computer profile. Leave it unchecked on shared computers.

The extension declares optional access to local HTTP router addresses, but asks Chrome for only the specific router origin entered during setup. It does not request HTTPS or remote-code permissions.

When `BIND_HOST=0.0.0.0` is used for phone access, anyone on the same Wi-Fi may be able to open the local dashboard. Use that mode only on a trusted private network and stop the Node process when finished.
