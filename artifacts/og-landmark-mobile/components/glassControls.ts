import type { ViewStyle } from 'react-native';

type GlassColors = object & Partial<Record<
  | 'goldGlass'
  | 'goldGlassBorder'
  | 'glassOverlay'
  | 'glassBorder'
  | 'actionGlass'
  | 'actionGlassBorder'
  | 'actionGlassHighlight'
  | 'actionGlassSoft'
  | 'selectionBackground'
  | 'selectionBorder'
  | 'destructive'
  | 'destructiveForeground'
  | 'success'
  | 'successForeground'
  | 'warning'
  | 'warningForeground'
  | 'shadow',
  string
>>;

export type GlassControlTone = 'gold' | 'secondary' | 'action' | 'selected' | 'destructive' | 'success' | 'warning';

/** Shared restrained glass surface for interactive controls (not cards or content surfaces). */
export function glassControlStyle(
  colors: GlassColors,
  tone: GlassControlTone = 'secondary',
): ViewStyle {
  const surface = {
    gold: { backgroundColor: colors.goldGlass, borderColor: colors.goldGlassBorder, shadowColor: colors.shadow },
    secondary: { backgroundColor: colors.glassOverlay, borderColor: colors.glassBorder, shadowColor: colors.shadow },
    action: { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder, shadowColor: colors.shadow },
    selected: { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, shadowColor: colors.shadow },
    destructive: { backgroundColor: colors.destructive, borderColor: colors.destructiveForeground, shadowColor: colors.shadow },
    success: { backgroundColor: colors.success, borderColor: colors.successForeground, shadowColor: colors.shadow },
    warning: { backgroundColor: colors.warning, borderColor: colors.warningForeground, shadowColor: colors.shadow },
  }[tone];
  return {
    ...surface,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: tone === 'secondary' ? 0.08 : 0.16,
    shadowRadius: 7,
    elevation: 2,
  };
}

/** Thin top sheen used inside button surfaces; keep it pointer-transparent. */
export function glassHighlightStyle(colors: GlassColors): ViewStyle {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: colors.actionGlassHighlight,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  };
}
