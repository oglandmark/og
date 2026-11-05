import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import brandColors from '@/constants/colors';
import { getAgentAdminThreads, sendAgentAdminMessage, type AgentAdminThread } from '@/lib/api';

export function AgentAdminInbox({ admin = false }: { admin?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [threads, setThreads] = useState<AgentAdminThread[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await getAgentAdminThreads();
      setThreads(result);
      if (!selectedId && admin && result.length) setSelectedId(result[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [admin, selectedId]);
  useEffect(() => { void load(); }, [load]);

  const active = useMemo(
    () => admin ? threads.find((thread) => thread.id === selectedId) ?? null : threads[0] ?? null,
    [admin, selectedId, threads],
  );

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const updated = await sendAgentAdminMessage(text.trim(), admin ? active?.id : undefined);
      setThreads((current) => {
        const rest = current.filter((thread) => thread.id !== updated.id);
        return admin ? [updated, ...rest] : [updated];
      });
      setSelectedId(updated.id);
      setText('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.header, { backgroundColor: colors.action, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 14 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.backButton}><Feather name="arrow-left" size={19} color="#fff" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>{admin ? 'ADMIN SUPPORT' : 'AGENT PORTAL'}</Text>
            <Text style={s.title}>{admin ? 'Agent messages' : 'Message Admin'}</Text>
          </View>
          <Pressable onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Refresh messages" style={s.backButton}><Feather name="refresh-cw" size={17} color="#fff" /></Pressable>
        </View>
        <Text style={s.subtitle}>{admin ? 'Reply to Agents and keep the conversation in one place.' : 'Contact the OG Landmark Admin team. Replies will appear here.'}</Text>
      </View>
      {admin && (
        <ScrollView horizontal style={[s.threadStrip, { borderBottomColor: colors.border }]} contentContainerStyle={s.threadStripContent}>
          {threads.map((thread) => (
            <Pressable key={thread.id} onPress={() => setSelectedId(thread.id)} style={[s.threadChip, { backgroundColor: thread.id === selectedId ? colors.action : colors.card, borderColor: colors.border }]}>
              <Text style={{ color: thread.id === selectedId ? '#fff' : colors.foreground, fontWeight: '700' }}>{thread.agentName}</Text>
              <Text numberOfLines={1} style={{ color: thread.id === selectedId ? '#ffffffcc' : colors.mutedForeground, fontSize: 11, marginTop: 3 }}>{thread.lastMessage || thread.agentEmail}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {active ? <Text style={[s.agentLabel, { color: colors.mutedForeground }]}>{admin ? `${active.agentName} · ${active.agentEmail}` : `Signed in as ${user?.name ?? 'Agent'}`}</Text> : null}
      <ScrollView style={s.messages} contentContainerStyle={s.messageList}>
        {loading ? <ActivityIndicator color={colors.action} /> : !active ? (
          <View style={s.empty}><Feather name="message-circle" size={26} color={colors.action} /><Text style={{ color: colors.foreground, fontWeight: '700', marginTop: 10 }}>Start a message to Admin</Text><Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 5 }}>Send a question or update; the Admin team will reply in this thread.</Text></View>
        ) : active.messages.map((message) => {
          const mine = String(message.senderId) === String(user?.id);
          return (
            <View key={message.id} style={[s.bubble, { alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? colors.action : colors.card, borderColor: colors.border }]}>
              <Text style={{ color: mine ? '#fff' : colors.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{mine ? 'You' : message.senderName}</Text>
              <Text style={{ color: mine ? '#fff' : colors.foreground, lineHeight: 21 }}>{message.text}</Text>
              <Text style={{ color: mine ? '#ffffffbb' : colors.mutedForeground, fontSize: 10, textAlign: 'right', marginTop: 6 }}>{new Date(message.createdAt).toLocaleString()}</Text>
            </View>
          );
        })}
      </ScrollView>
      {!!error && <Text style={[s.error, { color: colors.destructive }]}>{error}</Text>}
      <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: insets.bottom + 10 }]}>
        <TextInput value={text} onChangeText={setText} multiline maxLength={4000} placeholder="Write a message…" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!text.trim() || sending || (admin && !active)} onPress={() => void send()} style={[s.send, { backgroundColor: colors.action, opacity: !text.trim() || sending || (admin && !active) ? 0.5 : 1 }]}>
          <Feather name="send" size={17} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: brandColors.light.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#ffffffcc', fontSize: 13, lineHeight: 19, marginTop: 5 },
  threadStrip: { maxHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth },
  threadStripContent: { padding: 10, gap: 8 },
  threadChip: { borderWidth: 1, borderRadius: 12, padding: 10, width: 190 },
  agentLabel: { paddingHorizontal: 16, paddingTop: 12, fontSize: 12 },
  messages: { flex: 1 },
  messageList: { padding: 16, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bubble: { maxWidth: '86%', borderWidth: 1, borderRadius: 16, padding: 12 },
  error: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  send: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
