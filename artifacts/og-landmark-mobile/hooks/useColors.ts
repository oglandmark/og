import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';
import { getMobileSettings } from '@/lib/api';

let remoteTheme: Record<string, string> = {};
let remoteThemePromise: Promise<void> | null = null;

function sanitizeRemoteTheme(theme: unknown): Record<string, string> {
  if (!theme || typeof theme !== 'object') return {};
  const allowed = new Set(Object.keys(colors.light));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    if (!allowed.has(key) || typeof value !== 'string') continue;
    // Theme values are CSS-style color strings. Reject arbitrary values so an
    // admin content edit cannot inject invalid styles into native components.
    if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i.test(value.trim())) {
      result[key] = value.trim();
    }
  }
  return result;
}

function loadRemoteTheme() {
  if (!remoteThemePromise) {
    remoteThemePromise = getMobileSettings()
      .then((settings) => {
        remoteTheme = sanitizeRemoteTheme(settings.content?.global?.theme);
      })
      .catch(() => undefined)
      .then(() => undefined);
  }
  return remoteThemePromise;
}

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 * When a sibling web artifact's dark tokens are synced into a `dark`
 * key, this hook will automatically switch palettes based on the
 * device's appearance setting.
 */
export function useColors() {
  const scheme = useColorScheme();
  const [, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    void loadRemoteTheme().then(() => {
      if (active) refresh((value) => value + 1);
    });
    return () => { active = false; };
  }, []);
  const palette =
    scheme === 'dark' && 'dark' in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, ...remoteTheme, radius: colors.radius };
}
