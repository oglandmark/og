import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useColors } from '@/hooks/useColors';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  variant?: ButtonVariant;
  icon?: React.ComponentProps<typeof Feather>['name'];
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  children,
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  style,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const colors = useColors();
  const palette = {
    primary: { backgroundColor: colors.action, borderColor: colors.action, color: colors.actionForeground },
    secondary: { backgroundColor: colors.card, borderColor: colors.border, color: colors.action },
    quiet: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.action },
    destructive: { backgroundColor: colors.destructive, borderColor: colors.destructive, color: colors.destructiveForeground },
  }[variant];

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.button,
        { borderRadius: colors.radii.md },
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor, opacity: disabled ? 0.52 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.color} />
      ) : (
        <>
          {icon && <Feather name={icon} size={16} color={palette.color} />}
          <Text style={[styles.buttonText, { color: palette.color }]}>{children}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

export function StatusNotice({
  icon = 'info',
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error' | 'success';
}) {
  const colors = useColors();
  const toneColor = tone === 'error' ? colors.destructive : tone === 'success' ? colors.action : colors.mutedForeground;
  return (
      <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radii.lg }]}>
      <View style={[styles.noticeIcon, { backgroundColor: `${toneColor}18` }]}>
        <Feather name={icon} size={17} color={toneColor} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeTitle, { color: colors.foreground }]}>{title}</Text>
        {!!message && <Text style={[styles.noticeMessage, { color: colors.mutedForeground }]}>{message}</Text>}
        {!!actionLabel && !!onAction && (
          <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={6}>
            <Text style={[styles.noticeAction, { color: colors.action }]}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function EmptyState({
  icon = 'home',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radii.lg }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={24} color={colors.action} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.mutedForeground }]}>{message}</Text>
      {!!actionLabel && !!onAction && <Button variant="secondary" icon="arrow-right" onPress={onAction}>{actionLabel}</Button>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, letterSpacing: 0.15 },
  notice: {
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 3 },
  noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: 0.05 },
  noticeMessage: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  noticeAction: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  empty: {
    marginHorizontal: 20,
    padding: 26,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, textAlign: 'center' },
  emptyMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 292, marginBottom: 5 },
});