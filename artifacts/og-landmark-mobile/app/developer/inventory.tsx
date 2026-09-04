/**
 * Developer — Inventory Management
 * Shows blocks and units for a given project.
 * Navigate here from project card → "Inventory" button.
 * URL: /developer/inventory?projectId=xxx&projectName=xxx
 */
import React, { useCallback, useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import {
  InventoryBlock, InventoryUnit, InventoryStats,
  getBlocks, getUnits, saveBlock, deleteBlock, deleteUnit,
  calcInventoryStats, unitStatusColor, newBlockId,
  BLOCK_DEV_STATUSES, BlockDevelopmentStatus,
} from '@/lib/inventoryStore';
import { formatPKR } from '@/lib/developerStore';

// ── Pill chip ─────────────────────────────────────────────────────────────────
function Chip({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <View style={[chip.wrap, { backgroundColor: bg }]}>
      <Text style={[chip.value, { color }]}>{value}</Text>
      <Text style={[chip.label, { color }]}>{label}</Text>
    </View>
  );
}

// ── Add block modal ────────────────────────────────────────────────────────────
function AddBlockModal({
  projectId, onSave, onCancel, colors,
}: {
  projectId: string;
  onSave: () => void;
  onCancel: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [name,   setName]   = useState('');
  const [total,  setTotal]  = useState('');
  const [status, setStatus] = useState<BlockDevelopmentStatus>('Planned');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('', 'Block name is required'); return; }
    setSaving(true);
    try {
      const block: InventoryBlock = {
        id: newBlockId(),
        projectId,
        name: name.trim(),
        totalUnits: Number(total) || 0,
        developmentStatus: status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveBlock(block);
      onSave();
    } catch {
      Alert.alert('Save failed', 'Could not save the block. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[modal.overlay]}>
      <View style={[modal.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[modal.title, { color: colors.foreground }]}>Add Block / Phase</Text>
        <Text style={[modal.sub, { color: colors.mutedForeground }]}>e.g. "Block A", "Phase 1", "Tower 1"</Text>

        <ModalField label="Block / Phase Name *" value={name} onChangeText={setName}
          placeholder='e.g. Block A' colors={colors} />
        <ModalField label="Total Units (optional)" value={total} onChangeText={setTotal}
          placeholder='e.g. 100' colors={colors} keyboardType="numeric" />

        <Text style={[modal.label, { color: colors.foreground, marginBottom: 8 }]}>Development Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {BLOCK_DEV_STATUSES.map((ds) => {
            const active = status === ds;
            return (
              <Pressable key={ds} onPress={() => setStatus(ds)}
                style={[modal.chip, { borderColor: active ? colors.action : colors.border, backgroundColor: active ? colors.action + '15' : colors.secondary }]}>
                <Text style={[modal.chipText, { color: active ? colors.action : colors.mutedForeground }]}>{ds}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={modal.btns}>
          <Pressable onPress={onCancel} style={[modal.cancelBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[modal.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => { void handleSave(); }} disabled={saving}
            style={[modal.saveBtn, { backgroundColor: saving ? colors.muted : colors.action }]}>
            <Text style={modal.saveText}>{saving ? 'Saving...' : 'Add Block'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ModalField({
  label, value, onChangeText, placeholder, colors, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; colors: ReturnType<typeof useColors>; keyboardType?: 'numeric';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[modal.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground + '88'}
        keyboardType={keyboardType}
        style={[modal.inputField, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }]}
      />
    </View>
  );
}

// ── Unit row ──────────────────────────────────────────────────────────────────
function UnitRow({
  unit, colors, onEdit, onDelete,
}: {
  unit: InventoryUnit;
  colors: ReturnType<typeof useColors>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sc = unitStatusColor(unit.status);
  return (
    <View style={[row.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <View style={row.top}>
          <Text style={[row.unitNo, { color: colors.foreground }]}>{unit.unitNumber}</Text>
          <View style={[row.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[row.statusText, { color: sc.text }]}>{unit.status}</Text>
          </View>
        </View>
        <Text style={[row.type, { color: colors.mutedForeground }]}>
          {unit.type}{unit.size ? ` · ${unit.size}` : ''}{unit.floor ? ` · Floor ${unit.floor}` : ''}
        </Text>
        <View style={row.badges}>
          {unit.isCorner && (
            <View style={[row.badge, { backgroundColor: colors.action + '15' }]}>
              <Text style={[row.badgeText, { color: colors.action }]}>Corner</Text>
            </View>
          )}
          {unit.isParkFacing && (
            <View style={[row.badge, { backgroundColor: '#1a6b3a15' }]}>
              <Text style={[row.badgeText, { color: '#1a6b3a' }]}>Park Facing</Text>
            </View>
          )}
          {unit.facing && (
            <View style={[row.badge, { backgroundColor: colors.secondary }]}>
              <Text style={[row.badgeText, { color: colors.mutedForeground }]}>{unit.facing}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={row.right}>
        {unit.price > 0 && (
          <Text style={[row.price, { color: colors.action }]}>PKR {formatPKR(unit.price)}</Text>
        )}
        <View style={row.actions}>
          <Pressable onPress={onEdit} hitSlop={8} style={[row.iconBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="edit-2" size={13} color={colors.action} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={[row.iconBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="trash-2" size={13} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Block section ─────────────────────────────────────────────────────────────
function BlockSection({
  block, units, colors, router, projectId, onDeleteBlock, onDeleteUnit,
}: {
  block: InventoryBlock;
  units: InventoryUnit[];
  colors: ReturnType<typeof useColors>;
  router: ReturnType<typeof useRouter>;
  projectId: string;
  onDeleteBlock: () => void;
  onDeleteUnit: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const blockUnits = units.filter((u) => u.blockId === block.id);
  const available  = blockUnits.filter((u) => u.status === 'Available').length;
  const sold       = blockUnits.filter((u) => u.status === 'Sold' || u.status === 'Booked').length;

  return (
    <View style={[blk.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Block header */}
      <Pressable onPress={() => setCollapsed(!collapsed)} style={blk.header}>
        <View style={[blk.icon, { backgroundColor: colors.action + '18' }]}>
          <Feather name="layers" size={16} color={colors.action} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[blk.name, { color: colors.foreground }]}>{block.name}</Text>
          <Text style={[blk.meta, { color: colors.mutedForeground }]}>
            {blockUnits.length} units · {available} available · {sold} sold/booked
          </Text>
        </View>
        <View style={blk.headerRight}>
          <Pressable
            onPress={() => router.push({
              pathname: '/developer/add-unit' as Parameters<typeof router.push>[0],
              params: { projectId, blockId: block.id, blockName: block.name },
            } as Parameters<typeof router.push>[0])}
            style={[blk.addBtn, { backgroundColor: colors.action }]}
          >
            <Feather name="plus" size={13} color="#fff" />
            <Text style={blk.addText}>Add Unit</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert(block.name, '', [
              { text: 'Delete Block', style: 'destructive', onPress: onDeleteBlock },
              { text: 'Cancel', style: 'cancel' },
            ])}
            hitSlop={8}
            style={[blk.menuBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="trash-2" size={13} color={colors.destructive} />
          </Pressable>
          <Pressable onPress={() => setCollapsed(!collapsed)} hitSlop={8}>
            <Feather name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </Pressable>

      {!collapsed && (
        <>
          {blockUnits.length === 0 ? (
            <Pressable
              onPress={() => router.push({
                pathname: '/developer/add-unit' as Parameters<typeof router.push>[0],
                params: { projectId, blockId: block.id, blockName: block.name },
              } as Parameters<typeof router.push>[0])}
              style={[blk.emptyUnits, { borderColor: colors.border }]}
            >
              <Feather name="plus-circle" size={20} color={colors.mutedForeground} />
              <Text style={[blk.emptyText, { color: colors.mutedForeground }]}>No units yet — tap to add units</Text>
            </Pressable>
          ) : (
            <View style={blk.unitList}>
              {blockUnits.map((u) => (
                <UnitRow
                  key={u.id}
                  unit={u}
                  colors={colors}
                  onEdit={() => router.push({
                    pathname: '/developer/add-unit' as Parameters<typeof router.push>[0],
                    params: { projectId, blockId: block.id, blockName: block.name, unitId: u.id },
                  } as Parameters<typeof router.push>[0])}
                  onDelete={() => {
                    Alert.alert(`Delete unit ${u.unitNumber}?`, 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDeleteUnit(u.id) },
                    ]);
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function InventoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName: string }>();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [blocks,       setBlocks]       = useState<InventoryBlock[]>([]);
  const [units,        setUnits]        = useState<InventoryUnit[]>([]);
  const [stats,        setStats]        = useState<InventoryStats | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    void Promise.all([getBlocks(projectId), getUnits(projectId)]).then(([b, u]) => {
      setBlocks(b);
      setUnits(u);
      setStats(calcInventoryStats(b, u));
    });
  }, [projectId]);

  useFocusEffect(load);

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await deleteBlock(blockId);
      load();
    } catch {
      Alert.alert('Delete failed', 'Could not delete the block. Please try again.');
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await deleteUnit(unitId);
      load();
    } catch {
      Alert.alert('Delete failed', 'Could not delete the unit. Please try again.');
    }
  };

  return (
    <View style={[sc.root, { backgroundColor: colors.background }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[sc.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={sc.backBtn}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[sc.eyebrow, { color: colors.action }]}>INVENTORY</Text>
          <Text style={[sc.title, { color: colors.foreground }]} numberOfLines={1}>{projectName ?? 'Project'}</Text>
        </View>
        <Pressable
          onPress={() => setShowAddBlock(true)}
          style={[sc.addBlockBtn, { backgroundColor: colors.action }]}
        >
          <Feather name="plus" size={15} color="#fff" />
          <Text style={sc.addBlockText}>Add Block</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: botPad + 100 }}
      >
        {/* ── Stats overview ─────────────────────────────────── */}
        {stats && (
          <AnimatedReveal>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 20 }}>
              <Chip label="Total Units"  value={stats.totalUnits}  color={colors.foreground}   bg={colors.secondary} />
              <Chip label="Available"    value={stats.available}   color="#1a6b3a"             bg="#1a6b3a18" />
              <Chip label="Reserved"     value={stats.reserved}    color="#c8a45a"             bg="#c8a45a18" />
              <Chip label="Booked"       value={stats.booked}      color="#102a43"             bg="#102a4318" />
              <Chip label="Sold"         value={stats.sold}        color="#0a8c62"             bg="#0a8c6218" />
              <Chip label="Blocked"      value={stats.blocked}     color={colors.mutedForeground} bg={colors.secondary} />
            </ScrollView>
          </AnimatedReveal>
        )}

        {/* ── Financial chips ────────────────────────────────── */}
        {stats && (stats.availableValue > 0 || stats.soldValue > 0) && (
          <AnimatedReveal delay={60}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 20 }}>
              {stats.availableValue > 0 && (
                <Chip label="Available Value" value={`PKR ${formatPKR(stats.availableValue)}`} color="#1a6b3a" bg="#1a6b3a12" />
              )}
              {stats.reservedValue > 0 && (
                <Chip label="Reserved Value" value={`PKR ${formatPKR(stats.reservedValue)}`} color="#c8a45a" bg="#c8a45a12" />
              )}
              {stats.soldValue > 0 && (
                <Chip label="Sold Value" value={`PKR ${formatPKR(stats.soldValue)}`} color="#0a8c62" bg="#0a8c6212" />
              )}
            </ScrollView>
          </AnimatedReveal>
        )}

        {/* ── Blocks ────────────────────────────────────────── */}
        {blocks.length === 0 ? (
          <AnimatedReveal delay={80}>
            <Pressable
              onPress={() => setShowAddBlock(true)}
              style={[sc.emptyWrap, { borderColor: colors.border }]}
            >
              <View style={[sc.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="layers" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={[sc.emptyTitle, { color: colors.foreground }]}>No blocks yet</Text>
              <Text style={[sc.emptyDesc, { color: colors.mutedForeground }]}>
                Add your first block or phase to start managing units (e.g. Block A, Phase 1, Tower 1)
              </Text>
              <View style={[sc.emptyBtn, { backgroundColor: colors.action }]}>
                <Feather name="plus" size={15} color="#fff" />
                <Text style={sc.emptyBtnText}>Add First Block</Text>
              </View>
            </Pressable>
          </AnimatedReveal>
        ) : (
          <View style={{ gap: 14 }}>
            {blocks.map((b, i) => (
              <AnimatedReveal key={b.id} delay={80 + i * 50}>
                <BlockSection
                  block={b}
                  units={units}
                  colors={colors}
                  router={router}
                  projectId={projectId ?? ''}
                  onDeleteBlock={() => { void handleDeleteBlock(b.id); }}
                  onDeleteUnit={(id) => { void handleDeleteUnit(id); }}
                />
              </AnimatedReveal>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Add Block modal ──────────────────────────────────── */}
      {showAddBlock && (
        <AddBlockModal
          projectId={projectId ?? ''}
          colors={colors}
          onSave={() => { setShowAddBlock(false); load(); }}
          onCancel={() => setShowAddBlock(false)}
        />
      )}
    </View>
  );
}

// ── Chip styles ───────────────────────────────────────────────────────────────
const chip = StyleSheet.create({
  wrap:  { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 72 },
  value: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2, opacity: 0.85 },
});

// ── Modal styles ──────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  box:        { width: '90%', borderRadius: 20, borderWidth: 1, padding: 22, gap: 6 },
  title:      { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 2 },
  sub:        { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 10 },
  label:      { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 6 },
  inputField: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 13 },
  chip:       { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7 },
  chipText:   { fontFamily: 'Inter_500Medium', fontSize: 11 },
  btns:       { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, borderWidth: 1 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  saveBtn:    { flex: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13 },
  saveText:   { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#fff' },
});

// ── Block section styles ──────────────────────────────────────────────────────
const blk = StyleSheet.create({
  wrap:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  icon:       { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name:       { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 2 },
  meta:       { fontFamily: 'Inter_400Regular', fontSize: 11 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  addText:    { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#fff' },
  menuBtn:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  emptyUnits: { alignItems: 'center', gap: 8, padding: 20, borderTopWidth: 1 },
  emptyText:  { fontFamily: 'Inter_400Regular', fontSize: 12 },
  unitList:   { borderTopWidth: 1, borderTopColor: '#00000010', gap: 0 },
});

// ── Unit row styles ───────────────────────────────────────────────────────────
const row = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#00000010' },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  unitNo:     { fontFamily: 'Inter_700Bold', fontSize: 14 },
  statusPill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  type:       { fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 5 },
  badges:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge:      { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:  { fontFamily: 'Inter_500Medium', fontSize: 9 },
  right:      { alignItems: 'flex-end', gap: 6 },
  price:      { fontFamily: 'Inter_700Bold', fontSize: 13 },
  actions:    { flexDirection: 'row', gap: 6 },
  iconBtn:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  title:       { fontFamily: 'Inter_700Bold', fontSize: 17 },
  addBlockBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  addBlockText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#fff' },
  emptyWrap:   { borderWidth: 1, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, borderStyle: 'dashed', marginTop: 20 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontFamily: 'Inter_700Bold', fontSize: 18 },
  emptyDesc:   { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 13, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText:{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
});
