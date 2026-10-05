import { TokenStorage } from './types.js';

/**
 * In-memory storage fallback when localStorage is unavailable.
 */
export class MemoryStorage implements TokenStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/**
 * LocalStorage wrapper with safe SSR and iframe fallback.
 */
export class BrowserLocalStorage implements TokenStorage {
  getItem(key: string): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage quota or sandboxed iframe restriction
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

/**
 * SessionStorage wrapper.
 */
export class BrowserSessionStorage implements TokenStorage {
  getItem(key: string): string | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignore
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

/**
 * Returns the most appropriate storage engine for the current runtime.
 */
export function getDefaultStorage(): TokenStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return new BrowserLocalStorage();
  }
  return new MemoryStorage();
}
