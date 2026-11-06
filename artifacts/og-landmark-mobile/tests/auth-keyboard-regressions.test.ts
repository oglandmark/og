import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const frame = readFileSync(new URL('../components/AuthScreenUI.tsx', import.meta.url), 'utf8');
const keyboardScroll = readFileSync(
  new URL('../components/KeyboardAwareScrollViewCompat.tsx', import.meta.url),
  'utf8',
);
const login = readFileSync(new URL('../app/(auth)/login.tsx', import.meta.url), 'utf8');
const signup = readFileSync(new URL('../app/(auth)/signup.tsx', import.meta.url), 'utf8');

test('auth forms keep focused fields accessible while the keyboard is open', () => {
  assert.match(frame, /KeyboardAwareScrollViewCompat/);
  assert.match(frame, /bottomOffset=\{Platform\.OS === 'android' \? 32 : 24\}/);
  assert.match(frame, /keyboardShouldPersistTaps="handled"/);
  assert.match(frame, /paddingBottom: Math\.max\(bottomInset, Platform\.OS === 'android' \? 24 : 16\) \+ 24/);
  assert.doesNotMatch(frame, /KeyboardAvoidingView/);
  assert.match(keyboardScroll, /bottomOffset = 0/);
  assert.match(keyboardScroll, /bottomOffset=\{bottomOffset\}/);
});

test('login and register text input rows are exactly 47 pixels high', () => {
  assert.match(login, /inputField: \{ height: 47,/);
  assert.match(signup, /inputField: \{ height: 47,/);
});
