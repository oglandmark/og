/**
 * Developer Portal — Documents Center
 * Upload NOC, layout plans, title deeds, and other project documents.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Image, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  DeveloperDocument, DocType, DOC_TYPES, docTypeColor, newDocId,
  getDocuments, saveDocument, deleteDocument,
} from '@/lib/documentStore';
import { getDevProjects } from '@/lib/developerStore';

export default function DocumentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr } = useLanguage();
  const router  = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [docs, setDocs]         = useState<DeveloperDocument[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Form state
  const [docTitle, setDocTitle]   = useState('');
  const [docType, setDocType]     = useState<DocType>('NOC');
  const [docProject, setDocProject] = useState('');
  const [docProjectId, setDocProjectId] = useState('');
  const [docUri, setDocUri]       = useState('');
  const [docFileName, setDocFileName] = useState('');

  const reload = useCallback(() => {
    void getDocuments(user?.id ?? '').then(setDocs);
    void getDevProjects(user?.id ?? '').then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name }))));
  }, [user?.id]);

  useFocusEffect(reload);

  const resetForm = () => {
    setDocTitle(''); setDocType('NOC'); setDocProject('');
    setDocProjectId(''); setDocUri(''); setDocFileName('');
  };

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access in your device settings.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: false, mediaTypes: ['images'] });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setDocUri(asset.uri);
      setDocFileName(asset.fileName ?? asset.uri.split('/').pop() ?? 'document.jpg');
    }
  };

  const handleUpload = async () => {
    if (!docTitle.trim()) { Alert.alert('', tr('errDocTitle')); return; }
    if (!docUri)          { Alert.alert('', tr('errDocFile'));  return; }
    setSaving(true);
    const doc: DeveloperDocument = {
      id: newDocId(), developerId: user?.id ?? '',
      projectId: docProjectId, projectName: docProject,
      title: docTitle.trim(), type: docType,
      uri: docUri, fileName: docFileName,
      uploadedAt: new Date().toISOString(),
    };
    await saveDocument(doc);
    resetForm();
    setShowForm(false);
    reload();
    setSaving(false);
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, 'This will remove the document.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDocument(id); reload(); } },
    ]);
  };

  // Group docs by type
  const grouped: Partial<Record<DocType, DeveloperDocument[]>> = {};
  docs.forEach((d) => { (grouped[d.type] ??= []).push(d); });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={[dc.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ────────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[dc.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[dc.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[dc.eyebrow, { color: colors.action }]}>DEVELOPER PORTAL</Text>
              <Text style={[dc.title, { color: colors.foreground }]}>{tr('documentsTitle')}</Text>
            </View>
            <Pressable
              onPress={() => { setShowForm(!showForm); resetForm(); }}
              style={[dc.addBtn, { backgroundColor: showForm ? colors.secondary : colors.action }]}
            >
              <Feather name={showForm ? 'x' : 'upload'} size={14} color={showForm ? colors.foreground : '#ffffff'} />
              <Text style={[dc.addBtnText, { color: showForm ? colors.foreground : '#ffffff' }]}>
                {showForm ? 'Cancel' : tr('addDocumentBtn')}
              </Text>
            </Pressable>
          </View>
          <Text style={[dc.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 }]}>
            {tr('documentsSubtitle')} · {docs.length} {docs.length === 1 ? 'document' : 'documents'}
          </Text>
        </AnimatedReveal>

        {/* ── Upload form ───────────────────────────────── */}
        {showForm && (
          <AnimatedReveal delay={40}>
            <View style={[dc.formCard, { backgroundColor: colors.card, borderColor: colors.action + '44', marginHorizontal: 20, marginBottom: 20 }]}>
              <Text style={[dc.formTitle, { color: colors.foreground }]}>Upload Document</Text>

              {/* Document type */}
              <View style={dc.fWrap}>
                <Text style={[dc.fLabel, { color: colors.mutedForeground }]}>{tr('docTypeLabel')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {DOC_TYPES.map((dt) => {
                    const dtc = docTypeColor(dt);
                    return (
                      <Pressable key={dt} onPress={() => setDocType(dt)}
                        style={[dc.chip, { borderColor: docType === dt ? dtc.text : colors.border, backgroundColor: docType === dt ? dtc.bg : colors.secondary }]}>
                        <Text style={[dc.chipText, { color: docType === dt ? dtc.text : colors.mutedForeground }]}>{dt}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Title */}
              <View style={dc.fWrap}>
                <Text style={[dc.fLabel, { color: colors.mutedForeground }]}>{tr('docTitleLabel')} *</Text>
                <TextInput
                  value={docTitle} onChangeText={setDocTitle}
                  placeholder="e.g. NOC from LDA"
                  placeholderTextColor={colors.mutedForeground + '77'}
                  style={[dc.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              {/* Project select */}
              {projects.length > 0 && (
                <View style={dc.fWrap}>
                  <Text style={[dc.fLabel, { color: colors.mutedForeground }]}>{tr('docProjectLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {projects.map((p) => (
                      <Pressable key={p.id} onPress={() => { setDocProjectId(p.id); setDocProject(p.name); }}
                        style={[dc.chip, { borderColor: docProjectId === p.id ? colors.action : colors.border, backgroundColor: docProjectId === p.id ? colors.action + '15' : colors.secondary }]}>
                        <Text style={[dc.chipText, { color: docProjectId === p.id ? colors.action : colors.mutedForeground }]}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* File picker */}
              <View style={dc.fWrap}>
                <Text style={[dc.fLabel, { color: colors.mutedForeground }]}>Document File *</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => { void pickImage(false); }}
                    style={[dc.pickBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]}>
                    <Feather name="image" size={16} color={colors.mutedForeground} />
                    <Text style={[dc.pickBtnText, { color: colors.mutedForeground }]}>{tr('uploadFromGallery')}</Text>
                  </Pressable>
                  <Pressable onPress={() => { void pickImage(true); }}
                    style={[dc.pickBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]}>
                    <Feather name="camera" size={16} color={colors.mutedForeground} />
                    <Text style={[dc.pickBtnText, { color: colors.mutedForeground }]}>{tr('uploadFromCamera')}</Text>
                  </Pressable>
                </View>
                {docUri ? (
                  <View style={[dc.previewWrap, { borderColor: colors.action + '44' }]}>
                    <Image source={{ uri: docUri }} style={dc.preview} resizeMode="cover" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[dc.previewName, { color: colors.foreground }]} numberOfLines={2}>{docFileName}</Text>
                      <Text style={[dc.previewOk, { color: '#1a6b3a' }]}>✓ File selected</Text>
                    </View>
                    <Pressable onPress={() => { setDocUri(''); setDocFileName(''); }} hitSlop={8}>
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <Pressable onPress={() => { void handleUpload(); }} disabled={saving}
                style={[dc.saveBtn, { backgroundColor: colors.action }]}>
                <Feather name="upload" size={15} color="#ffffff" />
                <Text style={dc.saveBtnText}>{saving ? 'Uploading...' : 'Upload Document'}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        )}

        {/* ── Documents list ────────────────────────────── */}
        {docs.length === 0 && !showForm ? (
          <AnimatedReveal delay={60}>
            <View style={[dc.emptyWrap, { borderColor: colors.border, marginHorizontal: 20 }]}>
              <View style={[dc.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="folder" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={[dc.emptyTitle, { color: colors.foreground }]}>{tr('noDocumentsYet')}</Text>
              <Text style={[dc.emptyDesc, { color: colors.mutedForeground }]}>{tr('noDocumentsDesc')}</Text>
              <Pressable onPress={() => setShowForm(true)} style={[dc.emptyBtn, { backgroundColor: colors.action }]}>
                <Feather name="upload" size={14} color="#ffffff" />
                <Text style={dc.emptyBtnText}>{tr('addDocumentBtn')}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 20 }}>
            {(Object.entries(grouped) as [DocType, DeveloperDocument[]][]).map(([type, items]) => {
              const dtc = docTypeColor(type);
              return (
                <AnimatedReveal key={type} delay={60}>
                  <View>
                    {/* Type header */}
                    <View style={[dc.typeHeader, { marginBottom: 10 }]}>
                      <View style={[dc.typeIcon, { backgroundColor: dtc.bg }]}>
                        <Feather name={dtc.icon as React.ComponentProps<typeof Feather>['name']} size={13} color={dtc.text} />
                      </View>
                      <Text style={[dc.typeLabel, { color: dtc.text }]}>{type}</Text>
                      <View style={[dc.typeBadge, { backgroundColor: dtc.bg }]}>
                        <Text style={[dc.typeBadgeText, { color: dtc.text }]}>{items.length}</Text>
                      </View>
                    </View>

                    {/* Doc cards */}
                    <View style={{ gap: 10 }}>
                      {items.map((doc) => (
                        <View key={doc.id} style={[dc.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {/* Thumbnail */}
                          {doc.uri ? (
                            <Image source={{ uri: doc.uri }} style={[dc.thumb, { backgroundColor: colors.secondary }]} resizeMode="cover" />
                          ) : (
                            <View style={[dc.thumb, { backgroundColor: dtc.bg, alignItems: 'center', justifyContent: 'center' }]}>
                              <Feather name={dtc.icon as React.ComponentProps<typeof Feather>['name']} size={20} color={dtc.text} />
                            </View>
                          )}

                          {/* Info */}
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[dc.docTitle, { color: colors.foreground }]} numberOfLines={2}>{doc.title}</Text>
                            {doc.projectName ? (
                              <Text style={[dc.docProject, { color: colors.action }]} numberOfLines={1}>{doc.projectName}</Text>
                            ) : null}
                            <Text style={[dc.docDate, { color: colors.mutedForeground }]}>
                              {tr('docUploadedOn')} {formatDate(doc.uploadedAt)}
                            </Text>
                          </View>

                          {/* Delete */}
                          <Pressable onPress={() => handleDelete(doc.id, doc.title)} hitSlop={10} style={[dc.deleteBtn, { backgroundColor: '#dc262610' }]}>
                            <Feather name="trash-2" size={14} color="#dc2626" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                </AnimatedReveal>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const dc = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center' },
  backBtn:      { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:        { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:     { fontFamily: 'Inter_400Regular', fontSize: 12 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  formCard:     { borderWidth: 1.5, borderRadius: 18, padding: 16, gap: 14 },
  formTitle:    { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  fWrap:        { gap: 6 },
  fLabel:       { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  fInput:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  chip:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipText:     { fontFamily: 'Inter_500Medium', fontSize: 11 },
  pickBtn:      { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, justifyContent: 'center' },
  pickBtnText:  { fontFamily: 'Inter_500Medium', fontSize: 12 },
  previewWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  preview:      { width: 56, height: 56, borderRadius: 10 },
  previewName:  { fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 4, lineHeight: 16 },
  previewOk:    { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  saveBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  emptyWrap:    { borderWidth: 1, borderRadius: 18, padding: 36, alignItems: 'center', gap: 12, borderStyle: 'dashed' },
  emptyIcon:    { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontFamily: 'Inter_700Bold', fontSize: 17 },
  emptyDesc:    { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  typeHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeIcon:     { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  typeLabel:    { fontFamily: 'Inter_700Bold', fontSize: 12, flex: 1 },
  typeBadge:    { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText:{ fontFamily: 'Inter_700Bold', fontSize: 10 },
  docCard:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12 },
  thumb:        { width: 56, height: 56, borderRadius: 10 },
  docTitle:     { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 3, lineHeight: 18 },
  docProject:   { fontFamily: 'Inter_500Medium', fontSize: 10, marginBottom: 3 },
  docDate:      { fontFamily: 'Inter_400Regular', fontSize: 10 },
  deleteBtn:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
