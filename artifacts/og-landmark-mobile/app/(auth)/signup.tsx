import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Button } from '@/components/PolishedUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { registerAPI } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    if (!name.trim()) return setError('Enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Enter a valid email address.');
    if (normalizedPhone.replace(/\D/g, '').length < 10) return setError('Enter a valid phone number.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('Password must be at least 8 characters and include a letter and number.');
    }

    setError('');
    setLoading(true);
    const result = await registerAPI({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      role: 'buyer',
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Registration failed. Please try again.');
      return;
    }
    if (result.pendingApproval) {
      Alert.alert('Account submitted', result.pendingMessage ?? 'Your account is awaiting approval.', [
        { text: 'Continue', onPress: () => router.replace('/(tabs)') },
      ]);
      return;
    }
    router.replace('/(tabs)');
  };

  const fieldStyle = [styles.input, { color: colors.foreground, borderBottomColor: colors.border }];
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12, paddingBottom: insets.bottom + 34 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Feather name="chevron-left" size={26} color={colors.action} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Register</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.form}>
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Create a buyer account to continue posting your ad.
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" style={fieldStyle} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Email address</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" style={fieldStyle} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Phone</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="03xx xxxxxxx" keyboardType="phone-pad" style={fieldStyle} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" style={fieldStyle} />
          {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
          <Button onPress={() => { void submit(); }} loading={loading} style={styles.submit}>
            Register
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  form: { paddingHorizontal: 24, gap: 12 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  label: { fontSize: 12, marginTop: 8 },
  input: { fontSize: 15, borderBottomWidth: 1, paddingVertical: 12 },
  error: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  submit: { marginTop: 16 },
});
