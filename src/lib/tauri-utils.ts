/**
 * Environment detection and API configuration utilities
 */

const API_BASE_URL = "http://127.0.0.1:59999";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

let isTauri = false;

try {
  isTauri = typeof window !== "undefined" && window.__TAURI__ !== undefined;
} catch {
  // Not running in Tauri
}

/**
 * Detect if the app is running in Tauri desktop environment
 */
export function isDesktopApp(): boolean {
  return isTauri;
}

/**
 * Get the base URL for API calls
 * Always returns localhost:59999 since the backend service always runs locally
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Get the SSE endpoint URL
 */
export function getSseUrl(): string {
  return `${API_BASE_URL}/sse`;
}

/**
 * Get the discover endpoint URL
 */
export function getDiscoverUrl(): string {
  return `${API_BASE_URL}/discover`;
}

/**
 * Get the remote API endpoint URL
 */
export function getRemoteApiUrl(): string {
  return `${API_BASE_URL}/`;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Open a URL in the default browser
 * Works in both web and desktop modes
 */
export function openUrl(url: string): void {
  window.open(url, "_blank");
}

/**
 * Get the app version
 * Only returns a version in Tauri desktop mode
 */
export async function getVersion(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}
