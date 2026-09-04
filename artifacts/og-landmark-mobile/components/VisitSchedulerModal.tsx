/**
 * VisitSchedulerModal — slide-up visit scheduler for buyer-facing project and agent pages.
 * Saves to siteVisitStore (developer projects) or agentVisitsStore (agents).
 */
import React, { useState, useMemo } from 'react';
import {
  Alert, Modal, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { saveSiteVisit, newVisitId as newSiteVisitId } from '@/lib/siteVisitStore';
import { saveAgentVisit, newVisitId as newAgentVisitId } from '@/lib/agentVisitsStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisitSchedulerProps = {
  visible: boolean;
  onClose: () => void;
  providerType: 'developer' | 'agent';
  providerId: string;         // developerId or agentId
  projectTitle: string;       // project name or "Agent — Name" for display
  contactPerson: string;      // developer/agent name shown on confirmation
  contactPhone: string;       // phone shown on confirmation
  location: string;           // city / area
  buyerId?: string;           // current user ID for buyer profile tracking
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM',  '3:00 PM',  '4:00 PM',  '5:00 PM',
];

function localISODate(d: Date): string {
  // Build YYYY-MM-DD from local date components to avoid UTC-offset skew (e.g. Pakistan UTC+5)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildNextDays(count: number): { iso: string; label: string; dow: string }[] {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      iso:   localISODate(d),
      label: d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      dow:   d.toLocaleDateString('en-PK', { weekday: 'short' }),
    });
  }
  return days;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VisitSchedulerModal({
  visible, onClose, providerType, providerId,
  projectTitle, contactPerson, contactPhone, location, buyerId,
}: VisitSchedulerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const days = useMemo(() => buildNextDays(14), []);

  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [visitors,     setVisitors]     = useState(1);
  const [message,      setMessage]      = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submittedVisitId, setSubmittedVisitId] = useState('');

  const handleClose = () => {
    // Reset on close (with slight delay so animation completes)
    setTimeout(() => {
      setName(''); setPhone(''); setSelectedDate(''); setSelectedTime('');
      setVisitors(1); setMessage(''); setSubmitting(false); setSubmitted(false);
    }, 300);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim())         { Alert.alert('Name required', 'Please enter your full name.'); return; }
    if (!phone.trim())        { Alert.alert('Phone required', 'Please enter your phone number.'); return; }
    if (!selectedDate)        { Alert.alert('Date required', 'Please pick a preferred visit date.'); return; }
    if (!selectedTime)        { Alert.alert('Time required', 'Please select a preferred time slot.'); return; }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();

      if (providerType === 'developer') {
        const id = newSiteVisitId();
        await saveSiteVisit({
          id,
          developerId:     providerId,
          projectName:     projectTitle,
          projectLocation: location,
          contactName:     contactPerson,
          contactPhone:    contactPhone,
          visitorName:     name.trim(),
          visitorPhone:    phone.trim(),
          visitorCount:    visitors,
          message:         message.trim(),
          buyerId,
          date:            selectedDate,
          time:            selectedTime,
          status:          'Requested',
          createdAt:       now,
          updatedAt:       now,
        });
        setSubmittedVisitId(id);
      } else {
        const id = newAgentVisitId();
        await saveAgentVisit({
          id,
          agentId:       providerId,
          clientName:    name.trim(),
          clientPhone:   phone.trim(),
          propertyTitle: projectTitle,
          propertyCity:  location,
          visitorCount:  visitors,
          contactName:   contactPerson,
          contactPhone:  contactPhone,
          date:          selectedDate,
          time:          selectedTime,
          status:        'Requested',
          notes:         message.trim(),
          buyerId,
          createdAt:     now,
          updatedAt:     now,
        });
        setSubmittedVisitId(id);
      }

      setSubmitted(true);
    } catch {
      Alert.alert('Error', 'Could not schedule visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={vs.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={[vs.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[vs.handle, { backgroundColor: colors.border }]} />

          {submitted ? (
            /* ── Success screen ─────────────────────────────────────────── */
            <ScrollView contentContainerStyle={vs.successWrap} showsVerticalScrollIndicator={false}>
              <View style={[vs.successIcon, { backgroundColor: '#1a6b3a15' }]}>
                <Feather name="check-circle" size={40} color="#1a6b3a" />
              </View>
              <Text style={[vs.successTitle, { color: colors.foreground }]}>Visit Requested!</Text>
              <Text style={[vs.successSub, { color: colors.mutedForeground }]}>
                Your visit request has been sent. You'll hear back from the {providerType} soon.
              </Text>

              {/* Confirmation card */}
              <View style={[vs.confirmCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[vs.confirmHeading, { color: colors.mutedForeground }]}>VISIT SUMMARY</Text>

                <View style={vs.confirmRow}>
                  <Feather name="home" size={13} color={colors.action} />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]} numberOfLines={2}>{projectTitle}</Text>
                </View>
                <View style={vs.confirmRow}>
                  <Feather name="map-pin" size={13} color={colors.action} />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]}>{location}</Text>
                </View>
                <View style={vs.confirmRow}>
                  <Feather name="calendar" size={13} color={colors.action} />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]}>
                    {days.find((d) => d.iso === selectedDate)
                      ? `${days.find((d) => d.iso === selectedDate)!.dow}, ${days.find((d) => d.iso === selectedDate)!.label}`
                      : selectedDate}
                  </Text>
                </View>
                <View style={vs.confirmRow}>
                  <Feather name="clock" size={13} color={colors.action} />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]}>{selectedTime}</Text>
                </View>
                <View style={vs.confirmRow}>
                  <Feather name="users" size={13} color={colors.action} />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]}>{visitors} visitor{visitors !== 1 ? 's' : ''}</Text>
                </View>
                <View style={[vs.confirmDivider, { backgroundColor: colors.border }]} />
                <View style={vs.confirmRow}>
                  <Feather name="user-check" size={13} color="#c8a45a" />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]}>Contact: {contactPerson}</Text>
                </View>
                <View style={vs.confirmRow}>
                  <Feather name="phone" size={13} color="#c8a45a" />
                  <Text style={[vs.confirmVal, { color: colors.foreground }]}>{contactPhone}</Text>
                </View>
              </View>

              <Text style={[vs.noteText, { color: colors.mutedForeground }]}>
                Check Profile → My Visits for status updates. The {providerType} will confirm or reschedule your visit.
              </Text>

              <Pressable onPress={handleClose} style={[vs.doneBtn, { backgroundColor: colors.action }]}>
                <Text style={[vs.doneBtnText, { color: colors.actionForeground }]}>Done</Text>
              </Pressable>
            </ScrollView>
          ) : (
            /* ── Scheduler form ─────────────────────────────────────────── */
            <>
              {/* Header */}
              <View style={vs.header}>
                <View>
                  <Text style={[vs.title, { color: colors.foreground }]}>Schedule a Visit</Text>
                  <Text style={[vs.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>{projectTitle}</Text>
                </View>
                <Pressable onPress={handleClose} style={[vs.closeBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 20, paddingHorizontal: 18, paddingBottom: 16 }}>

                {/* ── Your details ────────────────────────────────────── */}
                <View>
                  <Text style={[vs.sectionLabel, { color: colors.mutedForeground }]}>YOUR DETAILS</Text>
                  <View style={vs.inputRow}>
                    <TextInput
                      value={name} onChangeText={setName}
                      placeholder="Full name"
                      placeholderTextColor={colors.mutedForeground}
                      style={[vs.input, vs.inputHalf, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                    />
                    <TextInput
                      value={phone} onChangeText={setPhone} keyboardType="phone-pad"
                      placeholder="Phone number"
                      placeholderTextColor={colors.mutedForeground}
                      style={[vs.input, vs.inputHalf, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                    />
                  </View>
                </View>

                {/* ── Select date ──────────────────────────────────────── */}
                <View>
                  <Text style={[vs.sectionLabel, { color: colors.mutedForeground }]}>PREFERRED DATE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {days.map((d) => {
                      const selected = selectedDate === d.iso;
                      return (
                        <Pressable key={d.iso} onPress={() => setSelectedDate(d.iso)}
                          style={[vs.dateChip,
                            selected
                              ? { backgroundColor: colors.action, borderColor: colors.action }
                              : { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <Text style={[vs.dateChipDow, { color: selected ? colors.actionForeground : colors.mutedForeground }]}>{d.dow}</Text>
                          <Text style={[vs.dateChipDay, { color: selected ? colors.actionForeground : colors.foreground }]}>{d.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* ── Select time ──────────────────────────────────────── */}
                <View>
                  <Text style={[vs.sectionLabel, { color: colors.mutedForeground }]}>PREFERRED TIME</Text>
                  <View style={vs.timeGrid}>
                    {TIME_SLOTS.map((t) => {
                      const selected = selectedTime === t;
                      return (
                        <Pressable key={t} onPress={() => setSelectedTime(t)}
                          style={[vs.timeSlot,
                            selected
                              ? { backgroundColor: colors.action, borderColor: colors.action }
                              : { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <Text style={[vs.timeSlotText, { color: selected ? colors.actionForeground : colors.foreground }]}>{t}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* ── Visitor count ────────────────────────────────────── */}
                <View>
                  <Text style={[vs.sectionLabel, { color: colors.mutedForeground }]}>NUMBER OF VISITORS</Text>
                  <View style={vs.stepperRow}>
                    <Pressable onPress={() => setVisitors((v) => Math.max(1, v - 1))}
                      style={[vs.stepperBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Feather name="minus" size={16} color={colors.foreground} />
                    </Pressable>
                    <Text style={[vs.stepperValue, { color: colors.foreground }]}>{visitors}</Text>
                    <Pressable onPress={() => setVisitors((v) => Math.min(10, v + 1))}
                      style={[vs.stepperBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Feather name="plus" size={16} color={colors.foreground} />
                    </Pressable>
                    <Text style={[vs.stepperLabel, { color: colors.mutedForeground }]}>
                      {visitors === 1 ? 'person' : 'people'}
                    </Text>
                  </View>
                </View>

                {/* ── Optional message ─────────────────────────────────── */}
                <View>
                  <Text style={[vs.sectionLabel, { color: colors.mutedForeground }]}>MESSAGE (OPTIONAL)</Text>
                  <TextInput
                    value={message} onChangeText={setMessage}
                    multiline numberOfLines={3}
                    placeholder="Any special requests or questions for the visit?"
                    placeholderTextColor={colors.mutedForeground}
                    style={[vs.input, vs.inputMultiline, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>

                {/* ── Submit ───────────────────────────────────────────── */}
                <Pressable onPress={handleSubmit} disabled={submitting}
                  style={({ pressed }) => [vs.submitBtn, { backgroundColor: colors.action, opacity: submitting || pressed ? 0.7 : 1 }]}>
                  <Feather name="calendar" size={16} color={colors.actionForeground} />
                  <Text style={[vs.submitBtnText, { color: colors.actionForeground }]}>
                    {submitting ? 'Scheduling…' : 'Request Visit'}
                  </Text>
                </Pressable>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const vs = StyleSheet.create({
  overlay:        { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0d1d2baa' },
  sheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, maxHeight: '92%' },
  handle:         { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },

  // Header
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 18, paddingBottom: 16 },
  title:          { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.3 },
  subtitle:       { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3, maxWidth: 260 },
  closeBtn:       { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  // Section labels
  sectionLabel:   { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 10 },

  // Inputs
  inputRow:       { flexDirection: 'row', gap: 10 },
  input:          { borderWidth: 1, borderRadius: 14, padding: 13, fontFamily: 'Inter_400Regular', fontSize: 13 },
  inputHalf:      { flex: 1 },
  inputMultiline: { textAlignVertical: 'top', minHeight: 80 },

  // Date chips
  dateChip:       { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 62 },
  dateChipDow:    { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5, marginBottom: 4 },
  dateChipDay:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  // Time grid
  timeGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlot:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  timeSlotText:   { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  // Stepper
  stepperRow:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperBtn:     { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperValue:   { fontFamily: 'Inter_700Bold', fontSize: 22, minWidth: 28, textAlign: 'center' },
  stepperLabel:   { fontFamily: 'Inter_400Regular', fontSize: 13 },

  // Submit
  submitBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16 },
  submitBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 15 },

  // Success screen
  successWrap:    { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },
  successIcon:    { width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  successTitle:   { fontFamily: 'Inter_700Bold', fontSize: 24 },
  successSub:     { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  confirmCard:    { width: '100%', borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  confirmHeading: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 4 },
  confirmRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  confirmVal:     { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1, lineHeight: 18 },
  confirmDivider: { height: 1, marginVertical: 4 },
  noteText:       { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 10 },
  doneBtn:        { borderRadius: 14, paddingHorizontal: 48, paddingVertical: 14, marginTop: 4 },
  doneBtnText:    { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
