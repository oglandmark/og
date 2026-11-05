/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0B1F3A',
    tint: '#19C3B1',

    // Core surfaces
    background: '#FFFFFF',
    foreground: '#0B1F3A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#0B1F3A',
    glassCard: '#FFFFFFF2',
    glassBorder: '#E1E8EE',
    glassOverlay: '#FFFFFF80',
    mapGlass: 'rgba(255, 255, 255, 0.88)',
    mapGlassBorder: 'rgba(255, 255, 255, 0.94)',
    mapGlassPanel: 'rgba(255, 255, 255, 0.78)',
    mapGlassPanelBorder: 'rgba(255, 255, 255, 0.96)',

    // Primary action color (buttons, links, active states)
    primary: '#0B1F3A',
    primaryForeground: '#FFFFFF',

    // Official OG Landmark navy for interactive controls and CTAs
    action: '#0B1F3A',
    actionDeep: '#071428',
    actionSoft: '#183B60',
    actionForeground: '#FFFFFF',
    actionPressed: '#082036',
    // Premium glass control tokens
    gold: '#F2B84B',
    goldForeground: '#0B1F3A',
    goldGlass: '#F2B84BB8',
    goldGlassBorder: '#F7D58C',
    teal: '#19C3B1',
    tealForeground: '#0B1F3A',
    tealSoft: '#E6F8F5',
    actionGlass: '#0B1F3AD9',
    actionGlassStrong: '#071428E8',
    actionGlassSoft: '#6A8DAF2E',
    actionGlassBorder: '#ffffff55',
    actionGlassHighlight: '#ffffff24',
    actionGlow: '#9AAFC2',
    // Palette supplied with the updated OG Landmark animated splash.
    splashBackground: '#0B1F3A',
    splashNavy: '#0B1F3A',
    splashGlow: '#124B5A',
    splashTeal: '#19C3B1',
    splashMint: '#7FE0D4',
    splashGold: '#F2B84B',
    splashWhite: '#FFFFFF',
    splashMuted: '#9FB3CC',

    // Editorial surfaces used for quiet hierarchy and premium depth
    surfaceRaised: '#FFFFFF',
    surfaceTint: '#F3F6F8',
    surfaceDeep: '#0B1F3A',
    shadow: '#071428',
    focusRing: '#19C3B1',

    // Premium selected-state treatment for category/filter/tab/chip controls
    selectionBackground: '#EAF9F7',
    selectionTint: '#D9F4F0',
    selectionBorder: '#19C3B1',
    selectionForeground: '#0B1F3A',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#F3F6F8',
    secondaryForeground: '#0B1F3A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EEF2F5',
    mutedForeground: '#5B6875',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#E6F8F5',
    accentForeground: '#0B1F3A',

    // Destructive actions (delete, error states)
    destructive: '#b94b42',
    destructiveForeground: '#ffffff',
    success: '#0F766E',
    successForeground: '#ffffff',
    warning: '#b9822b',
    warningForeground: '#ffffff',

    // Borders and input outlines
    border: '#E1E8EE',
    input: '#CBD5DF',
  },

  // Shared layout tokens. Keeping these beside the semantic palette prevents
  // screen-level style drift as new mobile flows are added.
  radius: 16,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  typography: {
    caption: 11,
    label: 12,
    body: 14,
    bodyLarge: 16,
    screenTitle: 22,
    display: 32,
  },
  controlHeight: 48,
};

export default colors;
