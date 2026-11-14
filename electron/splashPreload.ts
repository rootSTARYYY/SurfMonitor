import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('splashAPI', {
  onProgress: (cb: (data: { percent: number; stage: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { percent: number; stage: string }
    ) => cb(payload);
    ipcRenderer.on('startup:progress', listener);
    return () => ipcRenderer.removeListener('startup:progress', listener);
  },
});
