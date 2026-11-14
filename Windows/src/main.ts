import { app, BrowserWindow } from "electron";
import path from "node:path";

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 820,
    minHeight: 620,
    title: "MRK Connect",
    backgroundColor: "#0b1210",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  void window.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
