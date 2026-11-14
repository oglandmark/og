import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const signup = readFileSync(
  new URL('../app/(auth)/signup.tsx', import.meta.url),
  'utf8',
);

test('signup OTP screen keeps six-digit autofill and existing verification navigation', () => {
  assert.ok(signup.includes("value.replace(/\\D/g, '').slice(0, 6)"));
  assert.ok(signup.includes('autoComplete="one-time-code"'));
  assert.ok(signup.includes('textContentType="oneTimeCode"'));
  assert.ok(signup.includes("if (!/^\\d{6}$/.test(codeToVerify))"));
  assert.ok(signup.includes('verifySignupEmail(verificationEmail, codeToVerify)'));
  assert.ok(signup.includes("router.replace('/(tabs)')"));
});

test('signup verifies automatically after six digits and prevents duplicate requests', () => {
  assert.match(signup, /if \(normalizedCode\.length === 6\) void handleVerifyEmail\(normalizedCode\)/);
  assert.match(signup, /if \(verifyingOtpRef\.current\) return/);
  assert.match(signup, /verifyingOtpRef\.current = true/);
  assert.match(signup, /editable=\{!loading\}/);
  assert.match(signup, /label="Verify email"/);
});

test('resending an OTP reports success separately from errors and preserves resend request', () => {
  assert.ok(signup.includes('resendSignupEmail(verificationEmail)'));
  assert.ok(signup.includes("setVerificationNotice('A new code has been sent.')"));
  assert.ok(signup.includes("setError(result.error ?? 'Unable to resend the code.')"));
  assert.ok(signup.includes('disabled={loading || resending}'));
});

test('OTP screen keeps the destination, expiry, and accessible live feedback visible', () => {
  assert.ok(signup.includes('CODE SENT TO'));
  assert.ok(signup.includes('{verificationEmail}'));
  assert.ok(signup.includes('The code expires in 10 minutes.'));
  assert.ok(signup.includes('accessibilityLabel="Six-digit email verification code"'));
  assert.ok(signup.includes('accessibilityLiveRegion="polite"'));
});
