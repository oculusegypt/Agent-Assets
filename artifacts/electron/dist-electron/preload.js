"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("acisElectron", {
    version: process.env["npm_package_version"] || "3.0.0",
    platform: process.platform,
    onUpdateAvailable: (cb) => electron_1.ipcRenderer.on("update-available", cb),
    minimize: () => electron_1.ipcRenderer.send("window-minimize"),
    maximize: () => electron_1.ipcRenderer.send("window-maximize"),
    close: () => electron_1.ipcRenderer.send("window-close"),
});
