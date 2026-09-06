import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Dimensions, Image, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StaticMap } from '@/components/MapViewComponent';
import { openDirections } from '@/lib/locationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatAreaDisplay, formatPrice, properties, propertyImages, apiPropertyToProperty } from '@/lib/properties';
import { getProperty, incrementView, submitInquiry, bookAppointment, type ApiProperty } from '@/lib/api';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useSaved } from '@/context/SavedContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
// BlurView removed — crashes Android
import { PropertyGalleryModal } from '@/components/PropertyGalleryModal';
import { shareProperty } from '@/lib/share';
import { WhatsAppLogo } from '@/components/WhatsAppIcon';
import { recordVisit } from '@/lib/visitHistoryStore';
import { addInquiry } from '@/lib/inquiriesStore';
import { PropertyMediaStrip } from '@/components/PropertyMediaStrip';

const SCREEN_W = Dimensions.get('window').width;

// ── Safe initials helper — never crashes on empty/null agent name ─────────────
function safeInitials(name: string | null | undefined, maxLen = 2): string {
  if (!name || !name.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() : ''))
    .filter(Boolean)
    .join('')
    .slice(0, maxLen) || '?';
}

// ── Helpers for date/time slots ───────────────────────────────────────────────

const DAY_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

function upcomingDates(count = 7): { label: string; iso: string }[] {
  const result: { label: string; iso: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0]!;
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
    result.push({ label, iso });
  }
  return result;
}

// ── Inquiry Modal (shown when buyer taps "Send Inquiry") ─────────────────────

function InquiryModal({
  visible, onClose, property, sellerId, agentId, colors, insets,
}: {
  visible: boolean;
  onClose: () => void;
  property: (typeof properties)[number];
  sellerId?: number;
  agentId?: number;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const { user } = useAuth();

  const [message,    setMessage]    = useState('I am interested in this property. Please share more details and arrange a viewing at your earliest convenience.');
  const [clientName, setClientName] = useState(user?.name ?? '');
  const [phone,      setPhone]      = useState(user?.phone ?? '');
  const [bookVisit,  setBookVisit]  = useState(false);
  const [visitType,  setVisitType]  = useState<'Site Visit' | 'Video Call'>('Site Visit');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [sentAppt,   setSentAppt]   = useState(false);
  const dates = upcomingDates(7);

  // Pre-fill contact from auth whenever user changes
  React.useEffect(() => {
    if (user) { setClientName(user.name); setPhone(user.phone ?? ''); }
  }, [user?.name, user?.phone]);

  const handleSend = async () => {
    if (!clientName.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone Required', 'Please enter a contact number.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please enter a message.');
      return;
    }
    if (bookVisit && (!selectedDate || !selectedTime)) {
      Alert.alert('Select Date & Time', 'Please pick a date and time for your site visit.');
      return;
    }

    setSending(true);
    let apptBooked = false;
    try {
      // Submit inquiry to backend
      await submitInquiry({
        propertyId:    property.id,
        propertyTitle: property.title,
        clientName:    clientName.trim(),
        email:         user?.email,
        phone:         phone.trim(),
        message:       message.trim(),
        sellerId,
        agentId,
        buyerId:       user ? Number(user.id) : undefined,
      });

      // Also save locally for offline Profile → My Inquiries view
      await addInquiry({
        propertyId:    property.id,
        propertyTitle: property.title,
        propertyType:  property.type,
        propertyCity:  property.city,
        propertyPrice: property.price,
        agentName:     property.agent,
        message:       message.trim(),
      }).catch(() => undefined);

      // Submit appointment if booking requested
      if (bookVisit && selectedDate && selectedTime) {
        await bookAppointment({
          propertyId:      property.id,
          propertyTitle:   property.title,
          propertyAddress: property.address,
          buyerId:         user ? Number(user.id) : undefined,
          buyerName:       clientName.trim(),
          sellerId,
          agentId,
          date:            selectedDate,
          time:            selectedTime,
          type:            visitType,
        });
        apptBooked = true;
      }

      setSentAppt(apptBooked);
      setSent(true);
    } catch (error) {
      Alert.alert(
        'Could not submit',
        error instanceof Error && error.message
          ? error.message
          : 'Please try again or call the agent directly.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setSentAppt(false);
    setMessage('I am interested in this property. Please share more details and arrange a viewing at your earliest convenience.');
    setBookVisit(false);
    setSelectedDate(null);
    setSelectedTime(null);
    onClose();
  };

  if (!visible) return null;

  const agentPhone = property.agentPhone;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={iq.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[iq.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[iq.handle, { backgroundColor: colors.border }]} />

          {sent ? (
            /* ── Success State ── */
            <View style={iq.successWrap}>
              <View style={[iq.successIcon, { backgroundColor: '#1a6b3a18' }]}>
                <Feather name="check-circle" size={36} color="#1a6b3a" />
              </View>
              <Text style={[iq.successTitle, { color: colors.foreground }]}>
                {sentAppt ? 'Viewing Booked!' : 'Inquiry Sent!'}
              </Text>
              <Text style={[iq.successDesc, { color: colors.mutedForeground }]}>
                {sentAppt
                  ? `Your ${visitType.toLowerCase()} request has been sent to ${property.agent}. They will confirm the appointment shortly.`
                  : `Your inquiry has been sent to ${property.agent}. You can view the status in your Profile → My Inquiries.`}
              </Text>
              <View style={iq.successBtns}>
                {agentPhone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${agentPhone}`)}
                    style={[iq.successBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}>
                    <Feather name="phone" size={15} color={colors.foreground} />
                    <Text style={[iq.successBtnText, { color: colors.foreground }]}>Call</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={handleClose}
                  style={[iq.successBtn, { backgroundColor: colors.action }]}>
                  <Text style={[iq.successBtnText, { color: colors.actionForeground }]}>Done</Text>
                  <Feather name="check" size={15} color={colors.actionForeground} />
                </Pressable>
              </View>
            </View>
          ) : (
            /* ── Compose State ── */
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Header */}
              <View style={iq.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[iq.title, { color: colors.foreground }]}>Send Inquiry</Text>
                  <Text style={[iq.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {property.title} · {property.city}
                  </Text>
                </View>
                <Pressable onPress={handleClose} style={[iq.closeBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Agent row */}
              <View style={[iq.agentRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={[iq.agentAvatar, { backgroundColor: colors.action + '22' }]}>
                  <Text style={[iq.agentInitials, { color: colors.action }]}>
                    {safeInitials(property.agent)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[iq.agentName, { color: colors.foreground }]}>{property.agent}</Text>
                  <Text style={[iq.agentTitle, { color: colors.mutedForeground }]}>{property.agentTitle}</Text>
                </View>
                <View style={[iq.verifiedBadge, { backgroundColor: '#1a6b3a15' }]}>
                  <Feather name="check-circle" size={10} color="#1a6b3a" />
                  <Text style={iq.verifiedText}>Verified</Text>
                </View>
              </View>

              {/* Contact fields */}
              <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>YOUR NAME</Text>
              <TextInput
                value={clientName}
                onChangeText={setClientName}
                placeholder="Full name"
                style={[iq.inputSingle, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>PHONE NUMBER</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="03XX-XXXXXXX"
                keyboardType="phone-pad"
                style={[iq.inputSingle, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Message */}
              <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>YOUR MESSAGE</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
                style={[iq.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Book a site visit toggle */}
              <Pressable
                onPress={() => setBookVisit((v) => !v)}
                style={[iq.visitToggle, { backgroundColor: bookVisit ? colors.action + '12' : colors.secondary, borderColor: bookVisit ? colors.action : colors.border }]}>
                <View style={[iq.toggleCheck, { backgroundColor: bookVisit ? colors.action : 'transparent', borderColor: bookVisit ? colors.action : colors.border }]}>
                  {bookVisit && <Feather name="check" size={10} color={colors.actionForeground} />}
                </View>
                <Feather name="calendar" size={14} color={bookVisit ? colors.action : colors.mutedForeground} />
                <Text style={[iq.visitToggleText, { color: bookVisit ? colors.action : colors.foreground }]}>
                  Also book a site visit
                </Text>
              </Pressable>

              {bookVisit && (
                <>
                  {/* Visit type */}
                  <View style={iq.typeRow}>
                    {(['Site Visit', 'Video Call'] as const).map((t) => (
                      <Pressable key={t} onPress={() => setVisitType(t)}
                        style={[iq.typeChip, { borderColor: visitType === t ? colors.selectionBorder : colors.border, backgroundColor: visitType === t ? colors.selectionBackground : 'transparent', borderWidth: visitType === t ? 1.5 : 1 }]}>
                        <Feather name={t === 'Site Visit' ? 'map-pin' : 'video'} size={11} color={visitType === t ? colors.action : colors.mutedForeground} />
                        <Text style={[iq.typeChipText, { color: visitType === t ? colors.selectionForeground : colors.mutedForeground, fontWeight: visitType === t ? '600' : '400' }]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Date chips */}
                  <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>SELECT DATE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
                    {dates.map((d) => (
                      <Pressable key={d.iso} onPress={() => setSelectedDate(d.iso)}
                        style={[iq.dateChip, { borderColor: selectedDate === d.iso ? colors.selectionBorder : colors.border, backgroundColor: selectedDate === d.iso ? colors.selectionBackground : colors.secondary, borderWidth: selectedDate === d.iso ? 1.5 : 1 }]}>
                        <Text style={[iq.dateChipText, { color: selectedDate === d.iso ? colors.selectionForeground : colors.foreground, fontWeight: selectedDate === d.iso ? '600' : '400' }]}>{d.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Time slots */}
                  <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>SELECT TIME</Text>
                  <View style={iq.timeGrid}>
                    {TIME_SLOTS.map((t) => (
                      <Pressable key={t} onPress={() => setSelectedTime(t)}
                        style={[iq.timeChip, { borderColor: selectedTime === t ? colors.selectionBorder : colors.border, backgroundColor: selectedTime === t ? colors.selectionBackground : 'transparent', borderWidth: selectedTime === t ? 1.5 : 1 }]}>
                        <Text style={[iq.timeChipText, { color: selectedTime === t ? colors.selectionForeground : colors.foreground, fontWeight: selectedTime === t ? '600' : '400' }]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {/* Actions */}
              <View style={iq.actions}>
                {agentPhone ? (
                  <Pressable onPress={() => Linking.openURL(`https://wa.me/92${agentPhone.replace(/\D/g, '').replace(/^0/, '')}`)}
                    style={[iq.altBtn, { borderColor: '#25d366', backgroundColor: '#25d36612' }]}>
                    <Feather name="message-circle" size={15} color="#25d366" />
                    <Text style={[iq.altBtnText, { color: '#25d366' }]}>WhatsApp</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={handleSend} disabled={sending}
                  style={[iq.sendBtn, { backgroundColor: colors.action, opacity: sending ? 0.72 : 1 }]}>
                  <Text style={[iq.sendBtnText, { color: colors.actionForeground }]}>
                    {sending ? 'Sending…' : bookVisit ? 'Send & Book Visit' : 'Send Inquiry'}
                  </Text>
                  <Feather name={bookVisit ? 'calendar' : 'send'} size={15} color={colors.actionForeground} />
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function AppointmentModal({
  visible, onClose, property, sellerId, agentId, colors, insets,
}: {
  visible: boolean;
  onClose: () => void;
  property: (typeof properties)[number];
  sellerId?: number;
  agentId?: number;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const { user } = useAuth();
  const DAYS = upcomingDates(7);

  const [selectedDate, setSelectedDate] = useState(DAYS[0]!.iso);
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[0]!);
  const [visitType,    setVisitType]    = useState<'Site Visit' | 'Video Call'>('Site Visit');
  const [booking,      setBooking]      = useState(false);
  const [booked,       setBooked]       = useState(false);

  const handleBook = async () => {
    setBooking(true);
    try {
      await bookAppointment({
        propertyId:      property.id,
        propertyTitle:   property.title,
        propertyAddress: property.address,
        buyerName:       user?.name ?? 'Guest',
        date:            selectedDate,
        time:            selectedTime,
        type:            visitType,
        sellerId,
        agentId,
        buyerId:         user?.id ? Number(user.id) : undefined,
      });
      setBooked(true);
    } catch (error) {
      Alert.alert(
        'Could not book visit',
        error instanceof Error && error.message
          ? error.message
          : 'Please try again or call the agent directly.',
      );
    } finally {
      setBooking(false);
    }
  };

  const handleClose = () => {
    setBooked(false);
    setSelectedDate(DAYS[0]!.iso);
    setSelectedTime(TIME_SLOTS[0]!);
    setVisitType('Site Visit');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={iq.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[iq.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[iq.handle, { backgroundColor: colors.border }]} />

          {booked ? (
            <View style={iq.successWrap}>
              <View style={[iq.successIcon, { backgroundColor: '#1a6b3a18' }]}>
                <Feather name="calendar" size={36} color="#1a6b3a" />
              </View>
              <Text style={[iq.successTitle, { color: colors.foreground }]}>Visit Booked!</Text>
              <Text style={[iq.successDesc, { color: colors.mutedForeground }]}>
                Your {visitType.toLowerCase()} request for{'\n'}
                <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{selectedDate} at {selectedTime}</Text>
                {'\n'}has been submitted. The agent will confirm shortly.
              </Text>
              <View style={iq.successBtns}>
                <Pressable onPress={() => Linking.openURL(`tel:${property.agentPhone ?? '03042569000'}`)}
                  style={[iq.successBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}>
                  <Feather name="phone" size={15} color={colors.foreground} />
                  <Text style={[iq.successBtnText, { color: colors.foreground }]}>Call Agent</Text>
                </Pressable>
                <Pressable onPress={handleClose}
                  style={[iq.successBtn, { backgroundColor: colors.action }]}>
                  <Text style={[iq.successBtnText, { color: colors.actionForeground }]}>Done</Text>
                  <Feather name="check" size={15} color={colors.actionForeground} />
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={iq.header}>
                <View>
                  <Text style={[iq.title, { color: colors.foreground }]}>Book Site Visit</Text>
                  <Text style={[iq.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {property.title} · {property.city}
                  </Text>
                </View>
                <Pressable onPress={handleClose} style={[iq.closeBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Visit type toggle */}
              <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>VISIT TYPE</Text>
              <View style={[ap.typeRow, { marginBottom: 16 }]}>
                {(['Site Visit', 'Video Call'] as const).map((t) => (
                  <Pressable key={t} onPress={() => setVisitType(t)}
                    style={[ap.typeBtn, {
                       backgroundColor: visitType === t ? colors.selectionBackground : colors.secondary,
                       borderColor: visitType === t ? colors.selectionBorder : colors.border,
                       borderWidth: visitType === t ? 1.5 : 1,
                    }]}>
                    <Feather
                      name={t === 'Site Visit' ? 'map-pin' : 'video'}
                      size={14}
                       color={visitType === t ? colors.selectionForeground : colors.mutedForeground}
                    />
                    <Text style={[ap.typeBtnText, {
                       color: visitType === t ? colors.selectionForeground : colors.foreground,
                       fontWeight: visitType === t ? '600' : '400',
                    }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Date selection */}
              <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>SELECT DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                {DAYS.map((d) => (
                  <Pressable key={d.iso} onPress={() => setSelectedDate(d.iso)}
                    style={[ap.datePill, {
                       backgroundColor: selectedDate === d.iso ? colors.selectionBackground : colors.secondary,
                       borderColor: selectedDate === d.iso ? colors.selectionBorder : colors.border,
                       borderWidth: selectedDate === d.iso ? 1.5 : 1,
                    }]}>
                    <Text style={[ap.datePillText, {
                       color: selectedDate === d.iso ? colors.selectionForeground : colors.foreground,
                       fontWeight: selectedDate === d.iso ? '600' : '400',
                    }]}>{d.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Time slots */}
              <Text style={[iq.fieldLabel, { color: colors.mutedForeground }]}>SELECT TIME</Text>
              <View style={[ap.timeGrid, { marginBottom: 18 }]}>
                {TIME_SLOTS.map((t) => (
                  <Pressable key={t} onPress={() => setSelectedTime(t)}
                    style={[ap.timeSlot, {
                       backgroundColor: selectedTime === t ? colors.selectionBackground : colors.secondary,
                       borderColor: selectedTime === t ? colors.selectionBorder : colors.border,
                       borderWidth: selectedTime === t ? 1.5 : 1,
                    }]}>
                    <Text style={[ap.timeSlotText, {
                       color: selectedTime === t ? colors.selectionForeground : colors.foreground,
                       fontWeight: selectedTime === t ? '600' : '400',
                    }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Submit */}
              <Pressable onPress={handleBook} disabled={booking}
                style={[iq.sendBtn, { backgroundColor: colors.action, opacity: booking ? 0.72 : 1 }]}>
                <Feather name="calendar" size={15} color={colors.actionForeground} />
                <Text style={[iq.sendBtnText, { color: colors.actionForeground }]}>
                  {booking ? 'Booking…' : 'Confirm Booking'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
const iq = StyleSheet.create({
  overlay:         { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0d1d2baa' },
  sheet:           { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, paddingHorizontal: 18, maxHeight: '90%' },
  handle:          { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  header:          { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  title:           { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  sub:             { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  closeBtn:        { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  agentRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 16 },
  agentAvatar:     { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  agentInitials:   { fontFamily: 'Inter_700Bold', fontSize: 14 },
  agentName:       { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  agentTitle:      { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  verifiedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  verifiedText:    { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#1a6b3a' },
  fieldLabel:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1, marginBottom: 8 },
  inputSingle:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 14 },
  input:           { borderWidth: 1, borderRadius: 14, padding: 13, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, minHeight: 80, textAlignVertical: 'top', marginBottom: 14 },
  visitToggle:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 14 },
  toggleCheck:     { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  visitToggleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  typeRow:         { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeChip:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 9 },
  typeChipText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  dateChip:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  dateChipText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  timeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  timeChip:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  timeChipText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  actions:         { flexDirection: 'row', gap: 10, marginBottom: 4, marginTop: 4 },
  altBtn:          { flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  altBtnText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sendBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 14 },
  sendBtnText:     { fontFamily: 'Inter_700Bold', fontSize: 13 },
  // success
  successWrap:     { alignItems: 'center', paddingVertical: 24, gap: 10, paddingHorizontal: 10 },
  successIcon:     { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle:    { fontFamily: 'Inter_700Bold', fontSize: 22 },
  successDesc:     { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, color: '#64748b' },
  successBtns:     { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  successBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 14 },
  successBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});

const ap = StyleSheet.create({
  typeRow:      { flexDirection: 'row', gap: 10 },
  typeBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 14, paddingVertical: 13 },
  typeBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  datePill:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  datePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  timeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlot:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: '22%', alignItems: 'center' },
  timeSlotText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
function PropertyDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSaved, toggleSaved } = useSaved();
  const numId = Number(id);

  // Start with local mock fallback; replace with API data when loaded
  const [property, setProperty] = useState(
    properties.find((item) => item.id === numId) ?? properties[0]!,
  );
  const [sellerId,       setSellerId]       = useState<number | undefined>(undefined);
  const [agentId,        setAgentId]        = useState<number | undefined>(undefined);
  const [activeImage,    setActiveImage]    = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [inquiryOpen,    setInquiryOpen]    = useState(false);
  const [bookingOpen,    setBookingOpen]    = useState(false);
  const galleryScrollRef = useRef<ScrollView>(null);
  const images = propertyImages(property);
  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // Fetch live property from API + increment view count
  useEffect(() => {
    if (!numId) return;
    getProperty(numId)
      .then((ap: ApiProperty) => {
        setProperty(apiPropertyToProperty(ap));
        setSellerId(ap.sellerId);
        setAgentId(ap.agentId);
      })
      .catch(() => undefined); // keep mock on failure
    incrementView(numId).catch(() => undefined);
  }, [numId]);

  // Record visit whenever this property is opened
  useEffect(() => {
    if (!isLoggedIn) return;
    void recordVisit({
      propertyId:     property.id,
      propertyTitle:  property.title,
      propertyType:   property.type,
      propertyCity:   property.city,
      propertyPrice:  property.price,
      propertyStatus: property.status,
    }).catch(() => undefined);
  }, [isLoggedIn, property.id, property.title, property.type, property.city, property.price, property.status]);

  const agentPhone = property.agentPhone ?? '03042569000';
  const waUrl = `https://wa.me/92${agentPhone.replace(/\D/g, '').replace(/^0/, '')}`;
  const smsUrl = `sms:${agentPhone}`;
  const bottomBarH = insets.bottom + 70;

  const requireSignIn = (action: 'inquiry' | 'visit') => {
    if (isLoggedIn) return true;
    Alert.alert(
      'Sign in required',
      `Please sign in to ${action === 'visit' ? 'schedule a visit' : 'send an inquiry'} and track the response in your profile.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/(auth)/login') },
      ],
    );
    return false;
  };

  const openInquiry = () => {
    if (requireSignIn('inquiry')) setInquiryOpen(true);
  };

  const openBooking = () => {
    if (requireSignIn('visit')) setBookingOpen(true);
  };

  return (
    <>
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: bottomBarH + 16 }} showsVerticalScrollIndicator={false}>
      {/* ── Hero Gallery: swipeable images with pagination dots ── */}
      <View style={[styles.imageWrap, { overflow: 'hidden' }]}>
        <ScrollView
          ref={galleryScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width,
            );
            setActiveImage(Math.max(0, Math.min(idx, images.length - 1)));
          }}
          style={StyleSheet.absoluteFill}
        >
          {images.map((img, i) => (
            <Pressable key={i} onPress={() => setGalleryVisible(true)} accessibilityLabel="Open full-screen gallery">
              <Image source={img} style={{ width: SCREEN_W, height: 352 }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>

        {/* Shade overlay */}
        <View style={styles.imageShade} pointerEvents="none" />

        {/* Back + Share + Save */}
        <View style={[styles.backRow, { top: topInset + 8 }]}>
          <Pressable onPress={() => router.back()} style={[styles.roundButton, { backgroundColor: colors.action }]} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.actionForeground} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => void shareProperty(property)}
              style={[styles.roundButton, { backgroundColor: 'rgba(15,25,35,0.68)' }]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Share ${property.title}`}
              testID={`detail-share-property-${property.id}`}
            >
              <Feather name="share-2" size={18} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={() => toggleSaved(property.id)}
              style={[styles.roundButton, { backgroundColor: isSaved(property.id) ? colors.gold : 'rgba(15,25,35,0.68)' }]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${isSaved(property.id) ? 'Remove from' : 'Add to'} favorites: ${property.title}`}
              testID={`detail-save-property-${property.id}`}
            >
              <Feather name="heart" size={19} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Bottom: status badge + image count */}
        <View style={styles.imageBottomRow} pointerEvents="none">
          <View style={styles.imageStatusBadge}>
            <Text style={styles.imageLabelText}>{property.status}</Text>
          </View>
          {images.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Feather name="image" size={10} color="rgba(255,255,255,0.85)" />
              <Text style={styles.imageCountText}>{activeImage + 1} / {images.length}</Text>
            </View>
          )}
        </View>

        {/* Pagination dots */}
        {images.length > 1 && (
          <View style={styles.paginationRow} pointerEvents="none">
            {images.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.paginationDot,
                  { width: i === activeImage ? 18 : 6, backgroundColor: i === activeImage ? '#ffffff' : 'rgba(255,255,255,0.42)' },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Thumbnail strip: image tiles + Video button ── */}
      <PropertyMediaStrip
        property={property}
        activeIndex={activeImage}
        onSelect={(i) => {
          setActiveImage(i);
          galleryScrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
        }}
      />

      <PropertyGalleryModal
        property={property}
        visible={galleryVisible}
        initialIndex={activeImage}
        onClose={() => setGalleryVisible(false)}
      />

      <AnimatedReveal distance={18}>
      <View style={styles.content}>
        <View style={styles.detailTop}>
          <View style={styles.detailTitleWrap}>
            <Text style={[styles.type, { color: colors.primary }]}>{property.type.toUpperCase()}</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{property.title}</Text>
            <View style={styles.location}><Feather name="map-pin" size={14} color={colors.mutedForeground} /><Text style={[styles.locationText, { color: colors.mutedForeground }]}>{property.address}</Text></View>
          </View>
            <Text style={[styles.price, { color: colors.foreground }]}>{formatPrice(property.price, property.status)}</Text>
        </View>

        <View style={[styles.features, { borderColor: colors.border }]}>
          <Feature icon="home" value={property.bedrooms > 0 ? `${property.bedrooms}` : '—'} label="Beds" colors={colors} />
          <Feature icon="droplet" value={property.bathrooms > 0 ? `${property.bathrooms}` : '—'} label="Baths" colors={colors} />
          <Feature icon="maximize"
            value={(() => { const d = formatAreaDisplay(property.area, property.areaUnit); return d.value; })()}
            label={(() => { const d = formatAreaDisplay(property.area, property.areaUnit); return d.label; })()}
            colors={colors} />
          <Feature icon="tag" value={property.type} label="Type" colors={colors} />
        </View>

        {/* Verified badge + listing freshness */}
        <View style={styles.verifiedRow}>
          <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + '1a', borderColor: colors.primary + '44' }]}>
            <Feather name="shield" size={11} color={colors.primary} />
            <Text style={[styles.verifiedBadgeText, { color: colors.primary }]}>OG VERIFIED</Text>
          </View>
          {property.listedDate ? (
            <View style={[styles.listedPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="clock" size={9} color={colors.mutedForeground} />
              <Text style={[styles.listedPillText, { color: colors.mutedForeground }]}>Listed {property.listedDate}</Text>
            </View>
          ) : null}
        </View>

        {/* Primary actions: Schedule Visit + Inquire */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={openBooking}
            style={({ pressed }) => [styles.cta, styles.primaryCta, { backgroundColor: '#102a43', opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="calendar" size={16} color="#ffffff" />
            <Text style={[styles.ctaText, { color: '#ffffff' }]}>Schedule a Visit</Text>
          </Pressable>
          <Pressable
            onPress={openInquiry}
            style={({ pressed }) => [styles.cta, styles.secondaryCta, { borderColor: '#102a43', backgroundColor: '#102a4312', opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="message-circle" size={16} color="#102a43" />
            <Text style={[styles.secondaryCtaText, { color: '#102a43' }]}>Inquire</Text>
          </Pressable>
        </View>

        {/* Spacer between actions and verification card */}
        <View style={styles.sectionSpacer} />

        {/* Document & verification status */}
        <View style={[styles.docCard, { backgroundColor: colors.secondary, borderColor: '#1a6b3a33' }]}>
          <View style={styles.docHeader}>
            <Feather name="shield" size={14} color="#1a6b3a" />
            <Text style={[styles.docTitle, { color: '#1a6b3a' }]}>Property Verification</Text>
          </View>
          {[
            'Listing reviewed by OG Landmark',
            'Agent identity verified',
            'Property details cross-checked',
            'Contact information confirmed',
          ].map((doc) => (
            <View key={doc} style={styles.docItem}>
              <Feather name="check-circle" size={11} color="#1a6b3a" />
              <Text style={[styles.docItemText, { color: colors.foreground }]}>{doc}</Text>
            </View>
          ))}
          <View style={[styles.docNote, { borderTopColor: '#1a6b3a22' }]}>
            <Feather name="info" size={10} color={colors.mutedForeground} />
            <Text style={[styles.docNoteText, { color: colors.mutedForeground }]}>
              Title deed verification and full legal due diligence available on request. Contact agent.
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About this property</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{property.description}</Text>

        {property.amenities && (
          <>
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInRow, { color: colors.foreground }]}>Amenities</Text>
              <Text style={[styles.verifiedLabel, { color: colors.primary }]}>VERIFIED</Text>
            </View>
            <View style={styles.amenityGrid}>
              {property.amenities.map((amenity) => (
                <View key={amenity} style={[styles.amenity, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
                  <Feather name="check-circle" size={14} color={colors.primary} />
                  <Text style={[styles.amenityText, { color: colors.foreground }]}>{amenity}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Agricultural Land Details ── */}
        {property.agriDetails && (
          <>
            <View style={[styles.agriHeader, { borderColor: '#1a6b3a44' }]}>
              <View style={[styles.agriHeaderIcon, { backgroundColor: '#1a6b3a18' }]}>
                <Text style={styles.agriEmoji}>🌾</Text>
              </View>
              <View>
                <Text style={[styles.agriHeaderEyebrow, { color: '#1a6b3a' }]}>LAND DETAILS</Text>
                <Text style={[styles.agriHeaderTitle, { color: colors.foreground }]}>Agricultural Information</Text>
              </View>
            </View>

            <View style={[styles.agriGrid, { borderColor: '#1a6b3a22', backgroundColor: '#1a6b3a08' }]}>
              {/* Size */}
              <AgriRow
                icon="maximize"
                label="Land Size"
                value={`${property.agriDetails.sizeAcres} Acres · ${property.agriDetails.sizeKanal} Kanal`}
                colors={colors}
                accent="#1a6b3a"
              />
              {/* Main Crop */}
              <AgriRow
                icon="sun"
                label="Main Crop"
                value={property.agriDetails.mainCrop}
                colors={colors}
                accent="#1a6b3a"
              />
              {/* Nehri Water */}
              <AgriRow
                icon="droplet"
                label="Nehri (Canal) Water"
                value={property.agriDetails.nehriWater ? '✅ Available' : '❌ Not available'}
                colors={colors}
                accent={property.agriDetails.nehriWater ? '#1a6b3a' : '#b94b42'}
              />
              {/* Tube Well */}
              <AgriRow
                icon="zap"
                label="Tube Well"
                value={property.agriDetails.tubeWell ? '✅ Installed' : '❌ Not installed'}
                colors={colors}
                accent={property.agriDetails.tubeWell ? '#1a6b3a' : '#b94b42'}
              />
              {/* Soil Type */}
              <AgriRow
                icon="layers"
                label="Soil Type"
                value={property.agriDetails.soilType}
                colors={colors}
                accent="#1a6b3a"
              />
              {/* Village */}
              {property.agriDetails.village && (
                <AgriRow icon="map-pin" label="Village / Mauza" value={property.agriDetails.village} colors={colors} accent="#1a6b3a" />
              )}
              {/* Tehsil */}
              {property.agriDetails.tehsil && (
                <AgriRow icon="map" label="Tehsil" value={property.agriDetails.tehsil} colors={colors} accent="#1a6b3a" />
              )}
              {/* Union Council */}
              {property.agriDetails.unionCouncil && (
                <AgriRow icon="users" label="Union Council" value={property.agriDetails.unionCouncil} colors={colors} accent="#1a6b3a" />
              )}
              {/* GPS */}
              {property.agriDetails.gpsBoundary && (
                <AgriRow icon="crosshair" label="GPS Boundary" value={property.agriDetails.gpsBoundary} colors={colors} accent="#1a6b3a" isLast />
              )}
            </View>
          </>
        )}

        {property.investmentScore && property.landSize && (
          <View style={[styles.intelligenceCard, { backgroundColor: colors.action }]}>
            <View style={styles.intelligenceTop}>
              <View>
                <Text style={styles.intelligenceEyebrow}>INVESTMENT SCORE</Text>
                <Text style={styles.intelligenceTitle}>OG Landmark rating</Text>
              </View>
              <View style={[styles.scoreCircle, { backgroundColor: colors.gold }]}>
                <Text style={[styles.scoreNumber, { color: colors.goldForeground }]}>{property.investmentScore.toFixed(1)}</Text>
                <Text style={[styles.scoreOutOf, { color: colors.goldForeground }]}>/10</Text>
              </View>
            </View>
            <Text style={styles.intelligenceCopy}>OG Landmark investment rating based on location, construction quality, amenities, and projected market growth.</Text>
            <Text style={styles.landSize}>{property.landSize}</Text>
          </View>
        )}

        {property.listedDate && (
          <View style={[styles.listingMeta, { borderColor: colors.border }]}>
            <View><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>PROPERTY TYPE</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{property.type}</Text></View>
            <View><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>STATUS</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{property.status}</Text></View>
            <View><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>LISTED</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{property.listedDate}</Text></View>
          </View>
        )}

        {/* ── Google Maps card ──────────────────────────────────── */}
        <PropertyDetailMap property={property} colors={colors} />

        {property.locationDetails && (
          <View style={[styles.locationDetails, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <LocationLine label="Province" value={property.locationDetails.province} colors={colors} />
            <LocationLine label="District" value={property.locationDetails.district} colors={colors} />
            <LocationLine label="Tehsil" value={property.locationDetails.tehsil} colors={colors} />
            <LocationLine label="Village / Mauza" value={property.locationDetails.village} colors={colors} />
            <LocationLine label="GPS Coordinates" value={property.locationDetails.gps} colors={colors} />
          </View>
        )}

        <View style={[styles.agent, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
          <View style={[styles.agentAvatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.agentInitials, { color: colors.accentForeground }]}>{safeInitials(property.agent)}</Text>
          </View>
          <View style={styles.agentCopy}>
            <Text style={[styles.agentLabel, { color: colors.mutedForeground }]}>LISTED BY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.agentName, { color: colors.foreground }]}>{property.agent}</Text>
            </View>
            <Text style={[styles.agentTitle, { color: colors.mutedForeground }]}>{property.agentTitle}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => Linking.openURL(waUrl)} style={[styles.callButton, { backgroundColor: '#25D366' }]}>
              <WhatsAppLogo size={20} />
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`tel:${property.agentPhone ?? '03042569000'}`)} style={[styles.callButton, { backgroundColor: colors.action }]}>
              <Feather name="phone" size={17} color={colors.actionForeground} />
            </Pressable>
          </View>
        </View>

      </View>
      </AnimatedReveal>
    </ScrollView>

    {/* ── Fixed bottom contact bar ─────────────────────────────────────── */}
    <View style={[styles.fixedBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
      {/* Call icon */}
      <Pressable
        onPress={() => Linking.openURL(`tel:${agentPhone}`)}
        style={({ pressed }) => [styles.fixedIconBtn, { borderColor: colors.action + '55', backgroundColor: colors.action + '18', opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button" accessibilityLabel="Call agent"
      >
        <Feather name="phone" size={20} color={colors.action} />
      </Pressable>

      {/* Inquiry — always reachable above the Android home indicator */}
      <Pressable
        onPress={openInquiry}
        style={({ pressed }) => [styles.fixedInquiryBtn, { borderColor: colors.action + '55', backgroundColor: colors.action + '10', opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button" accessibilityLabel="Send an inquiry"
      >
        <Feather name="message-circle" size={19} color={colors.action} />
      </Pressable>

      {/* Schedule Visit — primary navy CTA */}
      <Pressable
        onPress={openBooking}
        style={({ pressed }) => [styles.fixedCallBtn, { backgroundColor: '#102a43', opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button" accessibilityLabel="Schedule a site visit"
      >
        <Feather name="calendar" size={17} color="#ffffff" />
        <Text style={[styles.fixedCallTxt, { color: '#ffffff' }]}>Schedule Visit</Text>
      </Pressable>

      {/* WhatsApp */}
      <Pressable
        onPress={() => Linking.openURL(waUrl)}
        style={({ pressed }) => [styles.fixedWaBtn, { opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button" accessibilityLabel="WhatsApp"
      >
        <WhatsAppLogo size={42} />
      </Pressable>
    </View>

    <InquiryModal
      visible={inquiryOpen}
      onClose={() => setInquiryOpen(false)}
      property={property}
      sellerId={sellerId}
      agentId={agentId}
      colors={colors}
      insets={insets}
    />
    <AppointmentModal
      visible={bookingOpen}
      onClose={() => setBookingOpen(false)}
      property={property}
      sellerId={sellerId}
      agentId={agentId}
      colors={colors}
      insets={insets}
    />
    </>
  );
}

export default function PropertyDetailScreenWithBoundary() {
  return (
    <ErrorBoundary>
      <PropertyDetailScreen />
    </ErrorBoundary>
  );
}

// ── Check if native map module is available (not in Expo Go) ─────────────────
// Use Platform.OS to avoid web bundler trying to resolve @rnmapbox/maps (crashes web build).
// StaticMap itself handles Expo Go gracefully via its own try/require guard.
const _nativeMapsAvailable = Platform.OS !== 'web';

// ── Map card for property detail ──────────────────────────────────────────────
function PropertyDetailMap({
  property,
  colors,
}: {
  property: { lat: number; lng: number; address: string };
  colors: ReturnType<typeof useColors>;
}) {
  const [satellite, setSatellite] = useState(false);

  const hasCoords =
    isFinite(property.lat) &&
    isFinite(property.lng) &&
    !(property.lat === 0 && property.lng === 0) &&
    property.lat >= -90 && property.lat <= 90 &&
    property.lng >= -180 && property.lng <= 180;

  return (
    <View style={[styles.detailMapCard, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
      <View style={styles.detailMapSurface}>
        {!hasCoords ? (
          <View style={[styles.detailMapNoCoords, { backgroundColor: colors.secondary }]}>
            <Feather name="x-circle" size={28} color={colors.mutedForeground} />
            <Text style={[styles.detailMapNoCoordsText, { color: colors.mutedForeground }]}>
              Location not available
            </Text>
          </View>
        ) : (
          <StaticMap
            latitude={property.lat}
            longitude={property.lng}
            satellite={satellite}
            interactive
          />
        )}

        {/* Satellite toggle — only when native map is rendering */}
        {hasCoords && _nativeMapsAvailable && (
          <Pressable
            style={[styles.detailMapSatBtn, { backgroundColor: satellite ? colors.primary : colors.card, borderColor: colors.border }]}
            onPress={() => setSatellite((v) => !v)}
          >
            <Feather name="layers" size={14} color={satellite ? '#fff' : colors.mutedForeground} />
            <Text style={[styles.detailMapSatLabel, { color: satellite ? '#fff' : colors.mutedForeground }]}>
              {satellite ? 'Satellite' : 'Map'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Location details below map */}
      {hasCoords && ((property as any).city || (property as any).address) && (
        <View style={[styles.detailMapLocRow, { borderTopColor: colors.border }]}>
          <Feather name="map-pin" size={13} color={colors.action} style={{ marginTop: 1 }} />
          <Text style={[styles.detailMapLocText, { color: colors.mutedForeground }]} numberOfLines={2}>
            {[(property as any).locality, (property as any).city, (property as any).district].filter(Boolean).join(' · ') || property.address}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      {hasCoords && (
        <View style={[styles.detailMapActions, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${property.lat},${property.lng}`
              )
            }
            style={({ pressed }) => [
              styles.detailMapAction,
              { flex: 1, backgroundColor: colors.action + '15', opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Feather name="map-pin" size={13} color={colors.action} />
            <Text style={[styles.detailMapActionText, { color: colors.action }]}>Open in Maps</Text>
          </Pressable>
          <Pressable
            onPress={() => openDirections(property.lat, property.lng)}
            style={({ pressed }) => [
              styles.detailMapAction,
              { flex: 1, backgroundColor: '#1a6b3a15', opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Feather name="navigation" size={13} color="#1a6b3a" />
            <Text style={[styles.detailMapActionText, { color: '#1a6b3a' }]}>Get Directions</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Feature({ icon, value, label, colors }: { icon: 'home' | 'droplet' | 'maximize' | 'tag'; value: string; label: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.feature}><Feather name={icon} size={16} color={colors.primary} /><Text style={[styles.featureValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.featureLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

function LocationLine({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.locationLine}><Text style={[styles.locationLineLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.locationLineValue, { color: colors.foreground }]}>{value}</Text></View>;
}

function AgriRow({ icon, label, value, colors, accent, isLast }: {
  icon: keyof typeof Feather.glyphMap; label: string; value: string;
  colors: ReturnType<typeof useColors>; accent: string; isLast?: boolean;
}) {
  return (
    <View style={[styles.agriRow, !isLast && { borderBottomWidth: 1, borderBottomColor: '#1a6b3a18' }]}>
      <View style={[styles.agriRowIcon, { backgroundColor: accent + '18' }]}>
        <Feather name={icon} size={14} color={accent} />
      </View>
      <Text style={[styles.agriRowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.agriRowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  imageWrap: { height: 352, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageTap: { flex: 1 },
  imageShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18, 25, 28, 0.28)' },
  backRow: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', gap: 8 },
  roundButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  shareButton: { shadowColor: '#102a43', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  favoriteButton: { shadowColor: '#d9b96d', shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  imageLabel: { position: 'absolute', bottom: 18, left: 20, backgroundColor: '#f1e6c9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  imageStatusBadge: { backgroundColor: '#f1e6c9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  imageLabelText: { color: '#1c2024', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  content: { paddingHorizontal: 20, paddingTop: 23 },
  detailTop: { gap: 13 },
  detailTitleWrap: { flex: 1 },
  type: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4, marginBottom: 9 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 25, lineHeight: 33, letterSpacing: 0 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  features: { borderTopWidth: 1, borderBottomWidth: 1, marginTop: 22, paddingVertical: 17, flexDirection: 'row', justifyContent: 'space-around' },
  feature: { alignItems: 'center', gap: 4 },
  featureValue: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 2 },
  featureLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  sectionTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, marginTop: 25, marginBottom: 9 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  sectionTitleInRow: { marginBottom: 9 },
  verifiedLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, marginBottom: 11 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenity: { width: '48%', minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  amenityText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 14 },
  intelligenceCard: { borderRadius: 18, padding: 16, marginTop: 24 },
  intelligenceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  intelligenceEyebrow: { color: '#f1e6c9', fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, marginBottom: 7 },
  intelligenceTitle: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  scoreCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  scoreNumber: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  scoreOutOf: { fontFamily: 'Inter_500Medium', fontSize: 9, marginTop: -2 },
  intelligenceCopy: { color: '#ffffffcc', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 13 },
  landSize: { color: '#f1e6c9', fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 16, marginTop: 12 },
  listingMeta: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 14, marginTop: 23, flexDirection: 'row', justifyContent: 'space-between', gap: 9 },
  metaLabel: { fontFamily: 'Inter_700Bold', fontSize: 7, letterSpacing: 0.9, marginBottom: 5 },
  metaValue: { fontFamily: 'Inter_600SemiBold', fontSize: 10, maxWidth: 100 },
  mapCard: { borderWidth: 1, borderRadius: 20, overflow: 'hidden', marginTop: 1, shadowColor: '#1c2024', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  mapSurface: { height: 188, overflow: 'hidden', position: 'relative' },
  mapRoad: { position: 'absolute', height: 18, borderRadius: 10, transform: [{ rotate: '28deg' }] },
  roadOne: { width: '120%', top: 58, left: -24 },
  roadTwo: { width: '110%', top: 128, left: -10, transform: [{ rotate: '-22deg' }] },
  roadThree: { width: '85%', top: 4, left: 38, transform: [{ rotate: '82deg' }] },
  mapBlock: { position: 'absolute', borderRadius: 18 },
  blockOne: { width: 86, height: 52, top: 30, left: 24, transform: [{ rotate: '-12deg' }] },
  blockTwo: { width: 112, height: 62, right: -6, top: 34, transform: [{ rotate: '18deg' }] },
  blockThree: { width: 104, height: 48, left: 80, bottom: 10, transform: [{ rotate: '-8deg' }] },
  pinHalo: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 70, left: '50%', marginLeft: -28 },
  pin: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff' },
  mapLabel: { position: 'absolute', left: 14, right: 14, bottom: 13, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  mapLabelText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11 },
  mapAction: { height: 46, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mapActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  locationDetails: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  locationLine: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#ffffff55' },
  locationLineLabel: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  locationLineValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  agent: { marginTop: 23, borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  agentAvatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  agentInitials: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  agentCopy: { flex: 1 },
  agentLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.3, marginBottom: 3 },
  agentName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  agentTitle: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  callButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  // Document verification card
  docCard:      { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20 },
  docHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  docTitle:     { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  docItem:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  docItemText:  { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  docNote:      { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  docNoteText:  { fontFamily: 'Inter_400Regular', fontSize: 9, flex: 1, lineHeight: 14 },
  actionRow:     { flexDirection: 'row', gap: 9, marginTop: 20 },
  sectionSpacer: { height: 20 },
  cta: { minHeight: 55, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryCta: { flex: 0.85, borderWidth: 1 },
  primaryCta: { flex: 1.35 },
  bookVisitCta: { borderWidth: 1 },
  secondaryCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  ctaText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  // ── Agricultural Land Details ──────────────────────────────────────────────
  agriHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1 },
  agriHeaderIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  agriEmoji: { fontSize: 22 },
  agriHeaderEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.4, marginBottom: 4 },
  agriHeaderTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  agriGrid: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 6 },
  agriRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  agriRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  agriRowLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, flex: 1 },
  agriRowValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // ── Gallery (swipeable hero) ────────────────────────────────────────────────
  imageBottomRow:  { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imageCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(15,25,35,0.65)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  imageCountText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  paginationRow:   { position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  paginationDot:   { height: 6, borderRadius: 3 },
  // ── Verified badge + listing meta ────────────────────────────────────────────
  verifiedRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  verifiedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8 },
  listedPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  listedPillText:  { fontFamily: 'Inter_400Regular', fontSize: 9 },
  // ── Fixed bottom contact bar ────────────────────────────────────────────────
  fixedBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
  fixedIconBtn: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fixedInquiryBtn: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fixedCallBtn: { flex: 1, height: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  fixedCallTxt: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  fixedWaBtn:   { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  // ── Property detail Google Maps card ────────────────────────────────────────
  detailMapCard:         { borderWidth: 1, borderRadius: 20, overflow: 'hidden', marginBottom: 12, elevation: 2, shadowColor: '#1c2024', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  detailMapSurface:      { height: 200, overflow: 'hidden', position: 'relative' },
  detailMapNoCoords:     { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10 },
  detailMapNoCoordsText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  detailMapSatBtn:       { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  detailMapSatLabel:     { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  detailMapLocRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  detailMapLocText:      { fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1, lineHeight: 16 },
  detailMapActions:      { flexDirection: 'row', borderTopWidth: 1 },
  detailMapAction:       { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 0 },
  detailMapActionText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

