import { contextBridge, ipcRenderer } from 'electron';

/**
 * The ONLY bridge between the sandboxed renderer and the main process.
 * Expose named, typed operations — never `ipcRenderer` itself, and never a
 * generic `invoke(channel, ...args)` passthrough, which would re-open every
 * IPC handler to any script that manages to run in the renderer.
 */
const api = {
  getAppInfo: () => ipcRenderer.invoke('pursberry:app-info') as Promise<AppInfo>,
} as const;

export interface AppInfo {
  version: string;
  userDataPath: string;
  online: boolean;
}

export type PursberryBridge = typeof api;

contextBridge.exposeInMainWorld('pursberry', api);
