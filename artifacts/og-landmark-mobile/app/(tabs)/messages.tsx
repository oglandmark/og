import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { BrandMark } from '@/components/BrandMark';
import { AnimatedReveal } from '@/components/AnimatedReveal';

type Message = { id: number; text: string; fromMe: boolean; time: string };
type Conversation = {
  id: number;
  name: string;
  phone: string;
  preview: string;
  time: string;
  unread: number;
  messages: Message[];
};

const conversations: Conversation[] = [
  {
    id: 1, name: 'Muhammad Imran', phone: '+923011234567', preview: 'Is the 5 Marla house still available?', time: '10:32 AM', unread: 2,
    messages: [
      { id: 1, text: 'Assalam o Alaikum, I saw your listing for 5 Marla House.', fromMe: false, time: '10:28 AM' },
      { id: 2, text: 'Is the 5 Marla house still available?', fromMe: false, time: '10:30 AM' },
      { id: 3, text: 'Walaikum Assalam! Yes it is available. Are you interested?', fromMe: true, time: '10:32 AM' },
    ],
  },
  {
    id: 2, name: 'Asif Raza', phone: '+923021234567', preview: 'Can we negotiate the price?', time: 'Yesterday', unread: 0,
    messages: [
      { id: 1, text: 'I am interested in the 8 Kanal agricultural land.', fromMe: false, time: 'Yesterday, 3:10 PM' },
      { id: 2, text: 'Sure, please tell me more about your requirements.', fromMe: true, time: 'Yesterday, 3:15 PM' },
      { id: 3, text: 'Can we negotiate the price?', fromMe: false, time: 'Yesterday, 3:22 PM' },
    ],
  },
  {
    id: 3, name: 'Zahid Hussain', phone: '+923031234567', preview: 'Ok thank you, I will call tomorrow.', time: 'Mon', unread: 0,
    messages: [
      { id: 1, text: 'Wanted to ask about the Renala Khurd shop.', fromMe: false, time: 'Mon, 11:00 AM' },
      { id: 2, text: 'Ok thank you, I will call tomorrow.', fromMe: false, time: 'Mon, 11:05 AM' },
    ],
  },
];

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tr, isRTL } = useLanguage();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [keyboardShowing, setKeyboardShowing] = useState(false);
  const listRef = useRef<FlatList>(null);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 96 : 0);
  const rtl = isRTL ? 'right' as const : 'left' as const;

  // Track keyboard visibility so inputRow padding is correct in both states:
  // closed → must clear the absolute tab bar (78px); open → keyboard is above tab bar, just safe area.
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardShowing(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardShowing(false),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const TAB_H = Platform.OS === 'web' ? 84 : 78;
  // When keyboard is hidden: push inputRow above the absolute tab bar.
  // When keyboard is showing: keyboard sits above tab bar; only safe area needed.
  const inputRowPadBottom = Platform.OS === 'web'
    ? botPad + 8
    : keyboardShowing ? insets.bottom + 6 : TAB_H + 10;
  // FlatList content only needs a small gap at the bottom — it scrolls independently above inputRow.
  const listPadBottom = 16;

  const openConversation = (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([...conv.messages]);
  };

  const handleNewConversation = () => {
    Alert.alert(
      'New Conversation',
      'Select a contact to start chatting:',
      [
        ...conversations.map((c) => ({
          text: c.name,
          onPress: () => openConversation(c),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const msg: Message = { id: Date.now(), text: inputText.trim(), fromMe: true, time: 'Now' };
    setMessages((prev) => [...prev, msg]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (activeConv) {
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.chatHeader, { paddingTop: topPad + 12, paddingBottom: 14, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setActiveConv(null)} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={21} color={colors.foreground} />
          </Pressable>
          <View style={[styles.chatAvatar, { backgroundColor: colors.action }]}>
            <Text style={styles.chatAvatarText}>{activeConv.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatName, { color: colors.foreground, textAlign: rtl }]}>{activeConv.name}</Text>
            <Text style={[styles.chatStatus, { color: '#059669' }]}>{tr('onlineStatus')}</Text>
          </View>
          <Pressable
            style={[styles.headerAction, { backgroundColor: colors.secondary }]}
            onPress={() => {
              if (activeConv.phone) {
                Linking.openURL(`tel:${activeConv.phone}`);
              } else {
                Alert.alert('No Number', 'No phone number available for this contact.');
              }
            }}
            hitSlop={8}
          >
            <Feather name="phone" size={17} color={colors.action} />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          style={{ flex: 1 }}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: listPadBottom }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => (
            <View style={[styles.msgRow, m.fromMe ? styles.msgRowMe : styles.msgRowThem]}>
              {!m.fromMe && (
                <View style={[styles.msgAvatar, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.msgAvatarText, { color: colors.action }]}>{activeConv.name[0]}</Text>
                </View>
              )}
              <View style={[styles.bubble, m.fromMe ? { backgroundColor: colors.action } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.bubbleText, { color: m.fromMe ? colors.actionForeground : colors.foreground }]}>{m.text}</Text>
                <Text style={[styles.bubbleTime, { color: m.fromMe ? colors.actionForeground + 'aa' : colors.mutedForeground }]}>{m.time}</Text>
              </View>
            </View>
          )}
        />

        <View style={[styles.inputRow, { paddingBottom: inputRowPadBottom, borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput value={inputText} onChangeText={setInputText} placeholder={tr('messagePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            textAlign={rtl}
            style={[styles.msgInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            onSubmitEditing={sendMessage} returnKeyType="send" />
          <Pressable onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: colors.action, opacity: inputText.trim() ? 1 : 0.5 }]}>
            <Feather name={isRTL ? 'arrow-left' : 'send'} size={17} color={colors.actionForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 96 }}>
        <AnimatedReveal>
          <View style={[styles.listHeader, { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 8 }]}>
            <BrandMark />
            <Pressable
              onPress={handleNewConversation}
              style={({ pressed }) => [styles.headerAction, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="edit" size={17} color={colors.action} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 16, marginBottom: 22 }}>
            <Text style={[styles.title, { color: colors.foreground, textAlign: rtl }]}>{tr('messagesTitle')}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl }]}>{tr('messagesSubtitle')}</Text>
          </View>
        </AnimatedReveal>

        {conversations.map((conv, i) => (
          <AnimatedReveal key={conv.id} delay={80 + i * 55}>
            <Pressable onPress={() => openConversation(conv)}
              style={({ pressed }) => [styles.convItem, { borderBottomColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
              <View style={[styles.convAvatar, { backgroundColor: colors.action }]}>
                <Text style={styles.convAvatarText}>{conv.name[0]}</Text>
              </View>
              <View style={styles.convCopy}>
                <View style={[styles.convTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.convName, { color: colors.foreground }]}>{conv.name}</Text>
                  <Text style={[styles.convTime, { color: colors.mutedForeground }]}>{conv.time}</Text>
                </View>
                <View style={[styles.convBottomRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.convPreview, { color: colors.mutedForeground, textAlign: rtl }]} numberOfLines={1}>{conv.preview}</Text>
                  {conv.unread > 0 && (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.action }]}>
                      <Text style={[styles.unreadText, { color: colors.actionForeground }]}>{conv.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          </AnimatedReveal>
        ))}

        {conversations.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{tr('noMessages')}</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{tr('noMessagesDesc')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
  convAvatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  convAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#ffffff' },
  convCopy: { flex: 1, gap: 4 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  convTime: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  convBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convPreview: { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  unreadText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  chatAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff' },
  chatName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  chatStatus: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  headerAction: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  msgAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  bubbleTime: { fontFamily: 'Inter_400Regular', fontSize: 9, textAlign: 'right' },
  inputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1 },
  msgInput: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 13 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
