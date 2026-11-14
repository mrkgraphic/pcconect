import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mrkConnect", {
  getHostInfo: () => ipcRenderer.invoke("mrk:host-info"),
  onHostStatus: (callback: (status: "waiting" | "connected") => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: "waiting" | "connected") => callback(status);
    ipcRenderer.on("mrk:host-status", listener);
    return () => ipcRenderer.removeListener("mrk:host-status", listener);
  }
});
