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
    background: '#f8f6f1',
    foreground: '#1c2024',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#1c2024',
    glassCard: '#fffffff0',
    glassBorder: '#ffffffb8',
    glassOverlay: '#ffffff80',

    // Primary action color (buttons, links, active states)
    primary: '#c8a45a',
    primaryForeground: '#1c2024',

    // Official OG Landmark navy for interactive controls and CTAs
    action: '#102a43',
    actionDeep: '#081e34',
    actionSoft: '#244d6b',
    actionForeground: '#ffffff',
    actionPressed: '#0b1f33',
    // Premium glass control tokens
    gold: '#d9b96d',
    goldForeground: '#1c2024',
    goldGlass: '#d9b96db8',
    goldGlassBorder: '#f5dfa0',
    actionGlass: '#173d5ed9',
    actionGlassStrong: '#081e34e8',
    actionGlassSoft: '#6d9bb52e',
    actionGlassBorder: '#ffffff55',
    actionGlassHighlight: '#ffffff24',
    actionGlow: '#9bc6df',

    // Premium selected-state treatment for category/filter/tab/chip controls
    selectionBackground: '#fbfcfd',
    selectionTint: '#f3f7fa',
    selectionBorder: '#102F49',
    selectionForeground: '#102F49',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#ebe6da',
    secondaryForeground: '#1c2024',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#eeeae1',
    mutedForeground: '#72746f',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f1e6c9',
    accentForeground: '#6f531d',

    // Destructive actions (delete, error states)
    destructive: '#b94b42',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#ded9cf',
    input: '#ded9cf',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
