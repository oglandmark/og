import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Modal, Pressable, Share, StyleSheet, TextInput as NativeTextInput, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import {
  CALC_FIELDS, type CalcCorners, type CalcMode, type CalcResult, type CalcUnit,
  computePlotArea,
} from '@/lib/plotCalculator';
import {
  getMeasurements, saveMeasurement, deleteMeasurement, type SavedMeasurement,
} from '@/lib/measurementsStore';

type Colors = ReturnType<typeof useColors>;

const CORNERS: CalcCorners[] = [3, 4, 5, 6, 7, 8];
const MODES: { key: CalcMode; label: string }[] = [
  { key: 'basic', label: 'Basic Measurement' },
  { key: 'accurate', label: 'Accurate Irregular Plot' },
];

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en', { maximumFractionDigits: decimals });
}

function ResultCard({ result, colors }: { result: CalcResult; colors: Colors }) {
  const values = [
    ['Square Feet', formatNumber(result.sqft)],
    ['Square Yards', formatNumber(result.sqYards)],
    ['Square Meters', formatNumber(result.sqm)],
    ['Marla', formatNumber(result.marla, 3)],
    ['Kanal', formatNumber(result.kanal, 3)],
    ['Acre', formatNumber(result.acre, 4)],
  ];
  return (
    <View style={[styles.resultCard, { backgroundColor: colors.secondary, borderColor: colors.primary + '55' }]}>
      <View style={styles.resultHeading}>
        <Feather name="check-circle" size={15} color={colors.primary} />
        <Text style={[styles.resultTitle, { color: colors.primary }]}>AREA RESULT</Text>
      </View>
      <View style={styles.resultGrid}>
        {values.map(([label, value], index) => (
          <View key={label} style={[styles.resultCell, { backgroundColor: colors.card, borderColor: index === 0 ? colors.primary + '66' : colors.border }]}>
            <Text style={[styles.resultValue, { color: index === 0 ? colors.primary : colors.foreground }]}>{value}</Text>
            <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>
        {result.note || '1 Marla = 272.25 sq ft · 1 Kanal = 20 Marla · 1 Acre = 8 Kanal'}
      </Text>
    </View>
  );
}

function PlotDiagram({
  corners, unit, inputs, mode, colors,
}: {
  corners: CalcCorners; unit: CalcUnit; inputs: Record<string, string>; mode: CalcMode; colors: Colors;
}) {
  const points = useMemo(() => {
    const centerX = 160;
    const centerY = 102;
    const radiusX = 118;
    const radiusY = 75;
    return Array.from({ length: corners }, (_, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / corners;
      return { x: centerX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY };
    });
  }, [corners]);
  const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labelText = (key: string) => inputs[key] ? `${inputs[key]} ${unit}` : key;
  return (
    <View style={[styles.diagram, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <View style={styles.diagramHeader}>
        <View>
          <Text style={[styles.diagramTitle, { color: colors.foreground }]}>Plot outline</Text>
          <Text style={[styles.diagramSub, { color: colors.mutedForeground }]}>Measurements are shown around the boundary</Text>
        </View>
        <Feather name="maximize-2" size={15} color={colors.action} />
      </View>
      <Svg width="100%" height={218} viewBox="0 0 320 218">
        <Polygon points={pointString} fill={colors.action + '16'} stroke={colors.action} strokeWidth="2" />
        {mode === 'accurate' && corners > 3 && points.slice(2, -1).map((point, index) => (
          <Line key={`diagonal-${index}`} x1={points[0].x} y1={points[0].y} x2={point.x} y2={point.y}
            stroke={colors.action + '77'} strokeWidth="1.2" strokeDasharray="4 4" />
        ))}
        {points.map((point, index) => {
          const key = String.fromCharCode(65 + index);
          return (
            <React.Fragment key={key}>
              <Circle cx={point.x} cy={point.y} r="4.5" fill={colors.primary} />
              <SvgText x={point.x + (point.x < 160 ? -16 : 8)} y={point.y - 8}
                fill={colors.foreground} fontSize="11" fontWeight="700">{key}</SvgText>
            </React.Fragment>
          );
        })}
        {points.map((point, index) => {
          const next = points[(index + 1) % points.length]!;
          const key = String.fromCharCode(65 + index);
          const midX = (point.x + next.x) / 2;
          const midY = (point.y + next.y) / 2;
          return (
            <SvgText key={`label-${key}`} x={midX} y={midY - 5} textAnchor="middle"
              fill={colors.mutedForeground} fontSize="9">{labelText(key)}</SvgText>
          );
        })}
        {mode === 'accurate' && Array.from({ length: corners - 3 }, (_, index) => {
          const targetIndex = index + 2;
          const point = points[targetIndex]!;
          const x = (points[0].x + point.x) / 2;
          const y = (points[0].y + point.y) / 2;
          return <SvgText key={`diag-label-${targetIndex}`} x={x} y={y + 12} textAnchor="middle"
            fill={colors.action} fontSize="8">{labelText(`A${String.fromCharCode(67 + index)}`)}</SvgText>;
        })}
      </Svg>
    </View>
  );
}

function MeasurementField({
  field, value, label, onChange, onRename, colors, unit,
}: {
  field: (typeof CALC_FIELDS[3])[number]; value: string; label: string;
  onChange: (value: string) => void; onRename: (value: string) => void; colors: Colors; unit: CalcUnit;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  return (
    <View style={styles.fieldBox}>
      <View style={styles.fieldLabelRow}>
        {editingLabel && field.kind === 'side' ? (
          <NativeTextInput autoFocus value={label} onChangeText={onRename}
            onBlur={() => setEditingLabel(false)} onSubmitEditing={() => setEditingLabel(false)}
            style={[styles.renameInput, { color: colors.foreground, borderColor: colors.action }]} />
        ) : (
          <Pressable disabled={field.kind !== 'side'} onPress={() => setEditingLabel(true)} style={styles.labelButton}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
            {field.kind === 'side' && <Feather name="edit-2" size={10} color={colors.mutedForeground} />}
          </Pressable>
        )}
        <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>{field.hint}</Text>
      </View>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad"
        placeholder={`0.00 ${unit}`} placeholderTextColor={colors.mutedForeground + '88'}
        style={[styles.input, { backgroundColor: colors.background, borderColor: value ? colors.action + '66' : colors.border, color: colors.foreground }]} />
    </View>
  );
}

export function PlotMeasurementCalculator({
  colors: suppliedColors, compact = false,
}: { colors?: Colors; compact?: boolean }) {
  const hookColors = useColors();
  const colors = suppliedColors ?? hookColors;
  const { isLoggedIn } = useAuth();
  const [corners, setCorners] = useState<CalcCorners>(4);
  const [unit, setUnit] = useState<CalcUnit>('ft');
  const [mode, setMode] = useState<CalcMode>('basic');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedMeasurement[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (isLoggedIn) getMeasurements().then(setSaved).catch(() => setSaved([]));
    else setSaved([]);
  }, [isLoggedIn]);

  const fields = CALC_FIELDS[corners].filter((field) => mode === 'accurate' || field.kind === 'side');
  const updateField = (key: string, value: string) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
    setResult(null);
    setError('');
  };
  const reset = () => { setInputs({}); setLabels({}); setResult(null); setError(''); };
  const calculate = () => {
    const next = computePlotArea(corners, inputs, unit, mode);
    if (typeof next === 'string') { setResult(null); setError(next); return; }
    setError('');
    setResult(next);
  };
  const switchCorners = (value: CalcCorners) => { setCorners(value); reset(); };
  const switchUnit = (value: CalcUnit) => { setUnit(value); reset(); };
  const switchMode = (value: CalcMode) => { setMode(value); setResult(null); setError(''); };
  const saveCurrent = async () => {
    if (!isLoggedIn) {
      Alert.alert('Sign in required', 'Please sign in to save land measurements and reopen them later.');
      return;
    }
    if (!result) { Alert.alert('Calculate first', 'Enter your measurements and calculate the area before saving.'); return; }
    setSaveModalOpen(true);
  };
  const confirmSave = async () => {
    const name = saveName.trim();
    if (!name) { Alert.alert('Name required', 'Give this measurement a short name.'); return; }
    try {
      const item = await saveMeasurement({ name, corners, unit, mode, inputs, labels, result: result ?? undefined });
      setSaved((previous) => [item, ...previous]);
      setSaveName('');
      setSaveModalOpen(false);
      setHistoryOpen(true);
    } catch (saveError) {
      Alert.alert('Could not save', saveError instanceof Error ? saveError.message : 'Please try again.');
    }
  };
  const reopen = (item: SavedMeasurement) => {
    setCorners(item.corners); setUnit(item.unit); setMode(item.mode);
    setInputs(item.inputs || {}); setLabels(item.labels || {}); setResult(item.result || null);
    setError(''); setHistoryOpen(false);
  };
  const removeSaved = async (item: SavedMeasurement) => {
    try {
      await deleteMeasurement(item.id);
      setSaved((previous) => previous.filter((entry) => String(entry.id) !== String(item.id)));
    } catch (deleteError) {
      Alert.alert('Could not remove', deleteError instanceof Error ? deleteError.message : 'Please try again.');
    }
  };
  const shareResult = async () => {
    if (!result) { Alert.alert('Calculate first', 'Calculate an area before sharing the result.'); return; }
    const message = [
      'OG LANDMARK · LAND MEASUREMENT',
      `${corners}-sided plot · ${mode === 'accurate' ? 'Accurate' : 'Basic estimate'}`,
      `Area: ${formatNumber(result.sqft)} sq ft`,
      `Square yards: ${formatNumber(result.sqYards)} · Marla: ${formatNumber(result.marla, 3)} · Kanal: ${formatNumber(result.kanal, 3)}`,
      'Measure with confidence. Verify on-site with a qualified professional.',
      'oglandmark.com',
    ].join('\n');
    await Share.share({ title: 'OG Landmark land measurement', message });
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.action + '18' }]}>
          <Feather name="grid" size={16} color={colors.action} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Land Plot Calculator</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>3 to 8 sides · feet or meters</Text>
        </View>
        <Pressable onPress={() => setHistoryOpen((open) => !open)} hitSlop={8}>
          <Feather name="clock" size={18} color={colors.action} />
        </Pressable>
      </View>

      <View style={[styles.body, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NUMBER OF SIDES</Text>
        <View style={styles.chipRow}>
          {CORNERS.map((value) => (
            <Pressable key={value} onPress={() => switchCorners(value)}
              style={[styles.chip, { backgroundColor: value === corners ? colors.selectionBackground : colors.secondary, borderColor: value === corners ? colors.selectionBorder : colors.border, borderWidth: value === corners ? 2 : 1 }]}>
              <Text style={[styles.chipText, { color: value === corners ? colors.selectionForeground : colors.foreground, fontWeight: value === corners ? '600' : '400' }]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.selectorRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>INPUT UNIT</Text>
            <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
              {(['ft', 'm'] as CalcUnit[]).map((value) => (
                <Pressable key={value} onPress={() => switchUnit(value)} style={[styles.segmentButton, value === unit && { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 }]}>
                  <Text style={[styles.segmentText, { color: value === unit ? colors.selectionForeground : colors.mutedForeground, fontWeight: value === unit ? '600' : '400' }]}>{value === 'ft' ? 'Feet' : 'Meters'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CALCULATION MODE</Text>
        <View style={[styles.modeRow, { backgroundColor: colors.secondary }]}>
          {MODES.map((item) => (
            <Pressable key={item.key} onPress={() => switchMode(item.key)} style={[styles.modeButton, mode === item.key && { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 }]}>
              <Text style={[styles.modeText, { color: mode === item.key ? colors.selectionForeground : colors.mutedForeground, fontWeight: mode === item.key ? '600' : '400' }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={12} color={colors.action} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            {mode === 'basic'
              ? corners === 3 ? 'Valid triangle sides are exact; other values receive an approximate estimate.' : 'Basic mode uses all entered sides for an estimate. Accurate irregular plots need diagonals.'
              : corners === 3 ? 'Valid triangle sides are exact; other values receive an approximate estimate.' : `Enter boundary sides plus ${corners - 3} diagonal${corners - 3 > 1 ? 's' : ''} from corner A for accurate triangulation.`}
          </Text>
        </View>

        {!compact && <PlotDiagram corners={corners} unit={unit} inputs={inputs} mode={mode} colors={colors} />}
        <View style={styles.fieldsGrid}>
          {fields.map((field) => (
            <MeasurementField key={field.key} field={field} value={inputs[field.key] || ''}
              label={labels[field.key] || field.label} onChange={(value) => updateField(field.key, value)}
              onRename={(value) => setLabels((previous) => ({ ...previous, [field.key]: value }))}
              colors={colors} unit={unit} />
          ))}
        </View>

        {!!error && <View style={styles.errorRow}><Feather name="alert-circle" size={13} color="#dc2626" /><Text style={styles.errorText}>{error}</Text></View>}
        <View style={styles.actionRow}>
          <Pressable onPress={reset} style={[styles.secondaryButton, { borderColor: colors.border }]}><Feather name="trash-2" size={14} color={colors.mutedForeground} /><Text style={[styles.buttonText, { color: colors.mutedForeground }]}>Clear All</Text></Pressable>
          <Pressable onPress={calculate} style={[styles.primaryButton, { backgroundColor: colors.action }]}><Feather name="check" size={14} color={colors.actionForeground} /><Text style={[styles.buttonText, { color: colors.actionForeground }]}>Calculate Area</Text></Pressable>
        </View>

        {result && <ResultCard result={result} colors={colors} />}
        {result && <View style={styles.actionRow}>
          <Pressable onPress={saveCurrent} style={[styles.secondaryButton, { flex: 1, borderColor: colors.border }]}><Feather name="bookmark" size={14} color={colors.action} /><Text style={[styles.buttonText, { color: colors.action }]}>Save Measurement</Text></Pressable>
          <Pressable onPress={shareResult} style={[styles.secondaryButton, { flex: 1, borderColor: colors.border }]}><Feather name="share-2" size={14} color={colors.action} /><Text style={[styles.buttonText, { color: colors.action }]}>Share Result</Text></Pressable>
        </View>}

        {historyOpen && (
          <View style={[styles.history, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <View style={styles.historyHeader}><Text style={[styles.historyTitle, { color: colors.foreground }]}>Saved measurements</Text><Text style={[styles.historyCount, { color: colors.mutedForeground }]}>{saved.length}</Text></View>
            {!isLoggedIn && <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>Sign in to save and reopen measurements.</Text>}
            {isLoggedIn && saved.length === 0 && <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>No saved measurements yet.</Text>}
            {saved.slice(0, 8).map((item) => (
              <View key={String(item.id)} style={[styles.historyItem, { borderTopColor: colors.border }]}>
                <Pressable onPress={() => reopen(item)} style={{ flex: 1 }}>
                  <Text style={[styles.historyName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>{item.corners} sides · {item.unit === 'ft' ? 'Feet' : 'Meters'} · {item.result ? `${formatNumber(item.result.sqft)} sq ft` : 'Saved draft'}</Text>
                </Pressable>
                <Pressable onPress={() => removeSaved(item)} hitSlop={8}><Feather name="x" size={15} color={colors.mutedForeground} /></Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={saveModalOpen} transparent animationType="fade" onRequestClose={() => setSaveModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Save measurement</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Give this plot a name so you can reopen it later.</Text>
            <NativeTextInput autoFocus value={saveName} onChangeText={setSaveName} placeholder="e.g. House plot - DHA"
              placeholderTextColor={colors.mutedForeground} style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]} />
            <View style={styles.actionRow}>
              <Pressable onPress={() => setSaveModalOpen(false)} style={[styles.secondaryButton, { flex: 1, borderColor: colors.border }]}><Text style={[styles.buttonText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable>
              <Pressable onPress={confirmSave} style={[styles.primaryButton, { flex: 1, backgroundColor: colors.action }]}><Text style={[styles.buttonText, { color: colors.actionForeground }]}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
  body: { borderTopWidth: 1, padding: 16, gap: 12 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1, marginBottom: -5 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { minWidth: 37, paddingVertical: 9, borderRadius: 11, borderWidth: 1, alignItems: 'center' },
  chipText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  selectorRow: { flexDirection: 'row', gap: 10 },
  segment: { flexDirection: 'row', borderRadius: 11, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 8 },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  modeRow: { flexDirection: 'row', borderRadius: 11, padding: 3 },
  modeButton: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  modeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  infoBox: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 11, padding: 10 },
  infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  diagram: { borderWidth: 1, borderRadius: 16, padding: 10, marginTop: 2 },
  diagramHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  diagramTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  diagramSub: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldBox: { width: '47.5%' },
  fieldLabelRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  labelButton: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 9 },
  renameInput: { flex: 1, borderBottomWidth: 1, paddingVertical: 0, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  errorText: { flex: 1, color: '#dc2626', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingVertical: 12 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 10 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  resultCard: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  resultTitle: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  resultCell: { width: '31.8%', borderWidth: 1, borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  resultValue: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 3 },
  resultLabel: { fontFamily: 'Inter_500Medium', fontSize: 8, textAlign: 'center' },
  resultNote: { fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 13, textAlign: 'center' },
  history: { borderWidth: 1, borderRadius: 14, padding: 10 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  historyTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  historyCount: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  emptyHistory: { fontFamily: 'Inter_400Regular', fontSize: 10, paddingVertical: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 9, marginTop: 6 },
  historyName: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  historyMeta: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000088' },
  modalCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 10 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  modalSub: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  modalInput: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 13 },
});