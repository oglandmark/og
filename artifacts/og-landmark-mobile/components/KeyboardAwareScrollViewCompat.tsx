import React, { forwardRef } from 'react';
import { Platform, ScrollView, ScrollViewProps } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export const KeyboardAwareScrollViewCompat = forwardRef<any, Props>(
  function KeyboardAwareScrollViewCompat({
    children,
    keyboardShouldPersistTaps = 'handled',
    bottomOffset = 0,
    ...props
  }, ref) {
    if (Platform.OS === 'web') {
      return (
        <ScrollView
          ref={ref}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          {...props}
        >
          {children}
        </ScrollView>
      );
    }
    return (
      <KeyboardAwareScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        bottomOffset={bottomOffset}
        {...props}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  },
);
