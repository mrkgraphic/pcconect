# Architecture

## Components
- Windows Electron desktop UI and local host
- Windows input/audio adapters with least privilege
- Expo Android client
- Shared, versioned protocol

## Local network flow
1. Discover Windows host using mDNS where available, with UDP broadcast fallback.
2. Pair using short-lived PIN/QR/manual-IP fallback.
3. Establish authenticated session.
4. Use WebSocket for keyboard/voice/status and HTTP streaming for files.
5. Select and validate the audio transport in a dedicated latency/reliability spike.

## Trust boundaries
Same-network membership is not authentication. Every client command and transfer must be authorized. Restrict file paths to configured directories and never execute received content.
