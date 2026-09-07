/**
 * Land Calculator Tab — OG Landmark
 * Unit Converter + Plot Area Calculator embedded inline.
 * Price Estimator / ROI / Agri link out to the full Tools screen.
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, View, Platform,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import {
  MARLA_SQFT, KANAL_SQFT, ACRE_SQFT,
} from '@/lib/plotCalculator';
import { getMobileSettings } from '@/lib/api';
import { PlotMeasurementCalculator } from '@/components/PlotMeasurementCalculator';

// ── Unit conversion data ──────────────────────────────────────────────────────
const CONV_UNITS = [
  { key: 'marla',  label: 'Marla',  toSqFt: (v: number) => v * MARLA_SQFT },
  { key: 'kanal',  label: 'Kanal',  toSqFt: (v: number) => v * KANAL_SQFT },
  { key: 'acre',   label: 'Acre',   toSqFt: (v: number) => v * ACRE_SQFT  },
  { key: 'sqft',   label: 'Sq.ft',  toSqFt: (v: number) => v              },
  { key: 'sqm',    label: 'Sq.m',   toSqFt: (v: number) => v * 10.7639   },
];

function formatNum(n: number, dp = 4): string {
  if (n === 0) return '0';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(dp).replace(/\.?0+$/, '');
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, colors,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; colors: any;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[lc.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[lc.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? '0'}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

function ChipRow({
  items, selected, onSelect, colors,
}: {
  items: string[]; selected: string; onSelect: (v: string) => void; colors: any;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 10 }}>
      {items.map((item) => {
        const active = item === selected;
        return (
          <Pressable key={item} onPress={() => onSelect(item)}
            style={[lc.chip, { backgroundColor: active ? colors.selectionBackground : colors.secondary, borderColor: active ? colors.selectionBorder : colors.border, borderWidth: active ? 1.5 : 1 }]}>
            <Text style={[lc.chipText, { color: active ? colors.selectionForeground : colors.foreground, fontWeight: active ? '600' : '400' }]}>{item}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SegRow({
  items, selected, onSelect, colors,
}: {
  items: { key: string; label: string }[];
  selected: string; onSelect: (k: string) => void; colors: any;
}) {
  return (
    <View style={[lc.seg, { backgroundColor: colors.secondary }]}>
      {items.map((it) => {
        const active = it.key === selected;
        return (
          <Pressable key={it.key} onPress={() => onSelect(it.key)}
            style={[lc.segBtn, { backgroundColor: active ? colors.selectionBackground : 'transparent', borderColor: active ? colors.selectionBorder : 'transparent', borderWidth: active ? 1.5 : 0 }]}>
            <Text style={[lc.segText, { color: active ? colors.selectionForeground : colors.mutedForeground, fontWeight: active ? '600' : '400' }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Card({
  title, icon, children, colors, accentColor,
}: {
  title: string; icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode; colors: any; accentColor?: string;
}) {
  const accent = accentColor ?? colors.action;
  return (
    <View style={[lc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={lc.cardHeader}>
        <View style={[lc.cardIcon, { backgroundColor: accent + '18' }]}>
          <Feather name={icon} size={15} color={accent} />
        </View>
        <Text style={[lc.cardTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── 1. Unit Converter ─────────────────────────────────────────────────────────

function UnitConverter({ colors }: { colors: any }) {
  const [fromUnit, setFromUnit] = useState<string>('marla');
  const [value,    setValue]    = useState('');

  const cu   = CONV_UNITS.find((u) => u.key === fromUnit) ?? CONV_UNITS[0];
  const num  = parseFloat(value);
  const sqft = !isNaN(num) && num > 0 ? cu.toSqFt(num) : 0;
  const rows = sqft > 0 ? [
    { label: 'Sq.ft',  val: formatNum(sqft,           2) },
    { label: 'Sq.m',   val: formatNum(sqft / 10.7639, 3) },
    { label: 'Marla',  val: formatNum(sqft / MARLA_SQFT, 4) },
    { label: 'Kanal',  val: formatNum(sqft / KANAL_SQFT, 4) },
    { label: 'Acre',   val: formatNum(sqft / ACRE_SQFT,  5) },
  ].filter((r) => r.label !== cu.label) : [];

  return (
    <Card title="Unit Converter" icon="refresh-cw" colors={colors}>
      <Text style={[lc.label, { color: colors.mutedForeground }]}>CONVERT FROM</Text>
      <ChipRow
        items={CONV_UNITS.map((u) => u.label)}
        selected={cu.label}
        onSelect={(l) => { setFromUnit(CONV_UNITS.find((u) => u.label === l)?.key ?? 'marla'); setValue(''); }}
        colors={colors}
      />
      <Field label={`VALUE (${cu.label})`} value={value} onChange={setValue} placeholder={`Enter ${cu.label}`} colors={colors} />
      {rows.length > 0 && (
        <View style={[lc.grid2, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {rows.map((r) => (
            <View key={r.label} style={[lc.cell2, { borderColor: colors.border }]}>
              <Text style={[lc.cellVal, { color: colors.foreground }]}>{r.val}</Text>
              <Text style={[lc.cellKey, { color: colors.mutedForeground }]}>{r.label}</Text>
            </View>
          ))}
        </View>
      )}
      {sqft > 0 && (
        <Text style={[lc.note, { color: colors.mutedForeground, marginTop: 6 }]}>
          1 Marla = 272.25 sq ft · 1 Kanal = 20 Marla · 1 Acre = 8 Kanal
        </Text>
      )}
    </Card>
  );
}

// ── Quick-link tiles to other tools ──────────────────────────────────────────

function QuickTool({
  icon, label, sub, toolKey, colors, router,
}: {
  icon: keyof typeof Feather.glyphMap; label: string; sub: string;
  toolKey: string; colors: any; router: any;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/tools', params: { tool: toolKey } } as any)}
      style={({ pressed }) => [lc.quickTile, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.84 : 1 }]}>
      <View style={[lc.quickIcon, { backgroundColor: colors.action + '14' }]}>
        <Feather name={icon} size={17} color={colors.action} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[lc.quickLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[lc.quickSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
      <Feather name="arrow-up-right" size={14} color={colors.action} />
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CalculatorScreen() {
  const colors       = useColors();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const topPad       = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const [content, setContent] = useState<any>(null);
  useEffect(() => {
    getMobileSettings().then((settings) => setContent(settings.content?.screens?.calculator)).catch(() => undefined);
  }, []);

  return (
    <ScrollView
      style={[lc.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: tabBarHeight + 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={lc.header}>
        <View>
          <Text style={[lc.eyebrow, { color: colors.action }]}>OG LANDMARK</Text>
          <Text style={[lc.headerTitle, { color: colors.foreground }]}>{content?.title || 'Land Calculator'}</Text>
        </View>
        <Pressable onPress={() => router.push('/tools' as any)}
          style={({ pressed }) => [lc.allToolsBtn, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="tool" size={13} color={colors.action} />
          <Text style={[lc.allToolsText, { color: colors.action }]}>All Tools</Text>
        </Pressable>
      </View>

      {/* ── Disclaimer ────────────────────────────────────────────────── */}
      <View style={[lc.banner, { backgroundColor: '#f59e0b0c', borderColor: '#f59e0b33', marginHorizontal: 18, marginBottom: 14 }]}>
        <Feather name="info" size={11} color="#d97706" />
        <Text style={[lc.note, { color: '#d97706', flex: 1, lineHeight: 15 }]}>
          Results are indicative only. Consult a verified OG Landmark agent for accurate valuations.
        </Text>
      </View>

      {/* ── Embedded calculators ──────────────────────────────────────── */}
      <View style={lc.sections}>
        {content?.showUnitConverter !== false && <UnitConverter colors={colors} />}
        {content?.showPlotArea !== false && <PlotMeasurementCalculator colors={colors} />}

        {/* ── More Tools ── */}
        {content?.showMoreTools !== false && <View style={[lc.moreSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[lc.moreTitle, { color: colors.foreground }]}>{content?.subtitle || 'More Property Tools'}</Text>
          <Text style={[lc.moreSub, { color: colors.mutedForeground }]}>Open the full tools screen for detailed estimates</Text>
          <View style={lc.quickList}>
            <QuickTool icon="trending-up" label="Price Estimator"
              sub="Market rates for 6 cities · 5 property types"
              toolKey="price" colors={colors} router={router} />
            <QuickTool icon="percent" label="ROI Calculator"
              sub="Investment yield, monthly income & returns"
              toolKey="roi" colors={colors} router={router} />
            <QuickTool icon="feather" label="Agricultural Intelligence"
              sub="8 farming & agri land terms explained"
              toolKey="agri" colors={colors} router={router} />
          </View>
        </View>}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const lc = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { paddingHorizontal: 18, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow:      { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.8, marginBottom: 4 },
  headerTitle:  { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.4 },
  allToolsBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  allToolsText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  banner:       { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 10 },
  sections:     { paddingHorizontal: 16, gap: 14 },
  // Card
  card:         { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle:    { fontFamily: 'Inter_700Bold', fontSize: 15 },
  // Inputs
  label:        { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8, marginBottom: 6 },
  input:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 13 },
  // Chip
  chip:         { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7 },
  chipText:     { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  // Seg
  seg:          { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn:       { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segText:      { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  // Grid
  grid2:        { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  cell2:        { width: '50%', alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderBottomWidth: 1 },
  cellVal:      { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 },
  cellKey:      { fontFamily: 'Inter_400Regular', fontSize: 9 },
  // Hint / error
  hintRow:      { flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: 10, padding: 9, marginBottom: 10 },
  errRow:       { flexDirection: 'row', gap: 6, alignItems: 'center' },
  note:         { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  resetBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginTop: 10 },
  // More section
  moreSection:  { borderRadius: 18, borderWidth: 1, padding: 16 },
  moreTitle:    { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  moreSub:      { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 14 },
  quickList:    { gap: 10 },
  quickTile:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 13 },
  quickIcon:    { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 2 },
  quickSub:     { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
});
