/**
 * Developer Portal — Payment Plan Management
 * Create installment plans for projects. Auto-calculates totals.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
// BlurView removed — crashes Android GPU
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  PaymentPlan, calcPlanSummary, fmtPKR, newPlanId,
  getPaymentPlans, savePaymentPlan, deletePaymentPlan,
} from '@/lib/paymentPlanStore';
import { getDevProjects } from '@/lib/developerStore';

// ── Number field helper ───────────────────────────────────────────────────────
function numField(val: number): string {
  return val > 0 ? String(val) : '';
}

function parseNum(s: string): number {
  return Math.max(0, Number(s.replace(/[^0-9.]/g, '')) || 0);
}

// ── Blank plan ────────────────────────────────────────────────────────────────
function blankPlan(developerId: string, projectId = '', projectName = ''): PaymentPlan {
  const now = new Date().toISOString();
  return {
    id: newPlanId(), developerId, projectId, projectName,
    planName: '', unitType: '',
    totalPrice: 0, bookingAmount: 0, downPayment: 0,
    confirmationAmount: 0, monthlyInstallment: 0,
    quarterlyInstallment: 0, installmentCount: 36,
    possessionCharges: 0, developmentCharges: 0, otherCharges: 0,
    createdAt: now, updatedAt: now,
  };
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan, colors, tr, onDelete,
}: {
  plan: PaymentPlan;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  tr: ReturnType<typeof useLanguage>['tr'];
  onDelete: () => void;
}) {
  const summary = calcPlanSummary(plan);
  const [open, setOpen] = useState(false);

  const breakdown = [
    { label: 'Booking Amount',         value: plan.bookingAmount },
    { label: 'Down Payment',           value: plan.downPayment },
    { label: 'Confirmation Amount',    value: plan.confirmationAmount },
    { label: 'Possession Charges',     value: plan.possessionCharges },
    { label: 'Development Charges',    value: plan.developmentCharges },
    { label: 'Other Charges',          value: plan.otherCharges },
    { label: `Monthly × ${plan.installmentCount}`, value: plan.monthlyInstallment },
  ].filter((r) => r.value > 0);

  return (
    <View style={[pc.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />

      {/* Header */}
      <View style={pc.header}>
        <View style={[pc.icon, { backgroundColor: colors.action + '18' }]}>
          <Feather name="credit-card" size={18} color={colors.action} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pc.planName, { color: colors.foreground }]} numberOfLines={1}>{plan.planName || 'Unnamed Plan'}</Text>
          <Text style={[pc.unitType, { color: colors.mutedForeground }]}>{plan.unitType}</Text>
          {plan.projectName ? (
            <Text style={[pc.projName, { color: colors.action }]}>{plan.projectName}</Text>
          ) : null}
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Text style={[pc.totalPrice, { color: colors.foreground }]}>PKR {fmtPKR(plan.totalPrice)}</Text>
          <Pressable onPress={() => setOpen(!open)} hitSlop={10}>
            <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Quick summary chips */}
      <View style={pc.chipRow}>
        <View style={[pc.chip, { backgroundColor: colors.action + '12' }]}>
          <Text style={[pc.chipLabel, { color: colors.mutedForeground }]}>Booking</Text>
          <Text style={[pc.chipValue, { color: colors.action }]}>PKR {fmtPKR(plan.bookingAmount)}</Text>
        </View>
        <View style={[pc.chip, { backgroundColor: '#1a6b3a12' }]}>
          <Text style={[pc.chipLabel, { color: colors.mutedForeground }]}>Monthly</Text>
          <Text style={[pc.chipValue, { color: '#1a6b3a' }]}>PKR {fmtPKR(plan.monthlyInstallment)}</Text>
        </View>
        <View style={[pc.chip, { backgroundColor: colors.secondary }]}>
          <Text style={[pc.chipLabel, { color: colors.mutedForeground }]}>× {plan.installmentCount}</Text>
          <Text style={[pc.chipValue, { color: colors.foreground }]}>months</Text>
        </View>
      </View>

      {/* Expanded breakdown */}
      {open && (
        <View style={[pc.breakdown, { borderTopColor: colors.border }]}>
          <Text style={[pc.calcLabel, { color: colors.mutedForeground }]}>{tr('autoCalcLabel')}</Text>

          {breakdown.map((r) => (
            <View key={r.label} style={[pc.breakRow, { borderBottomColor: colors.border }]}>
              <Text style={[pc.breakLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
              <Text style={[pc.breakValue, { color: colors.foreground }]}>PKR {fmtPKR(r.value)}</Text>
            </View>
          ))}

          <View style={[pc.breakRow, { borderBottomColor: colors.border }]}>
            <Text style={[pc.breakLabel, { color: colors.mutedForeground }]}>{tr('planCalcFixed')}</Text>
            <Text style={[pc.breakValue, { color: colors.foreground }]}>PKR {fmtPKR(summary.totalFixed)}</Text>
          </View>
          <View style={[pc.breakRow, { borderBottomColor: colors.border }]}>
            <Text style={[pc.breakLabel, { color: colors.mutedForeground }]}>{tr('planCalcInstTotal')}</Text>
            <Text style={[pc.breakValue, { color: '#1a6b3a' }]}>PKR {fmtPKR(summary.totalInstallments)}</Text>
          </View>
          <View style={pc.breakRow}>
            <Text style={[pc.breakLabel, { color: colors.mutedForeground, fontFamily: 'Inter_700Bold' }]}>{tr('planTotalPrice')}</Text>
            <Text style={[pc.breakValue, { color: colors.action, fontFamily: 'Inter_700Bold' }]}>PKR {fmtPKR(plan.totalPrice)}</Text>
          </View>

          <Pressable onPress={onDelete} style={[pc.deleteBtn, { borderColor: '#dc262633' }]}>
            <Feather name="trash-2" size={12} color="#dc2626" />
            <Text style={[pc.deleteBtnText, { color: '#dc2626' }]}>Delete Plan</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PaymentPlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr } = useLanguage();
  const router = useRouter();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [plans, setPlans]         = useState<PaymentPlan[]>([]);
  const [projectNames, setProjectNames] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState<PaymentPlan>(() => blankPlan(user?.id ?? ''));

  const setF = (partial: Partial<PaymentPlan>) => setForm((prev) => ({ ...prev, ...partial }));

  useFocusEffect(useCallback(() => {
    void getPaymentPlans(user?.id ?? '').then(setPlans);
    void getDevProjects(user?.id ?? '').then((p) => setProjectNames(p.map((x) => ({ id: x.id, name: x.name }))));
  }, [user?.id]));

  const reload = () => void getPaymentPlans(user?.id ?? '').then(setPlans);

  const handleSave = async () => {
    if (!form.planName.trim()) { Alert.alert('', 'Plan name is required.'); return; }
    if (form.totalPrice <= 0) { Alert.alert('', 'Enter a valid total price.'); return; }
    setSaving(true);
    await savePaymentPlan({ ...form, updatedAt: new Date().toISOString() });
    setShowForm(false);
    setForm(blankPlan(user?.id ?? ''));
    reload();
    setSaving(false);
    Alert.alert('', tr('planSavedMsg'));
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Plan?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePaymentPlan(id); reload(); } },
    ]);
  };

  // Live auto-calculation from form
  const liveCalc = calcPlanSummary(form);

  // Fields for the form
  const numFields: { key: keyof PaymentPlan; label: string; hint?: string }[] = [
    { key: 'totalPrice',         label: tr('planTotalPrice') },
    { key: 'bookingAmount',      label: tr('planBookingAmount') },
    { key: 'downPayment',        label: tr('planDownPayment') },
    { key: 'confirmationAmount', label: tr('planConfirmAmount') },
    { key: 'monthlyInstallment', label: tr('planMonthlyInst') },
    { key: 'installmentCount',   label: tr('planInstCount'), hint: 'e.g. 36' },
    { key: 'quarterlyInstallment',label: tr('planQuarterlyInst') },
    { key: 'possessionCharges',  label: tr('planPossessionCharges') },
    { key: 'developmentCharges', label: tr('planDevCharges') },
    { key: 'otherCharges',       label: tr('planOtherCharges') },
  ];

  return (
    <View style={[pp.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ────────────────────────────────────── */}
        <AnimatedReveal>
          <View style={[pp.header, { paddingTop: topPad + 12, paddingHorizontal: 20 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[pp.backBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[pp.eyebrow, { color: colors.action }]}>DEVELOPER PORTAL</Text>
              <Text style={[pp.title, { color: colors.foreground }]}>{tr('paymentPlansTitle')}</Text>
            </View>
            <Pressable onPress={() => { setShowForm(!showForm); setForm(blankPlan(user?.id ?? '')); }}
              style={[pp.addBtn, { backgroundColor: showForm ? colors.secondary : colors.action }]}>
              <Feather name={showForm ? 'x' : 'plus'} size={14} color={showForm ? colors.foreground : '#ffffff'} />
              <Text style={[pp.addBtnText, { color: showForm ? colors.foreground : '#ffffff' }]}>
                {showForm ? 'Cancel' : tr('addPaymentPlanBtn')}
              </Text>
            </Pressable>
          </View>
          <Text style={[pp.subtitle, { color: colors.mutedForeground, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 }]}>
            {tr('paymentPlansSubtitle')} · {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
          </Text>
        </AnimatedReveal>

        {/* ── Create form ───────────────────────────────── */}
        {showForm && (
          <AnimatedReveal delay={40}>
            <View style={[pp.formCard, { backgroundColor: colors.card, borderColor: colors.action + '44', marginHorizontal: 20, marginBottom: 24 }]}>
              <Text style={[pp.formTitle, { color: colors.foreground }]}>{tr('createPlanTitle')}</Text>

              {/* Project select */}
              {projectNames.length > 0 && (
                <View style={pp.fWrap}>
                  <Text style={[pp.fLabel, { color: colors.mutedForeground }]}>{tr('planForProject')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {projectNames.map((p) => (
                      <Pressable key={p.id} onPress={() => setF({ projectId: p.id, projectName: p.name })}
                        style={[pp.chip, { borderColor: form.projectId === p.id ? colors.action : colors.border, backgroundColor: form.projectId === p.id ? colors.action + '15' : colors.secondary }]}>
                        <Text style={[pp.chipText, { color: form.projectId === p.id ? colors.action : colors.mutedForeground }]}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Text fields */}
              {[
                { key: 'planName', label: tr('planNameField'), placeholder: 'e.g. 5 Marla – 3 Year Plan' },
                { key: 'unitType', label: tr('planUnitType'), placeholder: 'e.g. 5 Marla Plot' },
              ].map((f) => (
                <View key={f.key} style={pp.fWrap}>
                  <Text style={[pp.fLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                  <TextInput
                    value={(form as Record<string, unknown>)[f.key] as string}
                    onChangeText={(v) => setF({ [f.key]: v } as Partial<PaymentPlan>)}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.mutedForeground + '77'}
                    style={[pp.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
              ))}

              {/* Numeric fields */}
              {numFields.map((f) => (
                <View key={f.key} style={pp.fWrap}>
                  <Text style={[pp.fLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                  <TextInput
                    value={numField((form as Record<string, unknown>)[f.key] as number)}
                    onChangeText={(v) => setF({ [f.key]: parseNum(v) } as Partial<PaymentPlan>)}
                    keyboardType="numeric"
                    placeholder={f.hint ?? 'PKR amount'}
                    placeholderTextColor={colors.mutedForeground + '77'}
                    style={[pp.fInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
              ))}

              {/* Live auto-calculation */}
              <View style={[pp.calcBox, { backgroundColor: colors.action + '10', borderColor: colors.action + '33' }]}>
                <Text style={[pp.calcTitle, { color: colors.action }]}>{tr('autoCalcLabel')}</Text>
                {[
                  { label: tr('planCalcFixed'),    value: liveCalc.totalFixed },
                  { label: tr('planCalcInstTotal'), value: liveCalc.totalInstallments },
                  { label: tr('planTotalPrice'),    value: form.totalPrice },
                  { label: tr('planCalcRemaining'), value: liveCalc.remaining },
                ].map((row) => (
                  <View key={row.label} style={pp.calcRow}>
                    <Text style={[pp.calcLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                    <Text style={[pp.calcValue, { color: colors.foreground }]}>PKR {fmtPKR(row.value)}</Text>
                  </View>
                ))}
              </View>

              <Pressable onPress={() => { void handleSave(); }} disabled={saving}
                style={[pp.saveBtn, { backgroundColor: colors.action }]}>
                <Feather name="check" size={16} color="#ffffff" />
                <Text style={pp.saveBtnText}>{saving ? 'Saving...' : tr('savePlanBtn')}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        )}

        {/* ── Plan list / empty state ───────────────────── */}
        {plans.length === 0 && !showForm ? (
          <AnimatedReveal delay={80}>
            <View style={[pp.emptyWrap, { borderColor: colors.border, marginHorizontal: 20, marginTop: 16 }]}>
              <View style={[pp.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="credit-card" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={[pp.emptyTitle, { color: colors.foreground }]}>{tr('noPlansYet')}</Text>
              <Text style={[pp.emptyDesc, { color: colors.mutedForeground }]}>{tr('noPlansDesc')}</Text>
              <Pressable onPress={() => setShowForm(true)} style={[pp.emptyBtn, { backgroundColor: colors.action }]}>
                <Feather name="plus" size={14} color="#ffffff" />
                <Text style={pp.emptyBtnText}>{tr('addPaymentPlanBtn')}</Text>
              </Pressable>
            </View>
          </AnimatedReveal>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {plans.map((plan, i) => (
              <AnimatedReveal key={plan.id} delay={60 + i * 50}>
                <PlanCard
                  plan={plan} colors={colors} tr={tr}
                  onDelete={() => handleDelete(plan.id)}
                />
              </AnimatedReveal>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Plan card styles ──────────────────────────────────────────────────────────
const pc = StyleSheet.create({
  wrap:       { borderWidth: 1, borderRadius: 18, padding: 16, overflow: 'hidden', gap: 12 },
  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planName:   { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 2 },
  unitType:   { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 2 },
  projName:   { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  totalPrice: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  chipRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:       { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  chipLabel:  { fontFamily: 'Inter_400Regular', fontSize: 9, marginBottom: 1 },
  chipValue:  { fontFamily: 'Inter_700Bold', fontSize: 13 },
  breakdown:  { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  calcLabel:  { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 4 },
  breakRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  breakLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  breakValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  deleteBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 10, marginTop: 4 },
  deleteBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const pp = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  backBtn:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:       { fontFamily: 'Inter_700Bold', fontSize: 22 },
  subtitle:    { fontFamily: 'Inter_400Regular', fontSize: 12 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  formCard:    { borderWidth: 1.5, borderRadius: 18, padding: 18, gap: 14 },
  formTitle:   { fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 4 },
  fWrap:       { gap: 6 },
  fLabel:      { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  fInput:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  chip:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipText:    { fontFamily: 'Inter_500Medium', fontSize: 12 },
  calcBox:     { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  calcTitle:   { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 4 },
  calcRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  calcLabel:   { fontFamily: 'Inter_400Regular', fontSize: 12 },
  calcValue:   { fontFamily: 'Inter_700Bold', fontSize: 13 },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  emptyWrap:   { borderWidth: 1, borderRadius: 18, padding: 36, alignItems: 'center', gap: 12, borderStyle: 'dashed' },
  emptyIcon:   { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:  { fontFamily: 'Inter_700Bold', fontSize: 17, textAlign: 'center' },
  emptyDesc:   { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 8 },
  emptyBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
});
