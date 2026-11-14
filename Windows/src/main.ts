import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import QRCode from "qrcode";
import { startLocalHost, stopLocalHost, HostInfo } from "./server";

let hostInfo: HostInfo | null = null;

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 820,
    minHeight: 620,
    title: "MRK Connect",
    backgroundColor: "#0b1210",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  void window.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  try {
    hostInfo = await startLocalHost((status) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("mrk:host-status", status);
      }
    });
    hostInfo.qrDataUrl = await QRCode.toDataURL(JSON.stringify({ scheme: "mrkconnect", addresses: hostInfo.addresses, port: hostInfo.port, pairingCode: hostInfo.pairingCode }), { width: 260, margin: 2 });
  } catch (error) {
    console.error("Could not start local connection host:", error);
  }

  ipcMain.handle("mrk:host-info", () => hostInfo);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  void stopLocalHost();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
