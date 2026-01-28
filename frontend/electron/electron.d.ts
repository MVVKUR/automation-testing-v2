// Type definitions for Electron API exposed to renderer
interface ElectronAPI {
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    platform: string;
    arch: string;
  }>;
  getBackendUrl: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  platform: string;
  arch: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
