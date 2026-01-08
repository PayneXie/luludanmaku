import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Init logger in preload to catch renderer errors
try {
  const log = require('electron-log/renderer');
  // Optional: redirect console to log
  // Object.assign(console, log.functions);
} catch (e) {
  console.error('Failed to init electron-log in preload', e);
}

const handler = {
  send(channel: string, value: any) {
    ipcRenderer.send(channel, value)
  },
  invoke(channel: string, value: any) {
    return ipcRenderer.invoke(channel, value)
  },
  on(channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(_event, ...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel)
  },
}

contextBridge.exposeInMainWorld('ipc', handler)

export type IpcHandler = typeof handler
