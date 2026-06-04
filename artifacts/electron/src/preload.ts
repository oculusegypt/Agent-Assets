import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("acisElectron", {
  version: process.env["npm_package_version"] || "3.0.0",
  platform: process.platform,
  onUpdateAvailable: (cb: () => void) => ipcRenderer.on("update-available", cb),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
