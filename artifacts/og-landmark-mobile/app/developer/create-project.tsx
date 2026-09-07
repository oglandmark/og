/**
 * Developer — Create / Edit Project Wizard (Advanced — v2)
 * 6 steps: Basic Info → Location & Contact → Units & Pricing →
 *          Legal & Status → Amenities & Social → Review
 * Saves to developerStore (AsyncStorage).
 * TODO: swap saveDevProject() with oglandmark.com API endpoint.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { LocationPicker } from '@/components/LocationPicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  DeveloperProject, DevelopmentStatus, NocStatus, PossessionStatus, ProjectType,
  AMENITIES_LIST, APPROVED_BY_LIST, DEVELOPMENT_STATUSES, NOC_STATUSES,
  OKARA_CITIES, PLOT_SIZES, POSSESSION_STATUSES, PROJECT_TYPES,
  getDevProjects, migrateProject, newProjectId, saveDevProject,
} from '@/lib/developerStore';

const TOTAL_STEPS = 7;

// ── Blank project ─────────────────────────────────────────────────────────────
function blankProject(developerId: string): DeveloperProject {
  const now = new Date().toISOString();
  return migrateProject({ id: newProjectId(), developerId, name: '', createdAt: now, updatedAt: now });
}

// ── Shared field types ────────────────────────────────────────────────────────
type StepProps = {
  data: DeveloperProject;
  set: (p: Partial<DeveloperProject>) => void;
  tr: ReturnType<typeof useLanguage>['tr'];
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Labelled text input */
function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType, hint, required, colors,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; hint?: string; required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address' | 'url';
  colors: StepProps['colors'];
}) {
  return (
    <View style={fd.wrap}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={[fd.label, { color: colors.mutedForeground }]}>{label}</Text>
        {required && <Text style={{ color: '#dc2626', fontSize: 11, fontFamily: 'Inter_700Bold' }}>*</Text>}
      </View>
      {hint ? <Text style={[fd.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground + '66'}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        style={[
          fd.input,
          { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground },
          multiline && { height: 88, textAlignVertical: 'top', paddingTop: 12 },
        ]}
      />
    </View>
  );
}

/** Horizontal chip selector (single) */
function ChipSelect({
  label, options, selected, onSelect, required, hint, colors,
}: {
  label: string; options: string[]; selected: string; onSelect: (v: string) => void;
  required?: boolean; hint?: string;
  colors: StepProps['colors'];
}) {
  return (
    <View style={fd.wrap}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={[fd.label, { color: colors.mutedForeground }]}>{label}</Text>
        {required && <Text style={{ color: '#dc2626', fontSize: 11, fontFamily: 'Inter_700Bold' }}>*</Text>}
      </View>
      {hint ? <Text style={[fd.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {options.map((opt) => {
          const active = opt === selected;
          return (
            <Pressable key={opt} onPress={() => onSelect(active ? '' : opt)}
              style={[fd.chip, { borderColor: active ? colors.action : colors.border, backgroundColor: active ? colors.action + '18' : colors.secondary }]}>
              <Text style={[fd.chipText, { color: active ? colors.action : colors.mutedForeground }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Grid multi-select chips */
function MultiChipGrid({
  label, options, selected, onToggle, hint, colors,
}: {
  label: string; options: string[]; selected: string[];
  onToggle: (v: string) => void; hint?: string;
  colors: StepProps['colors'];
}) {
  return (
    <View style={fd.wrap}>
      <Text style={[fd.label, { color: colors.mutedForeground }]}>{label}</Text>
      {hint ? <Text style={[fd.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Pressable key={opt} onPress={() => onToggle(opt)}
              style={[fd.chip, { borderColor: active ? colors.action : colors.border, backgroundColor: active ? colors.action + '18' : colors.secondary }]}>
              {active && <Feather name="check" size={10} color={colors.action} />}
              <Text style={[fd.chipText, { color: active ? colors.action : colors.mutedForeground }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Toggle switch */
function Toggle({
  label, value, onToggle, hint, colors,
}: { label: string; value: boolean; onToggle: () => void; hint?: string; colors: StepProps['colors'] }) {
  return (
    <View style={[fd.wrap, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={[fd.label, { color: colors.mutedForeground }]}>{label}</Text>
        {hint ? <Text style={[fd.hint, { color: colors.mutedForeground, marginTop: 2 }]}>{hint}</Text> : null}
      </View>
      <Pressable onPress={onToggle}
        style={[tgl.track, { backgroundColor: value ? colors.action : colors.secondary, borderColor: value ? colors.action : colors.border }]}>
        <View style={[tgl.thumb, { backgroundColor: '#ffffff', transform: [{ translateX: value ? 20 : 2 }] }]} />
      </Pressable>
    </View>
  );
}

/** Numeric stepper with + / − */
function Stepper({
  label, value, onChange, min, max, step, hint, colors,
}: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; hint?: string; colors: StepProps['colors'] }) {
  const s = step ?? 1;
  return (
    <View style={fd.wrap}>
      <Text style={[fd.label, { color: colors.mutedForeground }]}>{label}</Text>
      {hint ? <Text style={[fd.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <View style={[stp.row, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Pressable hitSlop={10} onPress={() => onChange(Math.max(min ?? 0, value - s))}
          style={[stp.btn, { backgroundColor: colors.border }]}>
          <Feather name="minus" size={14} color={colors.foreground} />
        </Pressable>
        <TextInput
          value={String(value)}
          onChangeText={(t) => { const n = Number(t); if (!isNaN(n)) onChange(Math.max(min ?? 0, Math.min(max ?? 9999, n))); }}
          keyboardType="numeric"
          style={[stp.input, { color: colors.foreground }]}
          textAlign="center"
        />
        <Pressable hitSlop={10} onPress={() => onChange(Math.min(max ?? 9999, value + s))}
          style={[stp.btn, { backgroundColor: colors.border }]}>
          <Feather name="plus" size={14} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

/** Section divider */
function SectionDiv({ label, colors }: { label: string; colors: StepProps['colors'] }) {
  return (
    <View style={[sec.wrap, { borderTopColor: colors.border }]}>
      <Text style={[sec.label, { color: colors.mutedForeground, backgroundColor: colors.background }]}>{label}</Text>
    </View>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({
  current, total, labels, colors,
}: { current: number; total: number; labels: string[]; colors: StepProps['colors'] }) {
  return (
    <View>
      {/* Progress bar */}
      <View style={[si.progressBg, { backgroundColor: colors.border }]}>
        <View style={[si.progressFill, { backgroundColor: colors.action, width: `${((current + 1) / total) * 100}%` as `${number}%` }]} />
      </View>
      {/* Circles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={si.wrap}>
        {Array.from({ length: total }).map((_, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <View key={i} style={si.stepCol}>
              <View style={[si.circle,
                done   ? { backgroundColor: colors.action, borderColor: colors.action } :
                active ? { backgroundColor: colors.background, borderColor: colors.action, borderWidth: 2 } :
                         { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}>
                {done
                  ? <Feather name="check" size={11} color="#ffffff" />
                  : <Text style={[si.num, { color: active ? colors.action : colors.mutedForeground }]}>{i + 1}</Text>
                }
              </View>
              <Text style={[si.label, { color: active ? colors.action : done ? colors.action + 'aa' : colors.mutedForeground }]} numberOfLines={1}>
                {labels[i]}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Step 1 — Basic Info ───────────────────────────────────────────────────────
function Step1({ data, set, tr, colors }: StepProps) {
  const toggleHighlight = (i: number, val: string) => {
    const h = [...data.highlights];
    h[i] = val;
    set({ highlights: h });
  };
  return (
    <>
      <Field label={tr('fieldProjectName')} required value={data.name}
        onChangeText={(v) => set({ name: v })} placeholder="e.g. OG Green Valley" colors={colors} />
      <ChipSelect label={tr('fieldProjectType')} required options={PROJECT_TYPES as unknown as string[]}
        selected={data.type} onSelect={(v) => set({ type: v as ProjectType })} colors={colors} />
      <Field label={tr('fieldTagline')} value={data.tagline}
        onChangeText={(v) => set({ tagline: v })} placeholder="e.g. Your Dream Home Awaits" colors={colors} />
      <Field label={tr('fieldShortDesc')} required value={data.shortDescription} multiline
        onChangeText={(v) => set({ shortDescription: v })}
        placeholder="Brief 2–3 line description shown on project card..." colors={colors} />
      <Field label={tr('fieldFullDesc')} value={data.fullDescription} multiline
        onChangeText={(v) => set({ fullDescription: v })}
        placeholder="Detailed project description for buyers..." colors={colors} />

      <SectionDiv label={tr('fieldHighlights')} colors={colors} />
      <Text style={[{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.mutedForeground, marginTop: -4 }]}>
        Add up to 3 key selling points
      </Text>
      {[0, 1, 2].map((i) => (
        <Field key={i} label={`Point ${i + 1}`} value={data.highlights[i] ?? ''}
          onChangeText={(v) => toggleHighlight(i, v)}
          placeholder={tr('fieldHighlightPlaceholder')} colors={colors} />
      ))}
    </>
  );
}

// ── Step 2 — Location & Contact ───────────────────────────────────────────────
function Step2({ data, set, tr, colors }: StepProps) {
  return (
    <>
      <Field label={tr('fieldDistrict')} value={data.district}
        onChangeText={(v) => set({ district: v })} colors={colors} />
      <ChipSelect label={tr('fieldCity')} required options={OKARA_CITIES}
        selected={data.city} onSelect={(v) => set({ city: v })} colors={colors} />
      <Field label={tr('fieldTehsil')} value={data.tehsil}
        onChangeText={(v) => set({ tehsil: v })} placeholder="e.g. Depalpur" colors={colors} />
      <Field label={tr('fieldAreaName')} value={data.area}
        onChangeText={(v) => set({ area: v })} placeholder="e.g. Cantt Area, Block A" colors={colors} />
      <Field label={tr('fieldAddress')} required value={data.address}
        onChangeText={(v) => set({ address: v })}
        placeholder="e.g. Main GT Road, Near Toll Plaza" colors={colors} />
      <Field label={tr('fieldNearbyLandmark')} value={data.nearbyLandmark}
        onChangeText={(v) => set({ nearbyLandmark: v })}
        placeholder="e.g. Near District Hospital" colors={colors} />

      <SectionDiv label="Pin Project Location" colors={colors} />
      <LocationPicker
        latitude={data.latitude}
        longitude={data.longitude}
        onChange={(lat, lng) => set({ latitude: lat, longitude: lng })}
        onClear={() => set({ latitude: undefined, longitude: undefined })}
        colors={colors}
      />

      <SectionDiv label="Contact & Online" colors={colors} />
      <Field label={tr('fieldOfficePhone')} value={data.projectOfficePhone}
        onChangeText={(v) => set({ projectOfficePhone: v })}
        keyboardType="phone-pad" placeholder="e.g. 0344-1234567" colors={colors} />
      <Field label={tr('fieldGoogleMaps')} value={data.googleMapsLink}
        onChangeText={(v) => set({ googleMapsLink: v })}
        keyboardType="url" placeholder="https://maps.google.com/..." colors={colors} />
    </>
  );
}

// ── Step 3 — Units & Pricing ──────────────────────────────────────────────────
function Step3({ data, set, tr, colors }: StepProps) {
  const togglePlotSize = (sz: string) => {
    const arr = data.plotSizes.includes(sz)
      ? data.plotSizes.filter((s) => s !== sz)
      : [...data.plotSizes, sz];
    set({ plotSizes: arr });
  };

  // Format price display
  const fmtInput = (n: number) => (n > 0 ? String(n) : '');

  return (
    <>
      <SectionDiv label="Inventory" colors={colors} />
      <Field label={tr('fieldTotalArea')} value={data.totalArea}
        onChangeText={(v) => set({ totalArea: v })} placeholder="e.g. 500 Kanal / 200 Marla" colors={colors} />
      <Stepper label={tr('fieldTotalBlocks')} value={data.totalBlocks} min={0}
        onChange={(n) => set({ totalBlocks: n })}
        hint="Number of blocks / phases in this project" colors={colors} />
      <Stepper label={tr('fieldTotalUnitsInput')} value={data.totalUnits} min={0}
        onChange={(n) => set({ totalUnits: n, availableUnits: n })} colors={colors} />
      <MultiChipGrid label={tr('fieldPlotSizes')} options={PLOT_SIZES}
        selected={data.plotSizes} onToggle={togglePlotSize}
        hint="Select all sizes available in this project" colors={colors} />

      <SectionDiv label="Pricing (PKR)" colors={colors} />
      <Field label={tr('fieldStartingPrice')} required value={fmtInput(data.startingPrice)}
        onChangeText={(v) => set({ startingPrice: Number(v.replace(/[^0-9]/g, '')) || 0 })}
        keyboardType="numeric" placeholder="e.g. 3500000" hint="Minimum / lowest unit price"
        colors={colors} />
      <Field label={tr('fieldMaxPrice')} value={fmtInput(data.maxPrice)}
        onChangeText={(v) => set({ maxPrice: Number(v.replace(/[^0-9]/g, '')) || 0 })}
        keyboardType="numeric" placeholder="e.g. 12000000" hint="Highest / maximum unit price"
        colors={colors} />

      {/* Price preview badge */}
      {data.startingPrice > 0 && (
        <View style={[pp.wrap, { backgroundColor: colors.action + '12', borderColor: colors.action + '30' }]}>
          <Feather name="tag" size={13} color={colors.action} />
          <Text style={[pp.text, { color: colors.action }]}>
            PKR {(data.startingPrice / 100_000).toFixed(1)}L
            {data.maxPrice > data.startingPrice ? ` – ${(data.maxPrice / 100_000).toFixed(1)}L` : ''}
          </Text>
        </View>
      )}

      <SectionDiv label="Payment Plan" colors={colors} />
      <Toggle label={tr('fieldPaymentPlan')} value={data.paymentPlanAvailable}
        onToggle={() => set({ paymentPlanAvailable: !data.paymentPlanAvailable })}
        hint="Enable if buyers can purchase on installments" colors={colors} />
      {data.paymentPlanAvailable && (
        <>
          <Stepper label={tr('fieldDownPayment')} value={data.downPaymentPct}
            min={5} max={50} step={5}
            hint="Percentage of total price paid upfront" onChange={(n) => set({ downPaymentPct: n })} colors={colors} />
          <Stepper label={tr('fieldInstallmentMonths')} value={data.installmentMonths}
            min={6} max={120} step={6}
            hint="Total duration of payment plan in months" onChange={(n) => set({ installmentMonths: n })} colors={colors} />
          {/* Summary badge */}
          <View style={[pp.wrap, { backgroundColor: '#1a6b3a12', borderColor: '#1a6b3a30' }]}>
            <Feather name="credit-card" size={13} color="#1a6b3a" />
            <Text style={[pp.text, { color: '#1a6b3a' }]}>
              {data.downPaymentPct}% down · {data.installmentMonths} months plan
            </Text>
          </View>
        </>
      )}
    </>
  );
}

// ── Step 4 — Legal & Status ───────────────────────────────────────────────────
function Step4({ data, set, tr, colors }: StepProps) {
  const toggleApproval = (a: string) => {
    const arr = data.approvedBy.includes(a)
      ? data.approvedBy.filter((x) => x !== a)
      : [...data.approvedBy, a];
    set({ approvedBy: arr });
  };
  return (
    <>
      <SectionDiv label="Development Status" colors={colors} />
      <ChipSelect label={tr('fieldDevelopmentStatus')} required options={DEVELOPMENT_STATUSES as unknown as string[]}
        selected={data.developmentStatus} onSelect={(v) => set({ developmentStatus: v as DevelopmentStatus })} colors={colors} />
      <Field label={tr('fieldLaunchDate')} value={data.launchDate}
        onChangeText={(v) => set({ launchDate: v })} placeholder="e.g. January 2025" colors={colors} />
      <Field label={tr('fieldExpectedCompletion')} value={data.expectedCompletion}
        onChangeText={(v) => set({ expectedCompletion: v })} placeholder="e.g. December 2027" colors={colors} />
      <ChipSelect label={tr('fieldPossessionStatus')} options={POSSESSION_STATUSES as unknown as string[]}
        selected={data.possessionStatus} onSelect={(v) => set({ possessionStatus: v as PossessionStatus })}
        hint="Can buyers take possession now?" colors={colors} />

      <SectionDiv label="Legal & NOC" colors={colors} />
      <ChipSelect label={tr('fieldNocStatus')} options={NOC_STATUSES as unknown as string[]}
        selected={data.nocStatus} onSelect={(v) => set({ nocStatus: v as NocStatus })}
        hint="No Objection Certificate status" colors={colors} />
      <MultiChipGrid label={tr('fieldApprovedBy')} options={APPROVED_BY_LIST}
        selected={data.approvedBy} onToggle={toggleApproval}
        hint="Select all relevant approving authorities" colors={colors} />
      <Field label={tr('fieldRegNumber')} value={data.registrationNumber}
        onChangeText={(v) => set({ registrationNumber: v })}
        placeholder="e.g. LDA-RES-2024-00123" colors={colors} />
    </>
  );
}

// ── Step 5 — Amenities & Social ───────────────────────────────────────────────
function Step5({ data, set, tr, colors }: StepProps) {
  const toggleAmenity = (a: string) => {
    const arr = data.amenities.includes(a)
      ? data.amenities.filter((x) => x !== a)
      : [...data.amenities, a];
    set({ amenities: arr });
  };
  return (
    <>
      <MultiChipGrid label={tr('fieldAmenities')} options={AMENITIES_LIST}
        selected={data.amenities} onToggle={toggleAmenity}
        hint={`${data.amenities.length} selected`} colors={colors} />

      <SectionDiv label="Social & Online Presence" colors={colors} />
      <Field label={tr('fieldFacebook')} value={data.facebookPage}
        onChangeText={(v) => set({ facebookPage: v })}
        keyboardType="url" placeholder="https://facebook.com/yourpage" colors={colors} />
      <Field label={tr('fieldWebsite')} value={data.website}
        onChangeText={(v) => set({ website: v })}
        keyboardType="url" placeholder="https://yourproject.com" colors={colors} />
      <Field label={tr('fieldYoutube')} value={data.youtubeChannel}
        onChangeText={(v) => set({ youtubeChannel: v })}
        keyboardType="url" placeholder="https://youtube.com/@channel" colors={colors} />
    </>
  );
}

// ── Step 6 — Media & Photos ───────────────────────────────────────────────────
function Step6Media({ data, set, colors }: StepProps) {
  const [pickingCover, setPickingCover]     = useState(false);
  const [pickingGallery, setPickingGallery] = useState(false);

  const requestAndPick = async (isCover: boolean, useCamera: boolean) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', useCamera ? 'Camera access is needed.' : 'Photo library access is needed.');
      return;
    }
    if (isCover) setPickingCover(true); else setPickingGallery(true);
    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true, aspect: [16, 9] })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.85,
            allowsEditing: isCover,
            allowsMultipleSelection: !isCover,
            selectionLimit: isCover ? 1 : 10 - (data.photos?.length ?? 0),
            aspect: isCover ? [16, 9] : undefined,
            mediaTypes: ['images'],
          });
      if (result.canceled) return;
      if (isCover) {
        set({ coverImageUri: result.assets[0].uri });
      } else {
        const newUris = result.assets.map((a) => a.uri);
        const merged = [...(data.photos ?? []), ...newUris].slice(0, 10);
        set({ photos: merged });
      }
    } finally {
      if (isCover) setPickingCover(false); else setPickingGallery(false);
    }
  };

  const addVideoLink = () => {
    if ((data.videoLinks?.length ?? 0) >= 3) { Alert.alert('', 'Maximum 3 video links allowed.'); return; }
    Alert.prompt(
      'Add Video Link',
      'Paste a YouTube or video URL:',
      (url) => {
        if (!url?.trim()) return;
        set({ videoLinks: [...(data.videoLinks ?? []), url.trim()] });
      },
      'plain-text',
      '',
      'url',
    );
  };

  const removePhoto = (idx: number) => set({ photos: (data.photos ?? []).filter((_, i) => i !== idx) });
  const removeVideo = (idx: number) => set({ videoLinks: (data.videoLinks ?? []).filter((_, i) => i !== idx) });

  return (
    <View style={{ gap: 24 }}>
      {/* ── Cover Photo ──────────────────────────────────────── */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[md.sectionIcon, { backgroundColor: colors.action + '18' }]}>
            <Feather name="image" size={14} color={colors.action} />
          </View>
          <View>
            <Text style={[md.sectionTitle, { color: colors.foreground }]}>Cover Photo</Text>
            <Text style={[md.sectionSub, { color: colors.mutedForeground }]}>Main hero image shown on listing card</Text>
          </View>
        </View>

        {data.coverImageUri ? (
          <View style={md.coverWrap}>
            <Image source={{ uri: data.coverImageUri }} style={md.coverImage} resizeMode="cover" />
            <View style={md.coverOverlay}>
              <Pressable onPress={() => set({ coverImageUri: undefined })}
                style={[md.removeBtn, { backgroundColor: '#dc262688' }]}>
                <Feather name="trash-2" size={14} color="#ffffff" />
              </Pressable>
              <Pressable onPress={() => { void requestAndPick(true, false); }}
                style={[md.removeBtn, { backgroundColor: '#00000066' }]}>
                <Feather name="edit-2" size={14} color="#ffffff" />
              </Pressable>
            </View>
            <View style={[md.coverBadge, { backgroundColor: '#1a6b3acc' }]}>
              <Feather name="check" size={10} color="#ffffff" />
              <Text style={md.coverBadgeText}>Cover Photo Set</Text>
            </View>
          </View>
        ) : (
          <View style={[md.coverPlaceholder, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <Feather name="image" size={32} color={colors.mutedForeground} />
            <Text style={[md.placeholderTitle, { color: colors.foreground }]}>Add Cover Photo</Text>
            <Text style={[md.placeholderSub, { color: colors.mutedForeground }]}>16:9 ratio recommended</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable onPress={() => { void requestAndPick(true, false); }} disabled={pickingCover}
                style={[md.pickBtn, { backgroundColor: colors.action }]}>
                <Feather name="image" size={14} color="#ffffff" />
                <Text style={md.pickBtnText}>Gallery</Text>
              </Pressable>
              <Pressable onPress={() => { void requestAndPick(true, true); }} disabled={pickingCover}
                style={[md.pickBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="camera" size={14} color={colors.foreground} />
                <Text style={[md.pickBtnText, { color: colors.foreground }]}>Camera</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ── Gallery Photos ───────────────────────────────────── */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[md.sectionIcon, { backgroundColor: '#7c3aed18' }]}>
              <Feather name="grid" size={14} color="#7c3aed" />
            </View>
            <View>
              <Text style={[md.sectionTitle, { color: colors.foreground }]}>Gallery Photos</Text>
              <Text style={[md.sectionSub, { color: colors.mutedForeground }]}>{data.photos?.length ?? 0}/10 photos added</Text>
            </View>
          </View>
          {(data.photos?.length ?? 0) < 10 && (
            <Pressable onPress={() => { void requestAndPick(false, false); }} disabled={pickingGallery}
              style={[md.addPhotoBtn, { backgroundColor: colors.action + '18', borderColor: colors.action + '44' }]}>
              <Feather name="plus" size={14} color={colors.action} />
              <Text style={[md.addPhotoBtnText, { color: colors.action }]}>Add Photos</Text>
            </Pressable>
          )}
        </View>

        {(data.photos?.length ?? 0) === 0 ? (
          <View style={[md.galleryEmpty, { borderColor: colors.border }]}>
            <Feather name="camera" size={22} color={colors.mutedForeground} />
            <Text style={[md.galleryEmptyText, { color: colors.mutedForeground }]}>
              Add project photos — entrance, plots, facilities, amenities
            </Text>
            <Pressable onPress={() => { void requestAndPick(false, false); }} disabled={pickingGallery}
              style={[md.pickBtn, { backgroundColor: colors.action, marginTop: 4 }]}>
              <Feather name="image" size={14} color="#ffffff" />
              <Text style={md.pickBtnText}>Choose from Gallery</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {(data.photos ?? []).map((uri, idx) => (
              <View key={uri + idx} style={md.thumbWrap}>
                <Image source={{ uri }} style={md.thumb} resizeMode="cover" />
                <Pressable onPress={() => removePhoto(idx)}
                  style={md.thumbRemove}>
                  <Feather name="x" size={11} color="#ffffff" />
                </Pressable>
                <View style={[md.thumbBadge, { backgroundColor: '#00000066' }]}>
                  <Text style={md.thumbBadgeText}>{idx + 1}</Text>
                </View>
              </View>
            ))}
            {(data.photos?.length ?? 0) < 10 && (
              <Pressable onPress={() => { void requestAndPick(false, false); }} disabled={pickingGallery}
                style={[md.thumbAdd, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Feather name="plus" size={20} color={colors.mutedForeground} />
                <Text style={[md.thumbAddText, { color: colors.mutedForeground }]}>Add</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Video Links ──────────────────────────────────────── */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[md.sectionIcon, { backgroundColor: '#b94b4218' }]}>
              <Feather name="youtube" size={14} color="#b94b42" />
            </View>
            <View>
              <Text style={[md.sectionTitle, { color: colors.foreground }]}>Video Links</Text>
              <Text style={[md.sectionSub, { color: colors.mutedForeground }]}>YouTube / walkthrough videos (max 3)</Text>
            </View>
          </View>
          {(data.videoLinks?.length ?? 0) < 3 && Platform.OS === 'ios' && (
            <Pressable onPress={addVideoLink}
              style={[md.addPhotoBtn, { backgroundColor: '#b94b4218', borderColor: '#b94b4244' }]}>
              <Feather name="plus" size={14} color="#b94b42" />
              <Text style={[md.addPhotoBtnText, { color: '#b94b42' }]}>Add Link</Text>
            </Pressable>
          )}
        </View>

        {/* Video link input fields (Android-friendly: no Alert.prompt) */}
        {[0, 1, 2].map((slot) => {
          const value = (data.videoLinks ?? [])[slot] ?? '';
          return (
            <View key={slot} style={{ gap: 5 }}>
              <Text style={[fd.label, { color: colors.mutedForeground }]}>Video Link {slot + 1}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={value}
                  onChangeText={(v) => {
                    const arr = [...(data.videoLinks ?? []), '', '', ''].slice(0, 3);
                    arr[slot] = v;
                    set({ videoLinks: arr.filter((_, i) => i <= Math.max(slot, (data.videoLinks?.length ?? 0) - 1) || arr[i]) });
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  keyboardType="url"
                  autoCapitalize="none"
                  placeholderTextColor={colors.mutedForeground + '66'}
                  style={[fd.input, { flex: 1, backgroundColor: colors.secondary, borderColor: value ? colors.action + '55' : colors.border, color: colors.foreground }]}
                />
                {value ? (
                  <Pressable onPress={() => removeVideo(slot)} hitSlop={8}
                    style={[md.videoClearBtn, { backgroundColor: '#dc262618' }]}>
                    <Feather name="x" size={14} color="#dc2626" />
                  </Pressable>
                ) : null}
                {value ? (
                  <Pressable onPress={() => Linking.openURL(value).catch(() => {})} hitSlop={8}
                    style={[md.videoClearBtn, { backgroundColor: '#1a6b3a18' }]}>
                    <Feather name="external-link" size={14} color="#1a6b3a" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Tips */}
      <View style={[md.tipsCard, { backgroundColor: colors.accent, borderColor: colors.primary + '33' }]}>
        <Feather name="info" size={13} color={colors.primary} />
        <Text style={[md.tipsText, { color: colors.accentForeground }]}>
          Projects with cover photos get <Text style={{ fontFamily: 'Inter_700Bold' }}>3× more inquiries</Text>. Add at least 5 photos for best results.
        </Text>
      </View>
    </View>
  );
}

// ── Step 7 — Review ───────────────────────────────────────────────────────────
function Step6Review({ data, tr, colors }: StepProps) {
  const { formatPKR } = require('@/lib/developerStore');

  const Section = ({ title, rows }: { title: string; rows: { label: string; value: string }[] }) => (
    <View style={[rv.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[rv.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {rows.map((r, i) => r.value ? (
        <View key={r.label} style={[rv.row, i < rows.filter(x => x.value).length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <Text style={[rv.rowLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
          <Text style={[rv.rowValue, { color: colors.foreground }]} numberOfLines={3}>{r.value}</Text>
        </View>
      ) : null)}
    </View>
  );

  const highlightsStr = data.highlights.filter(Boolean).join(' · ');

  return (
    <View style={{ gap: 14 }}>
      <View style={[rv.header, { backgroundColor: colors.action }]}>
        <Text style={rv.headerSub}>REVIEW YOUR PROJECT</Text>
        <Text style={rv.headerTitle}>{data.name || 'Unnamed Project'}</Text>
        <Text style={rv.headerType}>{data.type} · {data.city || 'Location not set'}</Text>
      </View>

      <Section title={tr('reviewBasicInfo')} rows={[
        { label: 'Type',            value: data.type },
        { label: 'Tagline',         value: data.tagline },
        { label: 'Short Desc',      value: data.shortDescription },
        { label: 'Highlights',      value: highlightsStr },
      ]} />

      <Section title={tr('reviewLocation')} rows={[
        { label: 'City',            value: [data.city, data.tehsil].filter(Boolean).join(', ') },
        { label: 'Area',            value: data.area },
        { label: 'Address',         value: data.address },
        { label: 'Landmark',        value: data.nearbyLandmark },
        { label: 'Office Phone',    value: data.projectOfficePhone },
        { label: 'Maps Link',       value: data.googleMapsLink ? '✓ Added' : '' },
      ]} />

      <Section title={tr('reviewPricing')} rows={[
        { label: 'Total Area',      value: data.totalArea },
        { label: 'Blocks',          value: data.totalBlocks > 0 ? String(data.totalBlocks) : '' },
        { label: 'Total Units',     value: data.totalUnits > 0 ? String(data.totalUnits) : '' },
        { label: 'Plot Sizes',      value: data.plotSizes.join(', ') },
        { label: 'Starting Price',  value: data.startingPrice > 0 ? `PKR ${formatPKR(data.startingPrice)}` : '' },
        { label: 'Max Price',       value: data.maxPrice > 0 ? `PKR ${formatPKR(data.maxPrice)}` : '' },
        { label: 'Payment Plan',    value: data.paymentPlanAvailable ? `${data.downPaymentPct}% down · ${data.installmentMonths}mo` : 'Not offered' },
      ]} />

      <Section title={tr('reviewLegal')} rows={[
        { label: 'Dev Status',      value: data.developmentStatus },
        { label: 'Launch Date',     value: data.launchDate },
        { label: 'Completion',      value: data.expectedCompletion },
        { label: 'Possession',      value: data.possessionStatus },
        { label: 'NOC Status',      value: data.nocStatus },
        { label: 'Approved By',     value: data.approvedBy.join(', ') },
        { label: 'Reg. Number',     value: data.registrationNumber },
      ]} />

      {data.amenities.length > 0 && (
        <View style={[rv.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[rv.sectionTitle, { color: colors.mutedForeground }]}>{tr('reviewAmenities')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
            {data.amenities.map((a) => (
              <View key={a} style={[rv.amenityChip, { backgroundColor: colors.action + '15', borderColor: colors.action + '30' }]}>
                <Feather name="check" size={10} color={colors.action} />
                <Text style={[rv.amenityText, { color: colors.action }]}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Media preview in review ── */}
      {(data.coverImageUri || (data.photos?.length ?? 0) > 0 || (data.videoLinks?.filter(Boolean).length ?? 0) > 0) && (
        <View style={[rv.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[rv.sectionTitle, { color: colors.mutedForeground }]}>MEDIA</Text>
          {data.coverImageUri && (
            <Image source={{ uri: data.coverImageUri }} style={{ width: '100%', height: 140, borderRadius: 10, marginBottom: 10, marginTop: 6 }} resizeMode="cover" />
          )}
          {(data.photos?.length ?? 0) > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingBottom: 8 }}>
              {(data.photos ?? []).map((uri, i) => (
                <Image key={uri + i} source={{ uri }} style={{ width: 76, height: 60, borderRadius: 8 }} resizeMode="cover" />
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {data.coverImageUri && (
              <View style={[rv.amenityChip, { backgroundColor: '#1a6b3a15', borderColor: '#1a6b3a30' }]}>
                <Feather name="image" size={10} color="#1a6b3a" />
                <Text style={[rv.amenityText, { color: '#1a6b3a' }]}>Cover photo set</Text>
              </View>
            )}
            {(data.photos?.length ?? 0) > 0 && (
              <View style={[rv.amenityChip, { backgroundColor: '#7c3aed15', borderColor: '#7c3aed30' }]}>
                <Feather name="grid" size={10} color="#7c3aed" />
                <Text style={[rv.amenityText, { color: '#7c3aed' }]}>{data.photos.length} gallery photo{data.photos.length > 1 ? 's' : ''}</Text>
              </View>
            )}
            {(data.videoLinks?.filter(Boolean).length ?? 0) > 0 && (
              <View style={[rv.amenityChip, { backgroundColor: '#b94b4215', borderColor: '#b94b4230' }]}>
                <Feather name="youtube" size={10} color="#b94b42" />
                <Text style={[rv.amenityText, { color: '#b94b42' }]}>{data.videoLinks.filter(Boolean).length} video link{data.videoLinks.filter(Boolean).length > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {(data.facebookPage || data.website || data.youtubeChannel) && (
        <Section title={tr('reviewSocial')} rows={[
          { label: 'Facebook',      value: data.facebookPage ? '✓ Added' : '' },
          { label: 'Website',       value: data.website ? '✓ Added' : '' },
          { label: 'YouTube',       value: data.youtubeChannel ? '✓ Added' : '' },
        ]} />
      )}

      <View style={[rv.notice, { backgroundColor: colors.accent, borderColor: colors.primary + '33' }]}>
        <Feather name="shield" size={14} color={colors.primary} />
        <Text style={[rv.noticeText, { color: colors.accentForeground }]}>
          Your project will be reviewed by OG Landmark admin before going live. Save as draft to continue editing anytime.
        </Text>
      </View>
    </View>
  );
}

// ── Step completion check ─────────────────────────────────────────────────────
function isStepComplete(step: number, data: DeveloperProject): boolean {
  if (step === 0) return Boolean(data.name.trim() && data.shortDescription.trim());
  if (step === 1) return Boolean(data.city && data.address.trim());
  if (step === 2) return data.startingPrice > 0 && data.totalUnits > 0;
  if (step === 3) return Boolean(data.developmentStatus);
  if (step === 4) return true; // amenities optional
  if (step === 5) return Boolean(data.coverImageUri); // at least cover photo
  return true;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CreateProjectScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const { tr }   = useLanguage();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setDataRaw]  = useState<DeveloperProject>(() => blankProject(user?.id ?? ''));

  const set = (partial: Partial<DeveloperProject>) => setDataRaw((prev) => ({ ...prev, ...partial }));

  useEffect(() => {
    if (!editId) return;
    void getDevProjects(user?.id ?? '').then((projects) => {
      const found = projects.find((p) => p.id === editId);
      if (found) setDataRaw(found);
    });
  }, [editId, user?.id]);

  const stepLabels = [
    tr('stepBasicInfo'), tr('stepContact'),
    tr('stepPricing'), tr('stepLegal'),
    tr('stepAmenities'), 'Media',
    tr('stepReview'),
  ];

  const validate = (): string | null => {
    if (step === 0) {
      if (!data.name.trim())             return tr('errProjectName');
      if (!data.shortDescription.trim()) return tr('errShortDesc');
    }
    if (step === 1) {
      if (!data.city)                    return tr('errCityDev');
      if (!data.address.trim())          return tr('errAddressRequired');
    }
    if (step === 2) {
      if (data.startingPrice <= 0)       return tr('errStartingPrice');
      if (data.totalUnits <= 0)          return tr('errTotalUnitsInput');
    }
    return null;
  };

  const handleNext = () => {
    const err = validate();
    if (err) { Alert.alert('', err); return; }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const handleSave = async (submit: boolean) => {
    setSaving(true);
    try {
      const project: DeveloperProject = {
        ...data,
        status: submit ? 'Pending Review' : 'Draft',
        updatedAt: new Date().toISOString(),
      };
      await saveDevProject(project);
      Alert.alert(
        submit ? tr('projectSubmittedMsg') : tr('projectCreatedMsg'),
        submit ? '' : tr('projectCreatedDesc'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } finally {
      setSaving(false);
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const completedCount = Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => i).filter((i) => isStepComplete(i, data)).length;

  const steps = [
    <Step1      key={0} data={data} set={set} tr={tr} colors={colors} />,
    <Step2      key={1} data={data} set={set} tr={tr} colors={colors} />,
    <Step3      key={2} data={data} set={set} tr={tr} colors={colors} />,
    <Step4      key={3} data={data} set={set} tr={tr} colors={colors} />,
    <Step5      key={4} data={data} set={set} tr={tr} colors={colors} />,
    <Step6Media key={5} data={data} set={set} tr={tr} colors={colors} />,
    <Step6Review key={6} data={data} set={set} tr={tr} colors={colors} />,
  ];

  return (
    <KeyboardAvoidingView
      style={[wz.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ──────────────────────────────────── */}
      <View style={[wz.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())} hitSlop={12} style={wz.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[wz.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {editId ? 'Edit Project' : tr('createProjectTitle')}
          </Text>
          <Text style={[wz.headerSub, { color: colors.mutedForeground }]}>
            Step {step + 1} of {TOTAL_STEPS} · {completedCount}/{TOTAL_STEPS - 1} complete
          </Text>
        </View>
        <Pressable onPress={() => { void handleSave(false); }} disabled={saving}
          style={[wz.draftBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="save" size={12} color={colors.mutedForeground} />
          <Text style={[wz.draftBtnText, { color: colors.mutedForeground }]}>{tr('btnSaveDraft')}</Text>
        </Pressable>
      </View>

      {/* ── Step indicator ──────────────────────────── */}
      <View style={[wz.stepWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <StepIndicator current={step} total={TOTAL_STEPS} labels={stepLabels} colors={colors} />
      </View>

      {/* ── Form content ────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 20 }}>
          {steps[step]}
        </View>
      </ScrollView>

      {/* ── Footer navigation ───────────────────────── */}
      <View style={[wz.footer, { paddingBottom: botPad + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {step > 0 && (
          <Pressable onPress={() => setStep((s) => s - 1)}
            style={[wz.backFooterBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={15} color={colors.foreground} />
            <Text style={[wz.backFooterText, { color: colors.foreground }]}>{tr('btnBackStep')}</Text>
          </Pressable>
        )}
        {!isLastStep ? (
          <Pressable onPress={handleNext}
            style={[wz.nextBtn, { backgroundColor: colors.action, flex: step > 0 ? 1 : undefined, minWidth: 140 }]}>
            <Text style={wz.nextBtnText}>{tr('btnNextStep')}</Text>
            <Feather name="arrow-right" size={15} color="#ffffff" />
          </Pressable>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => { void handleSave(false); }} disabled={saving}
              style={[wz.draftFooterBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[wz.draftFooterText, { color: colors.foreground }]}>{tr('btnSaveDraft')}</Text>
            </Pressable>
            <Pressable onPress={() => { void handleSave(true); }} disabled={saving}
              style={[wz.submitBtn, { backgroundColor: colors.action }]}>
              <Feather name="send" size={14} color="#ffffff" />
              <Text style={wz.submitBtnText}>{saving ? 'Saving…' : tr('btnSubmitProject')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fd = StyleSheet.create({
  wrap:     { gap: 7 },
  label:    { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  hint:     { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: -3, lineHeight: 14 },
  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 14 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});

const tgl = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: 'center' },
  thumb: { width: 20, height: 20, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
});

const stp = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  btn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 18, height: 44 },
});

const sec = StyleSheet.create({
  wrap:  { borderTopWidth: 1, marginTop: 4, paddingTop: 14, alignItems: 'flex-start' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, paddingHorizontal: 8, marginTop: -9 },
});

const si = StyleSheet.create({
  progressBg:   { height: 3, width: '100%' },
  progressFill: { height: 3, borderRadius: 2 },
  wrap:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  stepCol:      { alignItems: 'center', gap: 4, flex: 1, minWidth: 50 },
  circle:       { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  num:          { fontFamily: 'Inter_700Bold', fontSize: 10 },
  label:        { fontFamily: 'Inter_500Medium', fontSize: 8, textAlign: 'center' },
});

const pp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});

const rv = StyleSheet.create({
  header:       { borderRadius: 16, padding: 18, gap: 4 },
  headerSub:    { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, color: '#ffffffaa' },
  headerTitle:  { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#ffffff', letterSpacing: -0.5, marginTop: 2 },
  headerType:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#ffffffbb', marginTop: 4 },
  section:      { borderWidth: 1, borderRadius: 16, padding: 14, gap: 0 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 8 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9 },
  rowLabel:     { fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1 },
  rowValue:     { fontFamily: 'Inter_600SemiBold', fontSize: 11, flex: 1.4, textAlign: 'right' },
  notice:       { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  noticeText:   { fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1, lineHeight: 17 },
  amenityChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  amenityText:  { fontFamily: 'Inter_500Medium', fontSize: 10 },
});

const md = StyleSheet.create({
  sectionIcon:      { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:     { fontFamily: 'Inter_700Bold', fontSize: 14 },
  sectionSub:       { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  coverWrap:        { width: '100%', height: 180, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  coverImage:       { width: '100%', height: '100%' },
  coverOverlay:     { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  removeBtn:        { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  coverBadge:       { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  coverBadgeText:   { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#ffffff' },
  coverPlaceholder: { width: '100%', height: 180, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  placeholderSub:   { fontFamily: 'Inter_400Regular', fontSize: 11 },
  pickBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  pickBtnText:      { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' },
  addPhotoBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addPhotoBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  galleryEmpty:     { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 24, alignItems: 'center', gap: 8 },
  galleryEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  thumbWrap:        { width: 100, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumb:            { width: '100%', height: '100%' },
  thumbRemove:      { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 7, backgroundColor: '#dc262699', alignItems: 'center', justifyContent: 'center' },
  thumbBadge:       { position: 'absolute', bottom: 5, left: 5, width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  thumbBadgeText:   { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#ffffff' },
  thumbAdd:         { width: 100, height: 80, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  thumbAddText:     { fontFamily: 'Inter_500Medium', fontSize: 10 },
  videoClearBtn:    { width: 36, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipsCard:         { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  tipsText:         { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1, lineHeight: 18 },
});

const wz = StyleSheet.create({
  screen:          { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:     { fontFamily: 'Inter_700Bold', fontSize: 15 },
  headerSub:       { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  backBtn:         { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  draftBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  draftBtnText:    { fontFamily: 'Inter_500Medium', fontSize: 11 },
  stepWrap:        { borderBottomWidth: 1 },
  footer:          { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  backFooterBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1 },
  backFooterText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  nextBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  nextBtnText:     { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' },
  draftFooterBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, borderWidth: 1 },
  draftFooterText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  submitBtn:       { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 13 },
  submitBtnText:   { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' },
});
