import { contextBridge, ipcRenderer } from 'electron';

// Exponer API segura al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  isElectron: true
});

