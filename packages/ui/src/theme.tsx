'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Icon } from './icon';
import { Overlay } from './overlay';
import { Select } from './fields';
import { ConfirmationProvider } from './confirm';

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
    <ThemeContext.Provider value={{ preference, resolved, ready, choose }}>
      <ConfirmationProvider>{children}</ConfirmationProvider>
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const theme = useContext(ThemeContext)!;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const choose = (value: ThemePreference) => {
    setOpen(false);
    const r = anchor.current?.getBoundingClientRect(),
      x = (r?.left || 0) + (r?.width || 0) / 2,
      y = (r?.top || 0) + (r?.height || 0) / 2;
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const transition = document.startViewTransition(() => flushSync(() => theme.choose(value)));
      void transition.ready
        .then(() =>
          document.documentElement.animate(
            {
              clipPath: [
                'circle(0px at ' + x + 'px ' + y + 'px)',
                'circle(' + Math.hypot(innerWidth, innerHeight) + 'px at ' + x + 'px ' + y + 'px)',
              ],
            },
            {
              duration: 400,
              easing: 'cubic-bezier(.16,1,.3,1)',
              pseudoElement: '::view-transition-new(root)',
            },
          ),
        )
        .catch(() => {});
    } else theme.choose(value);
  };
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="theme-toggle icon-button"
        aria-label="Tema"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Tema: ${theme.preference}`}
        disabled={!theme.ready}
        onClick={() => setOpen(true)}
      >
        <Icon name={theme.preference === 'system' ? 'monitor' : theme.resolved === 'dark' ? 'moon' : 'sun'} />
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title="Tema" kind="menu" anchor={anchor} hideTitle>
        <div className="menu-list" role="group" aria-label="Pilih tema">
          {(['light', 'dark', 'system'] as const).map((value, i) => (
            <button
              type="button"
              className="menu-item"
              key={value}
              aria-pressed={theme.preference === value}
              onClick={() => choose(value)}
            >
              <Icon name={value === 'system' ? 'monitor' : value === 'dark' ? 'moon' : 'sun'} />
              <span>{['Terang', 'Gelap', 'Sistem'][i]}</span>
              {theme.preference === value && <Icon name="check" />}
            </button>
          ))}
        </div>
      </Overlay>
    </>
  );
}

export function ThemePreferenceControl() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemePreferenceControl requires ThemeProvider');
  return (
    <label className="theme-preference">
      Preferensi tema
      <Select
        aria-label="Preferensi tema"
        value={theme.preference}
        disabled={!theme.ready}
        onChange={(event) => theme.choose(normalize(event.target.value))}
      >
        <option value="system">Sistem</option>
        <option value="light">Terang</option>
        <option value="dark">Gelap</option>
      </Select>
      <small>Tersimpan pada browser ini. Sistem mengikuti pengaturan perangkat secara otomatis.</small>
    </label>
  );
}
