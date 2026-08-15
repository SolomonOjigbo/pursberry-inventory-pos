import type { PursberryBridge } from '../electron/preload.js';

declare global {
  interface Window {
    pursberry?: PursberryBridge;
  }
}

/**
 * The same React tree runs in Electron and in the browser (POS-101's AC), so
 * renderer code must never assume the bridge exists. Returns undefined on web.
 */
export function getBridge(): PursberryBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.pursberry;
}

export const isDesktop = (): boolean => getBridge() !== undefined;
