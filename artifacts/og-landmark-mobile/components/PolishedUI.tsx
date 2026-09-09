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
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor, opacity: disabled ? 0.55 : 1 },
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
    <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
    <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.selectionTint }]}>
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
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  notice: {
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 3 },
  noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  noticeMessage: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  noticeAction: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  empty: {
    marginHorizontal: 16,
    padding: 24,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    gap: 9,
  },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center' },
  emptyMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 280, marginBottom: 4 },
});