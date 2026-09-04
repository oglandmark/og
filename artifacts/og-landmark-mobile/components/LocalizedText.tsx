import React, { forwardRef, useMemo } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps as NativeTextProps,
  type TextInputProps as NativeTextInputProps,
} from 'react-native';
import { useLanguage } from '@/context/LanguageContext';
import { translateText } from '@/lib/i18n';

function localizeChildren(children: React.ReactNode, lang: 'en' | 'ur'): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return translateText(lang, child);
    if (Array.isArray(child)) return localizeChildren(child, lang);
    return child;
  });
}

export const LocalizedText = forwardRef<NativeText, NativeTextProps>(function LocalizedText(
  { children, ...props },
  ref,
) {
  const { lang } = useLanguage();
  const localizedChildren = useMemo(
    () => localizeChildren(children, lang),
    [children, lang],
  );
  return <NativeText ref={ref} {...props}>{localizedChildren}</NativeText>;
});

LocalizedText.displayName = 'LocalizedText';

export const LocalizedTextInput = forwardRef<NativeTextInput, NativeTextInputProps>(
  function LocalizedTextInput({ placeholder, accessibilityLabel, ...props }, ref) {
    const { lang, isRTL } = useLanguage();
    return (
      <NativeTextInput
        ref={ref}
        {...props}
        placeholder={placeholder ? translateText(lang, placeholder) : placeholder}
        accessibilityLabel={accessibilityLabel ? translateText(lang, accessibilityLabel) : accessibilityLabel}
        textAlign={props.textAlign ?? (isRTL ? 'right' : 'left')}
      />
    );
  },
);

LocalizedTextInput.displayName = 'LocalizedTextInput';