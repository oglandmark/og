/**
 * OpeningSplash — kept as a compatibility component for older route layouts.
 *
 * App startup is intentionally immediate. The native splash screen is managed
 * by Expo, so this component must not add a second delayed animated overlay.
 */
import React, { useEffect } from 'react';

export function OpeningSplash({ onFinished }: { onFinished?: () => void }) {
  useEffect(() => {
    onFinished?.();
  }, [onFinished]);

  return null;
}