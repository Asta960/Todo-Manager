const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  initData: () => ipcRenderer.invoke("data:init"),
  saveData: (data) => ipcRenderer.invoke("data:save", data),
  changeSaveLocation: (data) => ipcRenderer.invoke("data:change-location", data),
  exportData: (data) => ipcRenderer.invoke("data:export", data),
  importData: () => ipcRenderer.invoke("data:import"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximizeToggle: () => ipcRenderer.invoke("window:maximize-toggle"),
  closeWindow: () => ipcRenderer.invoke("window:close")
});

