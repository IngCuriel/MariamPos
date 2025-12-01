// preload.js - Script de preload para comunicación IPC entre Electron y React
const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Escuchar cuando Electron quiere verificar turnos abiertos
  onCheckOpenShifts: (callback) => {
    ipcRenderer.on('check-open-shifts', callback);
  },
  
  // Responder a Electron sobre turnos abiertos
  respondOpenShifts: (hasShifts) => {
    ipcRenderer.send('open-shifts-response', hasShifts);
  },
  
  // Escuchar cuando Electron quiere mostrar recordatorio de turno
  onShowShiftReminderOnClose: (callback) => {
    ipcRenderer.on('show-shift-reminder-on-close', callback);
  },
  
  // Notificar a Electron que el usuario decidió cerrar la aplicación
  notifyAppClose: (shouldClose) => {
    ipcRenderer.send('app-close-decision', shouldClose);
  },
});

