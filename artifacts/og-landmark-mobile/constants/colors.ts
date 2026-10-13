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
    text: '#15243A',
    tint: '#B9914D',

    // Core surfaces
    background: '#F5F4F0',
    foreground: '#15243A',

    // Cards / elevated surfaces
    card: '#FFFEFB',
    cardForeground: '#15243A',
    glassCard: '#FFFEFBF2',
    glassBorder: '#E5E1D8',
    glassOverlay: '#FFFEFB80',
    mapGlass: 'rgba(255, 254, 251, 0.88)',
    mapGlassBorder: 'rgba(255, 254, 251, 0.94)',
    mapGlassPanel: 'rgba(255, 254, 251, 0.78)',
    mapGlassPanelBorder: 'rgba(255, 254, 251, 0.96)',

    // Primary action color (buttons, links, active states)
    primary: '#B9914D',
    primaryForeground: '#15243A',

    // Official OG Landmark navy for interactive controls and CTAs
    action: '#0B1F3A',
    actionDeep: '#071428',
    actionSoft: '#183B60',
    actionForeground: '#ffffff',
    actionPressed: '#082036',
    // Premium glass control tokens
    gold: '#C6A15D',
    goldForeground: '#15243A',
    goldGlass: '#C6A15DB8',
    goldGlassBorder: '#DDC58F',
    actionGlass: '#0B1F3AD9',
    actionGlassStrong: '#071428E8',
    actionGlassSoft: '#6A8DAF2E',
    actionGlassBorder: '#ffffff55',
    actionGlassHighlight: '#ffffff24',
    actionGlow: '#9AAFC2',

    // Editorial surfaces used for quiet hierarchy and premium depth
    surfaceRaised: '#FFFEFB',
    surfaceTint: '#EFEEE9',
    surfaceDeep: '#0B1F3A',
    shadow: '#071428',
    focusRing: '#b98d45',

    // Premium selected-state treatment for category/filter/tab/chip controls
    selectionBackground: '#F8F6F0',
    selectionTint: '#EDEAE1',
    selectionBorder: '#0B1F3A',
    selectionForeground: '#0B1F3A',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EFEEE9',
    secondaryForeground: '#15243A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EAE8E1',
    mutedForeground: '#6E7782',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F0E6CE',
    accentForeground: '#70572E',

    // Destructive actions (delete, error states)
    destructive: '#b94b42',
    destructiveForeground: '#ffffff',
    success: '#33745A',
    successForeground: '#ffffff',
    warning: '#b9822b',
    warningForeground: '#ffffff',

    // Borders and input outlines
    border: '#E3DFD6',
    input: '#D9D5CC',
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
