# Wireless mouse feature

MRK Connect will provide a touchpad surface in the Android app and control the Windows pointer.

## User interactions

- One-finger movement: move pointer.
- Single tap: left click.
- Two-finger tap: right click.
- Two-finger movement: vertical/horizontal scroll.
- Double tap and hold, then move: drag.
- Optional left/right click buttons for users who prefer visible controls.

## Input transport

Mouse events use the shared authenticated session and the versioned events in `Shared/protocol/mouse.v1.json`. Movement is relative (`dx`, `dy`) rather than sending screen coordinates, so different phone and monitor sizes do not need matching dimensions.

## Reliability and safety

- Coalesce high-frequency movement events and rate-limit them.
- Clamp movement deltas on the Windows side.
- Keep button state per paired session.
- Release held buttons on disconnect, app backgrounding or pairing revocation.
- Do not let mouse messages invoke arbitrary shell commands.
- Add sensitivity settings and test with multiple monitor layouts.

## Current status

The feature is included in product scope, the Android/Windows foundation screens and the shared protocol draft. Native Windows pointer injection and live Android touchpad transport are **not implemented yet**.
