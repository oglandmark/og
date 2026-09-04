/**
 * Developer — Add / Edit Unit
 * URL: /developer/add-unit?projectId=xxx&blockId=xxx&blockName=xxx[&unitId=xxx]
 * When unitId is present, loads existing unit for editing.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  InventoryUnit, UnitStatus, UnitType,
  UNIT_TYPES, UNIT_STATUSES, PLOT_SIZES, FACINGS,
  getUnits, saveUnit, newUnitId, unitStatusColor,
} from '@/lib/inventoryStore';

// ── Field components ──────────────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType, colors, optional,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  colors: ReturnType<typeof useColors>;
  optional?: boolean;
}) {
  return (
    <View style={f.wrap}>
      <View style={f.labelRow}>
        <Text style={[f.label, { color: colors.mutedForeground }]}>{label}</Text>
        {optional && <Text style={[f.optional, { color: colors.mutedForeground }]}> (optional)</Text>}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground + '77'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? 'default'}
        style={[
          f.input,
          { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground },
          multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 },
        ]}
      />
    </View>
  );
}

function ChipSelect({
  label, options, selected, onSelect, colors,
}: {
  label: string; options: string[]; selected: string;
  onSelect: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={f.wrap}>
      <Text style={[f.label, { color: colors.mutedForeground }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {options.map((opt) => {
          const active = opt === selected;
          return (
            <Pressable key={opt} onPress={() => onSelect(opt)}
              style={[f.chip, {
                borderColor: active ? colors.action : colors.border,
                backgroundColor: active ? colors.action + '15' : colors.secondary,
              }]}>
              <Text style={[f.chipText, { color: active ? colors.action : colors.mutedForeground }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ToggleRow({
  label, value, onToggle, colors,
}: {
  label: string; value: boolean; onToggle: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[f.toggleRow, { borderColor: colors.border }]}>
      <Text style={[f.label, { color: colors.foreground }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.action + '88' }}
        thumbColor={value ? colors.action : colors.mutedForeground}
      />
    </View>
  );
}

// ── Blank unit ────────────────────────────────────────────────────────────────
function blankUnit(projectId: string, blockId: string): InventoryUnit {
  const now = new Date().toISOString();
  return {
    id: newUnitId(),
    projectId,
    blockId,
    unitNumber: '',
    type: 'Residential Plot',
    status: 'Available',
    price: 0,
    size: '5 Marla',
    floor: '',
    bedrooms: undefined,
    bathrooms: undefined,
    street: '',
    facing: '',
    isCorner: false,
    isParkFacing: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AddUnitScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projectId, blockId, blockName, unitId } = useLocalSearchParams<{
    projectId: string; blockId: string; blockName: string; unitId?: string;
  }>();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const isEditing = Boolean(unitId);

  const [unit,       setUnitRaw]   = useState<InventoryUnit>(() => blankUnit(projectId ?? '', blockId ?? ''));
  // sizeChip: which chip is visually selected ('5 Marla', 'Custom', etc.)
  // customSize: the free-text value shown in the custom input when sizeChip === 'Custom'
  const [sizeChip,   setSizeChip]   = useState<string>('5 Marla');
  const [customSize, setCustomSize] = useState('');
  const [saving,     setSaving]    = useState(false);
  const [errors,     setErrors]    = useState<Record<string, string>>({});

  const set = (partial: Partial<InventoryUnit>) => setUnitRaw((prev) => ({ ...prev, ...partial }));

  // Load existing unit when editing
  useEffect(() => {
    if (!unitId || !projectId) return;
    void getUnits(projectId).then((all) => {
      const found = all.find((u) => u.id === unitId);
      if (found) {
        setUnitRaw(found);
        // Restore chip / custom-size state from saved value
        const presets: string[] = [...PLOT_SIZES];
        if (presets.includes(found.size)) {
          setSizeChip(found.size);
        } else {
          setSizeChip('Custom');
          setCustomSize(found.size);
        }
      }
    });
  }, [unitId, projectId]);

  const sc = unitStatusColor(unit.status);
  const showApartmentFields = unit.type === 'Flat / Apartment' || unit.type === 'House';
  const showPlotSizes = unit.type === 'Residential Plot' || unit.type === 'Commercial Plot' || unit.type === 'Farmhouse';

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!unit.unitNumber.trim()) e.unitNumber = 'Unit number / plot number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Resolve the actual size: if chip is 'Custom', use the free-text customSize value
      const resolvedSize = showPlotSizes && sizeChip === 'Custom' ? customSize : unit.size;
      await saveUnit({ ...unit, size: resolvedSize, updatedAt: new Date().toISOString() });
      void router.back();
    } catch {
      Alert.alert('Error', 'Failed to save unit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[w.root, { backgroundColor: colors.background }]}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={[w.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={w.backBtn}>
            <Feather name="arrow-left" size={21} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[w.eyebrow, { color: colors.action }]}>{blockName ?? 'Block'}</Text>
            <Text style={[w.title, { color: colors.foreground }]}>{isEditing ? 'Edit Unit' : 'Add Unit'}</Text>
          </View>
          {isEditing && (
            <View style={[w.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[w.statusText, { color: sc.text }]}>{unit.status}</Text>
            </View>
          )}
        </View>

        {/* ── Form ─────────────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: botPad + 120, gap: 18 }}
        >
          {/* Unit Number */}
          <View style={f.wrap}>
            <Text style={[f.label, { color: colors.mutedForeground }]}>Unit / Plot Number *</Text>
            <TextInput
              value={unit.unitNumber}
              onChangeText={(v) => { set({ unitNumber: v }); if (errors.unitNumber) setErrors({}); }}
              placeholder="e.g. A-101 or Plot 23"
              placeholderTextColor={colors.mutedForeground + '77'}
              style={[f.input, { backgroundColor: colors.secondary, borderColor: errors.unitNumber ? colors.destructive : colors.border, color: colors.foreground }]}
            />
            {errors.unitNumber ? <Text style={[f.error, { color: colors.destructive }]}>{errors.unitNumber}</Text> : null}
          </View>

          {/* Type */}
          <ChipSelect label="Unit Type" options={UNIT_TYPES} selected={unit.type}
            onSelect={(v) => set({ type: v as UnitType })} colors={colors} />

          {/* Status */}
          <View style={f.wrap}>
            <Text style={[f.label, { color: colors.mutedForeground }]}>Status</Text>
            <View style={f.statusRow}>
              {UNIT_STATUSES.map((st) => {
                const active = unit.status === st;
                const stColor = unitStatusColor(st);
                return (
                  <Pressable key={st} onPress={() => set({ status: st as UnitStatus })}
                    style={[f.statusChip, {
                      borderColor:     active ? stColor.text : colors.border,
                      backgroundColor: active ? stColor.bg  : colors.secondary,
                    }]}>
                    <Text style={[f.statusChipText, { color: active ? stColor.text : colors.mutedForeground }]}>{st}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Price */}
          <Field label="Price (PKR)" value={unit.price > 0 ? String(unit.price) : ''}
            onChangeText={(v) => set({ price: Number(v) || 0 })}
            placeholder="e.g. 3500000" keyboardType="numeric" colors={colors} optional />

          {/* Size */}
          {showPlotSizes ? (
            <ChipSelect
              label="Plot Size"
              options={[...PLOT_SIZES]}
              selected={sizeChip}
              onSelect={(v) => {
                setSizeChip(v);
                // For preset sizes, update unit.size immediately; for Custom keep unit.size as-is
                if (v !== 'Custom') set({ size: v });
              }}
              colors={colors}
            />
          ) : (
            <Field label="Size / Area" value={unit.size}
              onChangeText={(v) => set({ size: v })}
              placeholder="e.g. 1200 sqft" colors={colors} optional />
          )}

          {/* Custom size text input — only shown when Custom chip is selected */}
          {showPlotSizes && sizeChip === 'Custom' && (
            <Field
              label="Custom Size"
              value={customSize}
              onChangeText={setCustomSize}
              placeholder="e.g. 4.5 Marla"
              colors={colors}
            />
          )}

          {/* Apartment / House fields */}
          {showApartmentFields && (
            <>
              <Field label="Floor" value={unit.floor ?? ''}
                onChangeText={(v) => set({ floor: v })}
                placeholder="e.g. 3" keyboardType="numeric" colors={colors} optional />
              <Field label="Bedrooms" value={unit.bedrooms ? String(unit.bedrooms) : ''}
                onChangeText={(v) => set({ bedrooms: Number(v) || undefined })}
                placeholder="e.g. 3" keyboardType="numeric" colors={colors} optional />
              <Field label="Bathrooms" value={unit.bathrooms ? String(unit.bathrooms) : ''}
                onChangeText={(v) => set({ bathrooms: Number(v) || undefined })}
                placeholder="e.g. 2" keyboardType="numeric" colors={colors} optional />
            </>
          )}

          {/* Street */}
          <Field label="Street" value={unit.street ?? ''}
            onChangeText={(v) => set({ street: v })}
            placeholder="e.g. Street 5" colors={colors} optional />

          {/* Facing */}
          <ChipSelect label="Facing (optional)" options={FACINGS}
            selected={unit.facing ?? ''} onSelect={(v) => set({ facing: v === unit.facing ? '' : v })} colors={colors} />

          {/* Toggles */}
          <View style={[f.toggleWrap, { borderColor: colors.border }]}>
            <ToggleRow label="Corner Plot / Unit" value={unit.isCorner}
              onToggle={(v) => set({ isCorner: v })} colors={colors} />
            <View style={[f.divider, { backgroundColor: colors.border }]} />
            <ToggleRow label="Park Facing" value={unit.isParkFacing}
              onToggle={(v) => set({ isParkFacing: v })} colors={colors} />
          </View>

          {/* Notes */}
          <Field label="Notes / Remarks" value={unit.notes ?? ''}
            onChangeText={(v) => set({ notes: v })}
            placeholder="Any additional notes..." multiline colors={colors} optional />
        </ScrollView>

        {/* ── Footer ───────────────────────────────────────────── */}
        <View style={[w.footer, { paddingBottom: botPad + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable
            onPress={() => { void handleSave(); }}
            disabled={saving}
            style={[w.saveBtn, { backgroundColor: saving ? colors.muted : colors.action }]}
          >
            <Feather name={isEditing ? 'check' : 'plus'} size={16} color="#fff" />
            <Text style={w.saveBtnText}>{saving ? 'Saving...' : (isEditing ? 'Update Unit' : 'Add Unit')}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Field styles ──────────────────────────────────────────────────────────────
const f = StyleSheet.create({
  wrap:        { gap: 6 },
  labelRow:    { flexDirection: 'row', alignItems: 'baseline' },
  label:       { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  optional:    { fontFamily: 'Inter_400Regular', fontSize: 11 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  error:       { fontFamily: 'Inter_400Regular', fontSize: 11 },
  chip:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:    { fontFamily: 'Inter_500Medium', fontSize: 12 },
  statusRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip:  { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 7 },
  statusChipText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  toggleWrap:  { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  divider:     { height: 1 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const w = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:    { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:    { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:      { fontFamily: 'Inter_700Bold', fontSize: 17 },
  statusPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  footer:     { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15 },
  saveBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },
});
