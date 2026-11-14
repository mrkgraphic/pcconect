# MRK Connect

**MRK Connect** is a local-network companion system that connects an Android phone to a Windows PC over the same Wi-Fi network or a phone hotspot. Core local features are designed to work without internet access.

> Project status: **Active development / partial implementation**. Windows pairing host, Android manual PIN pairing UI, Windows native input helper, Android touchpad/keyboard controls (including drag/double-click and shortcuts), reviewed Android voice typing, and Android/Windows restricted file-transfer paths have been added. These features are not yet verified on physical devices. PC audio streaming, automatic discovery, QR pairing, persistent device revocation, and production security hardening remain unfinished.

## Product goals

- Wireless keyboard + mouse: live text entry, special keys/shortcuts, touchpad pointer, tap/click, double-click, right-click, scroll and drag.
- Voice typing: Android microphone/speech recognition sends approved text to Windows.
- Two-way file transfer: phone uploads to a restricted PC receive folder; phone downloads only from a configured PC shared folder.
- PC audio on phone speaker: capture PC output and play it on Android.
- Automatic device discovery and secure pairing, with QR/manual-IP fallback.
- Connection and transfer notifications.
- Windows installer (EXE) and Android APK.

## Repository layout

```text
pcconect/
├── Windows/                 # Electron desktop app and Windows integration
│   ├── app/                 # Electron main, preload, renderer
│   ├── native/              # Windows-only input/audio adapters
│   └── installer/           # Windows packaging configuration
├── Android/                 # Expo / React Native app
│   └── app/                 # Expo application and feature modules
├── Shared/
│   ├── protocol/             # Versioned message contract
│   └── schemas/              # Shared validation schemas
├── Docs/                     # Architecture, security and test plans
└── README.md
```

## Architecture

- **Windows:** Electron UI, a narrowly scoped local host, Windows input adapter, file-transfer service and audio-capture adapter.
- **Android:** Expo / React Native UI with native modules/plugins where Android APIs require them.
- **Transport:** local discovery (mDNS where supported, UDP broadcast fallback), WebSocket for interactive commands/status, and HTTP streaming for files. Audio transport will be selected after a latency/reliability spike (WebRTC or sequenced UDP/Opus).
- **Shared contract:** versioned JSON messages and explicit capability negotiation.

## Security principles

1. Pair devices using a short-lived PIN/QR flow and issue revocable device credentials.
2. Authenticate every session; never trust a device merely because it is on the same Wi-Fi.
3. Restrict uploads to `MRK-Received` and downloads to an explicitly configured `MRK-Shared` directory.
4. Reject path traversal, unsafe filenames and unexpected content; never auto-open or execute received files.
5. Start with a configurable **100 MiB per-file limit** and enforce it while streaming.
6. Bind services to the local network only; do not expose the control/file server to the public internet.
7. Keep Windows keyboard injection in the logged-in user's session; do not run a privileged system-wide input service without a justified need.

## Development roadmap

### Phase 0 — Foundation (current)
- [x] Establish project layout and product plan.
- [x] Define shared protocol baseline.
- [ ] Add runnable Windows Electron and Android Expo shells.
- [ ] Add linting, type checking and CI.

### Phase 1 — Discovery and pairing
- [ ] Discover PC automatically on hotspot and shared Wi-Fi.
- [ ] Add PIN/QR/manual-IP pairing fallback.
- [ ] Create authenticated session and device revocation.

### Phase 2 — Keyboard and voice
- [x] Implement live keyboard input and basic shortcuts (physical-device verification pending).
- [x] Implement touchpad mouse: pointer movement, left/right/double click, scroll and drag (physical-device verification pending).
- [ ] Preserve the proven keyboard behavior from the existing prototype during migration.
- [x] Add Android speech recognition, preview and send (native device build and language testing pending).
- [ ] Test language/device support and document offline speech limitations.

### Phase 3 — Two-way file transfer
- [x] Upload a selected file from Android to `MRK-Received` (multi-file selection and transfer progress pending).
- [x] Browse `MRK-Shared` and download selected files to Android (physical-device verification pending).
- [ ] Add progress, cancellation, retry, notifications and file validation.

### Phase 4 — PC audio on Android
- [ ] Capture PC output using a Windows audio loopback adapter.
- [ ] Evaluate WebRTC versus Opus over sequenced UDP.
- [ ] Add Android playback, jitter handling and lifecycle controls.
- [ ] Measure latency, reconnect behavior and packet-loss recovery.

### Phase 5 — Reliability and releases
- [ ] Handle network changes, reconnect and multiple saved PCs.
- [ ] Add automated unit/integration tests and a security review.
- [ ] Build/sign Windows installer and Android APK.
- [ ] Publish installation, troubleshooting and privacy documentation.

## Acceptance checklist

- [ ] Pair over phone hotspot with internet disabled.
- [ ] Pair over the same Wi-Fi router.
- [ ] Keyboard special keys and shortcuts work reliably.
- [ ] Voice text reaches the focused PC application only after user confirmation.
- [ ] Multiple files upload/download with progress and safe path restrictions.
- [ ] PC audio plays through the Android speaker with measured latency.
- [ ] Unauthorized devices and path traversal attempts are rejected.
- [ ] Reconnect succeeds after Wi-Fi/hotspot interruption.

## Development

Each application will have its own setup guide once the first runnable app shells are committed. Use the current Node.js LTS release compatible with the Expo SDK and Electron toolchain; exact versions will be pinned in each app's package manifest.

## Scope notes

- v1 streams PC audio **to the Android phone speaker**; it does not create a virtual Windows audio output device.
- Android speech recognition may use online services depending on device, language and OS support. Offline recognition is a separately verified capability, not assumed.
- Automatic discovery can be blocked by router/AP isolation or phone hotspot behavior; QR/manual IP remains the fallback.
