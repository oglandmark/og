import type { ViewStyle } from 'react-native';

type GlassColors = object & Partial<Record<
  | 'primaryAction'
  | 'gold'
  | 'secondary'
  | 'border'
  | 'action'
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

/** Shared solid surface for interactive controls, using the app's semantic brand colors. */
export function glassControlStyle(
  colors: GlassColors,
  tone: GlassControlTone = 'secondary',
): ViewStyle {
  const surface = {
    gold: { backgroundColor: colors.primaryAction ?? colors.gold, borderColor: colors.primaryAction ?? colors.gold },
    secondary: { backgroundColor: colors.secondary, borderColor: colors.border },
    action: { backgroundColor: colors.action, borderColor: colors.action },
    selected: { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder },
    destructive: { backgroundColor: colors.destructive, borderColor: colors.destructive },
    success: { backgroundColor: colors.success, borderColor: colors.success },
    warning: { backgroundColor: colors.warning, borderColor: colors.warning },
  }[tone];
  return {
    ...surface,
    borderWidth: 1,
  };
}
