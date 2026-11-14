# MRK Connect build guide

## Windows development prerequisites

- Windows 10/11 x64
- Node.js 22 LTS (Node 24 may work locally, but CI is pinned to Node 22)
- .NET SDK 8.0 (required to compile the native Windows input helper)
- Git and Visual Studio Code

## Windows app

Open a terminal in `Windows`:

```powershell
npm install
npm start
```

`npm start` compiles TypeScript, publishes the native `MrkInput.exe` helper, and launches Electron. To create the Windows installer:

```powershell
npm run dist
```

The installer output is produced by electron-builder in `Windows/dist`.

## Android app

Open a second terminal in `Android`:

```powershell
npm install
npx expo prebuild --platform android
npx expo run:android
```

Voice recognition uses a native Android module and therefore needs a development build; it will not run inside the standard Expo Go app. After the first native build, start Metro for development with `npx expo start --dev-client`. Speech recognition availability and offline behavior depend on the Android speech service and selected language.

## Pairing test

1. Start the Windows app and keep it open.
2. Connect the Android phone and PC to the same Wi-Fi or phone hotspot.
3. Copy one IPv4 address and the pairing PIN shown in the Windows window.
4. Enter the IP, port `47831`, and PIN in Android.
5. Allow the Windows Firewall prompt only on Private networks you trust.

## Current limitations

This is a development build, not a security-reviewed release. The current local WebSocket and HTTP endpoints use plain `ws://` and `http://`; do not use them on public, shared, or untrusted networks. Pairing credentials are currently process-lifetime credentials. Automatic discovery, QR pairing, PC audio streaming, persistent device revocation, and full transfer progress/cancellation are still pending. Android voice recognition and reviewed text submission are implemented in code but need a native device build and physical-device testing. Android upload/download UI is implemented but also needs end-to-end testing. Build success does not mean all product features are complete; verify the actual device workflow before relying on it.
