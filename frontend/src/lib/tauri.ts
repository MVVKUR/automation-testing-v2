// Legacy Tauri API compatibility layer
// This file re-exports from api.ts to maintain backward compatibility
// All API calls now go through HTTP to the Python backend

export * from './api';
export { default } from './api';

// Re-export the isElectron check as isTauri for backward compatibility
export { isElectron as isTauri } from './api';
