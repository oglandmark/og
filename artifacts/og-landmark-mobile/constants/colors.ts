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
    text: '#1c2024',
    tint: '#c8a45a',

    // Core surfaces
    background: '#f8fafc',
    foreground: '#1c2024',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#1c2024',
    glassCard: '#fffffff2',
    glassBorder: '#e4e9ef',
    glassOverlay: '#ffffff80',
    mapGlass: 'rgba(255, 255, 255, 0.78)',
    mapGlassBorder: 'rgba(255, 255, 255, 0.88)',
    mapGlassPanel: 'rgba(255, 255, 255, 0.68)',
    mapGlassPanelBorder: 'rgba(255, 255, 255, 0.94)',

    // Primary action color (buttons, links, active states)
    primary: '#c7a263',
    primaryForeground: '#1c2024',

    // Official OG Landmark navy for interactive controls and CTAs
    action: '#0B1F3A',
    actionDeep: '#071428',
    actionSoft: '#183B60',
    actionForeground: '#ffffff',
    actionPressed: '#082036',
    // Premium glass control tokens
    gold: '#d8b36a',
    goldForeground: '#1c2024',
    goldGlass: '#d9b96db8',
    goldGlassBorder: '#e8c985',
    actionGlass: '#0B1F3AD9',
    actionGlassStrong: '#071428E8',
    actionGlassSoft: '#6A8DAF2E',
    actionGlassBorder: '#ffffff55',
    actionGlassHighlight: '#ffffff24',
    actionGlow: '#86A7C5',

    // Editorial surfaces used for quiet hierarchy and premium depth
    surfaceRaised: '#ffffff',
    surfaceTint: '#f1f4f7',
    surfaceDeep: '#0B1F3A',
    shadow: '#071428',
    focusRing: '#b98d45',

    // Premium selected-state treatment for category/filter/tab/chip controls
    selectionBackground: '#fbfcfd',
    selectionTint: '#f3f7fa',
    selectionBorder: '#0B1F3A',
    selectionForeground: '#0B1F3A',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#eef2f5',
    secondaryForeground: '#1c2024',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#edf1f4',
    mutedForeground: '#72746f',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f1e6c9',
    accentForeground: '#6f531d',

    // Destructive actions (delete, error states)
    destructive: '#b94b42',
    destructiveForeground: '#ffffff',
    success: '#2d7a57',
    successForeground: '#ffffff',
    warning: '#b9822b',
    warningForeground: '#ffffff',

    // Borders and input outlines
    border: '#dfe5eb',
    input: '#dfe5eb',
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
