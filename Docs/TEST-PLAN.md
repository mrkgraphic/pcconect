# Test plan

## Network
- Phone hotspot with internet disabled
- Shared Wi-Fi router
- AP/client isolation and blocked multicast fallback
- IP change, disconnect and reconnect

## Keyboard and voice
- Live text, backspace, enter, special keys and shortcut combinations
- Focus handling and unauthorized command rejection
- Speech preview/confirmation and language fallback

## Files
- Multiple files and large files
- Cancellation, interrupted transfer and retry
- Path traversal, filename collisions and disallowed paths
- Verify no automatic execution/opening

## Audio
- Capture/playback, latency, jitter, packet loss, mute and lifecycle

## Security
- Wrong/expired PIN, revoked device, invalid token, oversized upload and malformed messages
