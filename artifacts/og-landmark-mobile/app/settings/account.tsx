import React, { useEffect, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { getProfilePhoto, saveProfilePhoto, removeProfilePhoto } from '@/lib/profilePhotoStore';
import { updateUser, uploadProfilePhoto } from '@/lib/api';
import { useMobileContent } from '@/hooks/useMobileContent';

type Field = { key: string; label: string; icon: keyof typeof Feather.glyphMap; placeholder: string; keyboard?: 'default' | 'email-address' | 'phone-pad' };

const FIELDS: Field[] = [
  { key: 'name',       label: 'Full Name',       icon: 'user',      placeholder: 'Your full name' },
  { key: 'phone',      label: 'Mobile',           icon: 'phone',     placeholder: '03XX-XXXXXXX', keyboard: 'phone-pad' },
  { key: 'email',      label: 'Email',            icon: 'mail',      placeholder: 'email@example.com', keyboard: 'email-address' },
  { key: 'agencyName', label: 'Agency / Office',  icon: 'briefcase', placeholder: 'Agency name (optional)' },
];

export default function AccountSettingsScreen() {
  const colors = useColors();
  const content = useMobileContent();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, login } = useAuth();

  const [form, setForm] = useState({
    name:       user?.name ?? '',
    phone:      user?.phone ?? '',
    email:      user?.email ?? '',
    agencyName: user?.agencyName ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // Profile photos are server-backed and require an authenticated session.
  // Settings should still render if a guest or expired session reaches this
  // route, so treat an unavailable photo as an empty avatar instead of an
  // unhandled promise rejection.
  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setPhotoUri(null);
      return () => { active = false; };
    }

    void getProfilePhoto()
      .then((uri) => {
        if (active) setPhotoUri(uri);
      })
      .catch(() => {
        if (active) setPhotoUri(null);
      });

    return () => { active = false; };
  }, [user?.id]);

  const initials = form.name
    ? form.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'OG';

  // ── Photo picker ──────────────────────────────────────────────────────────
  const handlePhotoPress = () => {
    Alert.alert('Profile Photo', 'Choose an option:', [
      {
        text: '📷  Take Photo',
        onPress: () => void pickImage('camera'),
      },
      {
        text: '🖼  Choose from Gallery',
        onPress: () => void pickImage('gallery'),
      },
      photoUri
        ? { text: '🗑  Remove Photo', style: 'destructive' as const, onPress: () => void removePhoto() }
        : { text: 'Cancel', style: 'cancel' as const },
      ...(photoUri ? [{ text: 'Cancel', style: 'cancel' as const }] : []),
    ]);
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    if (photoLoading) return;
    setPhotoLoading(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow camera access in your device settings.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow photo library access in your device settings.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
      }
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
        // The server is authoritative. Do not display a local-only successful
        // profile photo update when the upload fails.
        const uploaded = await uploadProfilePhoto(uri);
        setPhotoUri(uploaded.url);
        await saveProfilePhoto(uploaded.url);
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update profile photo. Please try again.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const removePhoto = async () => {
    setPhotoUri(null);
    await removeProfilePhoto();
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Please enter your full name.'); return; }
    setSaving(true);
    try {
      if (user?.id) {
        const updated = await updateUser(user.id, {
          name:       form.name.trim(),
          phone:      form.phone.trim(),
          email:      form.email.trim().toLowerCase(),
          agencyName: form.agencyName.trim() || undefined,
        });
        // Persist updated user locally via login() to keep context in sync
        await login({
          ...user,
          name:       updated.name       ?? user.name,
          phone:      updated.phone      ?? user.phone,
          email:      updated.email      ?? user.email,
          agencyName: (updated.agencyName as string | undefined) ?? user.agencyName,
        });
      }
      Alert.alert('Saved', 'Your account details have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <AnimatedReveal>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              hitSlop={8}
            >
              <Feather name="arrow-left" size={18} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{content?.screens?.account?.eyebrow || 'PROFILE'}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{content?.screens?.account?.title || 'Account Settings'}</Text>
            </View>
          </View>
        </AnimatedReveal>

        {/* Avatar section */}
        <AnimatedReveal delay={60}>
          <View style={[styles.avatarSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Photo / initials */}
            <Pressable onPress={handlePhotoPress} style={styles.avatarWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarPhoto} />
              ) : (
                <View style={[styles.avatarInitials, { backgroundColor: colors.action }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              {/* Camera badge */}
              <View style={[styles.cameraBadge, { backgroundColor: colors.action, borderColor: colors.card }]}>
                <Feather name={photoLoading ? 'loader' : 'camera'} size={11} color="#ffffff" />
              </View>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={[styles.avatarName, { color: colors.foreground }]}>{form.name || 'Your Name'}</Text>
              <Text style={[styles.avatarSub, { color: colors.mutedForeground }]}>
                {user?.verificationStatus === 'verified' ? '✓ Verified Agent' :
                 user?.verificationStatus === 'pending'  ? '⏳ Verification Pending' :
                 'OG Landmark Agent'}
              </Text>
              <Pressable onPress={handlePhotoPress} style={styles.changePhotoLink}>
                <Text style={[styles.changePhotoText, { color: colors.action }]}>
                  {photoUri ? 'Change photo' : 'Add profile photo'}
                </Text>
              </Pressable>
            </View>
          </View>
        </AnimatedReveal>

        {/* Fields */}
        <AnimatedReveal delay={100}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PERSONAL INFORMATION</Text>
          <View style={[styles.fieldsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {FIELDS.map((f, i) => (
              <View key={f.key}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.action + '18' }]}>
                    <Feather name={f.icon} size={15} color={colors.action} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.foreground }]}
                      value={(form as Record<string, string>)[f.key]}
                      onChangeText={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.mutedForeground + '88'}
                      keyboardType={f.keyboard ?? 'default'}
                      autoCapitalize={f.keyboard ? 'none' : 'words'}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </AnimatedReveal>

        {/* CNIC (read-only) */}
        <AnimatedReveal delay={140}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>IDENTITY</Text>
          <View style={[styles.fieldsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.fieldRow}>
              <View style={[styles.fieldIcon, { backgroundColor: colors.accent }]}>
                <Feather name="credit-card" size={15} color={colors.accentForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CNIC Number</Text>
                <Text style={[styles.fieldInput, { color: colors.mutedForeground }]}>
                  {user?.cnic ? user.cnic : 'Not provided — contact support to update'}
                </Text>
              </View>
              <Feather name="lock" size={14} color={colors.mutedForeground} />
            </View>
          </View>
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            CNIC changes require admin verification. Contact support via Help & Support.
          </Text>
        </AnimatedReveal>

        {/* Save */}
        <AnimatedReveal delay={180}>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.action, opacity: pressed || saving ? 0.8 : 1 }]}
          >
            {saving
              ? <Text style={[styles.saveBtnText, { color: colors.actionForeground }]}>Saving…</Text>
              : <>
                  <Feather name="check" size={16} color={colors.actionForeground} />
                  <Text style={[styles.saveBtnText, { color: colors.actionForeground }]}>{content?.screens?.account?.saveLabel || 'Save Changes'}</Text>
                </>
            }
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </AnimatedReveal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 },
  avatarSection: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatarWrap: { position: 'relative' },
  avatarPhoto: { width: 64, height: 64, borderRadius: 20 },
  avatarInitials: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#ffffff' },
  cameraBadge: { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarName: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 3 },
  avatarSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 6 },
  changePhotoLink: {},
  changePhotoText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 10 },
  fieldsCard: { borderRadius: 18, borderWidth: 1, marginBottom: 22, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  fieldIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, marginBottom: 3 },
  fieldInput: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  helperText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: -14, marginBottom: 24 },
  saveBtn: { height: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
});
