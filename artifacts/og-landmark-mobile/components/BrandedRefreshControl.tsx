import React from 'react';
import { Platform, RefreshControl, type RefreshControlProps } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = Pick<RefreshControlProps, 'refreshing' | 'onRefresh'> & {
  label?: string;
};

export function BrandedRefreshControl({ refreshing, onRefresh, label = 'OG Landmark' }: Props) {
  const colors = useColors();

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.teal}
      title={Platform.OS === 'ios' ? label : undefined}
      titleColor={colors.mutedForeground}
      colors={[colors.teal, colors.gold, colors.action]}
      progressBackgroundColor={colors.card}
    />
  );
}
