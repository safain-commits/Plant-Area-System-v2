'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
const storageKey = 'plant-ui-theme';
const normalize = (value: string | null): ThemePreference =>
  value === 'light' || value === 'dark' ? value : 'system';
const ThemeContext = createContext<{
  preference: ThemePreference;
  resolved: ResolvedTheme;
  ready: boolean;
  choose: (value: ThemePreference) => void;
} | null>(null);

function applyTheme(preference: ThemePreference) {
  const resolved: ResolvedTheme =
    preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The first render matches the server. The head script already sets the visual theme.
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const [ready, setReady] = useState(false);
  const current = useRef<ThemePreference>('system');
  const update = useCallback((value: ThemePreference) => {
    current.current = value;
    setResolved(applyTheme(value));
    setPreference(value);
  }, []);
  useEffect(() => {
    let saved: ThemePreference = 'system';
    try {
      saved = normalize(localStorage.getItem(storageKey));
    } catch {
      /* Private/blocked storage. */
    }
    update(saved);
    setReady(true);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const systemChanged = () => {
      if (current.current === 'system') setResolved(applyTheme('system'));
    };
    const storageChanged = (event: StorageEvent) => {
      // A similarly named sessionStorage key must not change the persisted UI preference.
      try {
        if (event.storageArea !== localStorage) return;
      } catch {
        return;
      }
      if (event.key === storageKey || event.key === null) update(normalize(event.newValue));
    };
    // A document restored from the browser back/forward cache may have missed storage/media events.
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      try {
        update(normalize(localStorage.getItem(storageKey)));
      } catch {
        setResolved(applyTheme(current.current));
      }
    };
    media.addEventListener('change', systemChanged);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('pageshow', restored);
    return () => {
      media.removeEventListener('change', systemChanged);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('pageshow', restored);
    };
  }, [update]);
  const choose = useCallback(
    (value: ThemePreference) => {
      update(value);
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        /* Keep the in-memory choice usable. */
      }
    },
    [update],
  );
  return (
    <ThemeContext.Provider value={{ preference, resolved, ready, choose }}>{children}</ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeToggle requires ThemeProvider');
  const dark = theme.resolved === 'dark';
  const description = `Tema ${dark ? 'gelap' : 'terang'}${theme.preference === 'system' ? ' mengikuti sistem' : ''}. Ganti ke ${dark ? 'terang' : 'gelap'}.`;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Tema gelap"
      aria-pressed={dark}
      title={description}
      disabled={!theme.ready}
      onClick={() => theme.choose(dark ? 'light' : 'dark')}
    >
      <svg
        className="theme-icon theme-icon-sun"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <svg
        className="theme-icon theme-icon-moon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />
      </svg>
    </button>
  );
}

export function ThemePreferenceControl() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemePreferenceControl requires ThemeProvider');
  return (
    <label className="theme-preference">
      Preferensi tema
      <select
        value={theme.preference}
        disabled={!theme.ready}
        onChange={(event) => theme.choose(normalize(event.target.value))}
      >
        <option value="system">Sistem</option>
        <option value="light">Terang</option>
        <option value="dark">Gelap</option>
      </select>
      <small>Tersimpan pada browser ini. Sistem mengikuti pengaturan perangkat secara otomatis.</small>
    </label>
  );
}
