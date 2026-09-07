import React, { ReactNode, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useMobileContent } from '@/hooks/useMobileContent';
import {
  AREA_UNITS,
  AreaUnit,
  AgriculturalIncomeResult,
  calculateAgriculturalIncome,
  calculateCropYield,
  calculateLandInvestment,
  calculatePropertyPrice,
  calculateROI,
  convertArea,
  CropYieldResult,
  formatNumber,
  formatPercent,
  formatPKR,
  parseInputNumber,
  PropertyPriceResult,
  ROICalculationResult,
  validateNumber,
} from '@/lib/propertyTools';

type Colors = ReturnType<typeof useColors>;
type IconName = keyof typeof Feather.glyphMap;

const CITIES = [
  'Okara',
  'Depalpur',
  'Renala Khurd',
  'Hujrah Shah Muqeem',
  'Basirpur',
  'Haveli Lakha',
];

const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Agricultural Land',
  'Plot',
  'House',
  'Farm Land',
];

const PRICE_UNITS: Array<{ key: AreaUnit; label: string }> = [
  { key: 'marla', label: 'Marla' },
  { key: 'kanal', label: 'Kanal' },
  { key: 'sqft', label: 'Sq.ft' },
  { key: 'acre', label: 'Acre' },
];

const AGRI_AREA_UNITS: Array<{ key: AreaUnit; label: string }> = [
  { key: 'marla', label: 'Marla' },
  { key: 'kanal', label: 'Kanal' },
  { key: 'acre', label: 'Acre' },
  { key: 'sqft', label: 'Sq.ft' },
  { key: 'hectare', label: 'Hectare' },
];

const CROPS = ['Wheat', 'Rice', 'Maize', 'Sugarcane', 'Cotton', 'Potato', 'Other'];

const AGRI_TERMS: Array<{ icon: IconName; title: string; description: string }> = [
  { icon: 'droplet', title: 'Nehri Land', description: 'Land with dependable canal irrigation, commonly valued for consistent crop production.' },
  { icon: 'cloud-rain', title: 'Barani Land', description: 'Rain-fed land that depends primarily on seasonal rainfall rather than a canal or tube well.' },
  { icon: 'disc', title: 'Tube Well', description: 'A groundwater pump that supplies irrigation when canal water is unavailable.' },
  { icon: 'sun', title: 'Solar Tube Well', description: 'A solar-powered tube well that can reduce running costs and electricity dependency.' },
  { icon: 'sunrise', title: 'Kharif', description: 'The warm-season crop cycle, generally planted with the summer rains and harvested in autumn.' },
  { icon: 'wind', title: 'Rabi', description: 'The cool-season crop cycle, generally planted in autumn and harvested in spring.' },
  { icon: 'bar-chart-2', title: 'Yield', description: 'The amount of crop produced from a defined area, commonly measured per acre.' },
  { icon: 'maximize', title: 'Acre', description: 'A standard land-area unit equal to 43,560 square feet or 8 Pakistan-standard kanal.' },
];

const IRRIGATION_OPTIONS: Array<{ key: string; icon: IconName; label: string }> = [
  { key: 'canal', icon: 'droplet', label: 'Canal / Nehri Water' },
  { key: 'tubeWell', icon: 'disc', label: 'Tube Well' },
  { key: 'solar', icon: 'sun', label: 'Solar Tube Well' },
  { key: 'barani', icon: 'cloud-rain', label: 'Rain-fed / Barani' },
  { key: 'other', icon: 'plus-circle', label: 'Other Irrigation' },
];

function OptionChips({
  options,
  selected,
  onSelect,
  colors,
}: {
  options: Array<{ key: string; label: string }>;
  selected: string;
  onSelect: (key: string) => void;
  colors: Colors;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipContent}
    >
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.selectionBackground : colors.secondary,
                borderColor: active ? colors.selectionBorder : colors.border,
                borderWidth: active ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? colors.selectionForeground : colors.foreground, fontWeight: active ? '600' : '400' }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
  placeholder = '0',
  keyboardType = 'decimal-pad',
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: Colors;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'numeric' | 'default';
  optional?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}{optional ? ' · OPTIONAL' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={`${colors.mutedForeground}99`}
        style={[
          styles.input,
          {
            backgroundColor: colors.secondary,
            borderColor: value.trim() ? `${colors.action}88` : colors.border,
            color: colors.foreground,
          },
        ]}
      />
    </View>
  );
}

function Card({
  title,
  description,
  icon,
  children,
  colors,
}: {
  title: string;
  description?: string;
  icon: IconName;
  children: ReactNode;
  colors: Colors;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.action}16` }]}>
          <Feather name={icon} size={17} color={colors.action} />
        </View>
        <View style={styles.cardHeaderCopy}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
          {description ? (
            <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>{description}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  colors,
  secondary = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  colors: Colors;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: secondary ? colors.secondary : colors.action,
          borderColor: secondary ? colors.border : colors.action,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <Feather name={icon} size={14} color={secondary ? colors.foreground : colors.actionForeground} />
      <Text style={[styles.actionButtonText, { color: secondary ? colors.foreground : colors.actionForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ErrorMessage({ message, colors }: { message: string; colors: Colors }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow}>
      <Feather name="alert-circle" size={13} color={colors.destructive} />
      <Text style={[styles.errorText, { color: colors.destructive }]}>{message}</Text>
    </View>
  );
}

function ResultItem({
  label,
  value,
  colors,
  emphasize = false,
}: {
  label: string;
  value: string;
  colors: Colors;
  emphasize?: boolean;
}) {
  return (
    <View style={[styles.resultItem, { borderColor: colors.border }]}>
      <Text style={[styles.resultValue, { color: emphasize ? colors.action : colors.foreground }]}>{value}</Text>
      <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ResultGrid({
  items,
  colors,
  columns = 2,
}: {
  items: Array<{ label: string; value: string; emphasize?: boolean }>;
  colors: Colors;
  columns?: 2 | 3;
}) {
  return (
    <View style={[styles.resultGrid, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {items.map((item) => (
        <View key={item.label} style={{ width: columns === 3 ? '33.333%' : '50%' }}>
          <ResultItem {...item} colors={colors} />
        </View>
      ))}
    </View>
  );
}

function AreaUnitOptions({
  selected,
  onSelect,
  colors,
  units = AREA_UNITS,
}: {
  selected: AreaUnit;
  onSelect: (unit: AreaUnit) => void;
  colors: Colors;
  units?: Array<{ key: AreaUnit; label: string }>;
}) {
  return (
    <OptionChips
      options={units.map((unit) => ({ key: unit.key, label: unit.label }))}
      selected={selected}
      onSelect={(key) => onSelect(key as AreaUnit)}
      colors={colors}
    />
  );
}

function AreaConverter({ colors }: { colors: Colors }) {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState<AreaUnit>('marla');
  const [toUnit, setToUnit] = useState<AreaUnit>('kanal');

  const parsed = parseInputNumber(value);
  const error = value.trim() ? validateNumber(value, 'Area') ?? '' : '';
  const converted = !error && Number.isFinite(parsed) ? convertArea(parsed, fromUnit, toUnit) : null;
  const fromLabel = AREA_UNITS.find((unit) => unit.key === fromUnit)?.label ?? fromUnit;
  const toLabel = AREA_UNITS.find((unit) => unit.key === toUnit)?.label ?? toUnit;

  const reset = () => {
    setValue('');
    setFromUnit('marla');
    setToUnit('kanal');
  };

  return (
    <Card
      title="Area Converter"
      description="Instant Pakistan-standard land conversions."
      icon="refresh-cw"
      colors={colors}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>FROM UNIT</Text>
      <AreaUnitOptions selected={fromUnit} onSelect={setFromUnit} colors={colors} />
      <Field label={`AREA (${fromLabel.toUpperCase()})`} value={value} onChange={setValue} colors={colors} placeholder={`Enter ${fromLabel}`} />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>TO UNIT</Text>
      <AreaUnitOptions selected={toUnit} onSelect={setToUnit} colors={colors} />

      <ErrorMessage message={error} colors={colors} />
      {converted !== null ? (
        <View style={[styles.heroResult, { backgroundColor: `${colors.action}0D`, borderColor: `${colors.action}33` }]}>
          <Text style={[styles.heroResultLabel, { color: colors.action }]}>CONVERTED AREA</Text>
          <Text style={[styles.heroResultValue, { color: colors.foreground }]}>
            {formatNumber(converted, 2)} {toLabel}
          </Text>
          <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
            {formatNumber(parsed, 2)} {fromLabel} = {formatNumber(converted, 2)} {toLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <ActionButton
          label="Swap units"
          icon="repeat"
          colors={colors}
          secondary
          onPress={() => {
            setFromUnit(toUnit);
            setToUnit(fromUnit);
          }}
        />
        <ActionButton label="Reset" icon="rotate-ccw" colors={colors} secondary onPress={reset} />
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        1 Marla = 272.25 sq.ft · 1 Kanal = 20 Marla = 5,445 sq.ft · 1 Acre = 8 Kanal
      </Text>
    </Card>
  );
}

function PriceEstimator({ colors }: { colors: Colors }) {
  const [city, setCity] = useState(CITIES[0] ?? 'Okara');
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0] ?? 'Residential');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('marla');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PropertyPriceResult | null>(null);

  const calculate = () => {
    const areaError = validateNumber(area, 'Area');
    const priceError = validateNumber(pricePerUnit, 'Price per unit');
    if (areaError || priceError) {
      setError(areaError ?? priceError ?? 'Enter valid values.');
      setResult(null);
      return;
    }
    const calculated = calculatePropertyPrice(parseInputNumber(area), parseInputNumber(pricePerUnit));
    if (!calculated) {
      setError('Unable to calculate this estimate. Check the values and try again.');
      setResult(null);
      return;
    }
    setError('');
    setResult(calculated);
  };

  const reset = () => {
    setArea('');
    setPricePerUnit('');
    setAreaUnit('marla');
    setCity(CITIES[0] ?? 'Okara');
    setPropertyType(PROPERTY_TYPES[0] ?? 'Residential');
    setError('');
    setResult(null);
  };

  return (
    <Card
      title="Price Estimator"
      description="Enter your own price per unit; no live market data is assumed."
      icon="trending-up"
      colors={colors}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>CITY</Text>
      <OptionChips options={CITIES.map((item) => ({ key: item, label: item }))} selected={city} onSelect={setCity} colors={colors} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>PROPERTY TYPE</Text>
      <OptionChips options={PROPERTY_TYPES.map((item) => ({ key: item, label: item }))} selected={propertyType} onSelect={setPropertyType} colors={colors} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>AREA UNIT</Text>
      <AreaUnitOptions selected={areaUnit} onSelect={setAreaUnit} colors={colors} units={PRICE_UNITS} />
      <Field label={`AREA (${areaUnit.toUpperCase()})`} value={area} onChange={(next) => { setArea(next); setResult(null); }} colors={colors} placeholder="e.g. 10" />
      <Field
        label={`PRICE PER ${areaUnit.toUpperCase()} (PKR)`}
        value={pricePerUnit}
        onChange={(next) => { setPricePerUnit(next); setResult(null); }}
        colors={colors}
        placeholder="e.g. 500000"
      />
      <ErrorMessage message={error} colors={colors} />
      <View style={styles.actionRow}>
        <ActionButton label="Calculate" icon="trending-up" colors={colors} onPress={calculate} />
        <ActionButton label="Reset" icon="rotate-ccw" colors={colors} secondary onPress={reset} />
      </View>
      {result ? (
        <View style={[styles.resultPanel, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}55` }]}>
          <Text style={[styles.heroResultLabel, { color: colors.primary }]}>ESTIMATED PROPERTY PRICE</Text>
          <Text style={[styles.heroResultValue, { color: colors.foreground }]}>{formatPKR(result.totalPrice)}</Text>
          <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
            {formatNumber(result.area, 2)} {areaUnit} × {formatPKR(result.pricePerUnit)} · {propertyType}, {city}
          </Text>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>Manual estimate based on your entered price per unit.</Text>
        </View>
      ) : null}
    </Card>
  );
}

type ROIFields = {
  initialInvestment: string;
  purchasePrice: string;
  developmentCost: string;
  annualRentalIncome: string;
  annualExpenses: string;
  expectedSellingPrice: string;
  investmentPeriodYears: string;
};

const EMPTY_ROI_FIELDS: ROIFields = {
  initialInvestment: '',
  purchasePrice: '',
  developmentCost: '',
  annualRentalIncome: '',
  annualExpenses: '',
  expectedSellingPrice: '',
  investmentPeriodYears: '',
};

function ROICalculator({ colors }: { colors: Colors }) {
  const [fields, setFields] = useState<ROIFields>(EMPTY_ROI_FIELDS);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ROICalculationResult | null>(null);
  const update = (key: keyof ROIFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const calculate = () => {
    const issues = [
      validateNumber(fields.initialInvestment, 'Initial investment', { required: false, allowZero: true }),
      validateNumber(fields.purchasePrice, 'Purchase price'),
      validateNumber(fields.developmentCost, 'Renovation / development cost', { allowZero: true }),
      validateNumber(fields.annualRentalIncome, 'Annual rental income', { allowZero: true }),
      validateNumber(fields.annualExpenses, 'Annual expenses', { allowZero: true }),
      validateNumber(fields.expectedSellingPrice, 'Expected selling price'),
      validateNumber(fields.investmentPeriodYears, 'Investment period'),
    ].filter(Boolean);
    if (issues.length > 0) {
      setError(issues[0] ?? 'Enter valid values.');
      setResult(null);
      return;
    }
    const calculated = calculateROI({
      initialInvestment: fields.initialInvestment.trim() ? parseInputNumber(fields.initialInvestment) : undefined,
      purchasePrice: parseInputNumber(fields.purchasePrice),
      developmentCost: parseInputNumber(fields.developmentCost),
      annualRentalIncome: parseInputNumber(fields.annualRentalIncome),
      annualExpenses: parseInputNumber(fields.annualExpenses),
      expectedSellingPrice: parseInputNumber(fields.expectedSellingPrice),
      investmentPeriodYears: parseInputNumber(fields.investmentPeriodYears),
    });
    if (!calculated) {
      setError('Unable to calculate ROI. Confirm the investment period and amounts.');
      setResult(null);
      return;
    }
    setError('');
    setResult(calculated);
  };

  const reset = () => {
    setFields(EMPTY_ROI_FIELDS);
    setError('');
    setResult(null);
  };

  return (
    <Card
      title="ROI Calculator"
      description="Rental income, capital gain and total investment return."
      icon="percent"
      colors={colors}
    >
      <Field label="INITIAL INVESTMENT (PKR)" value={fields.initialInvestment} onChange={(value) => update('initialInvestment', value)} colors={colors} placeholder="Optional reference amount" optional />
      <Field label="PURCHASE PRICE (PKR)" value={fields.purchasePrice} onChange={(value) => update('purchasePrice', value)} colors={colors} placeholder="e.g. 10000000" />
      <Field label="RENOVATION / DEVELOPMENT COST (PKR)" value={fields.developmentCost} onChange={(value) => update('developmentCost', value)} colors={colors} placeholder="0" />
      <View style={styles.twoColumn}>
        <View style={styles.column}>
          <Field label="ANNUAL RENT (PKR)" value={fields.annualRentalIncome} onChange={(value) => update('annualRentalIncome', value)} colors={colors} placeholder="e.g. 1000000" />
        </View>
        <View style={styles.column}>
          <Field label="ANNUAL EXPENSES (PKR)" value={fields.annualExpenses} onChange={(value) => update('annualExpenses', value)} colors={colors} placeholder="e.g. 200000" />
        </View>
      </View>
      <Field label="EXPECTED SELLING PRICE (PKR)" value={fields.expectedSellingPrice} onChange={(value) => update('expectedSellingPrice', value)} colors={colors} placeholder="e.g. 12000000" />
      <Field label="INVESTMENT PERIOD (YEARS)" value={fields.investmentPeriodYears} onChange={(value) => update('investmentPeriodYears', value)} colors={colors} placeholder="e.g. 5" keyboardType="numeric" />
      <ErrorMessage message={error} colors={colors} />
      <View style={styles.actionRow}>
        <ActionButton label="Calculate ROI" icon="percent" colors={colors} onPress={calculate} />
        <ActionButton label="Reset" icon="rotate-ccw" colors={colors} secondary onPress={reset} />
      </View>
      {result ? <ROIResult result={result} colors={colors} /> : null}
    </Card>
  );
}

function ROIResult({ result, colors }: { result: ROICalculationResult; colors: Colors }) {
  return (
    <View style={[styles.resultPanel, { backgroundColor: `${colors.action}0D`, borderColor: `${colors.action}33` }]}>
      <Text style={[styles.heroResultLabel, { color: colors.action }]}>INVESTMENT OUTCOME</Text>
      <ResultGrid
        colors={colors}
        items={[
          { label: 'Total Investment', value: formatPKR(result.totalInvestment), emphasize: true },
          { label: 'Total Profit', value: formatPKR(result.totalProfit), emphasize: true },
          { label: 'Annual Net Income', value: formatPKR(result.annualNetIncome) },
          { label: 'Capital Gain', value: formatPKR(result.capitalGain) },
          { label: 'Total Rental Income', value: formatPKR(result.totalRentalIncome) },
          { label: 'Break-even', value: result.breakEvenYears ? `${formatNumber(result.breakEvenYears, 2)} years` : 'N/A' },
        ]}
      />
      <View style={[styles.metricBanner, { backgroundColor: colors.action }]}>
        <View>
          <Text style={[styles.metricLabel, { color: colors.actionForeground }]}>ROI</Text>
          <Text style={[styles.metricValue, { color: colors.actionForeground }]}>{formatPercent(result.roiPercent)}</Text>
        </View>
        <View>
          <Text style={[styles.metricLabel, { color: `${colors.actionForeground}B8` }]}>ANNUAL ROI</Text>
          <Text style={[styles.metricValue, { color: colors.actionForeground }]}>{formatPercent(result.annualRoiPercent)}</Text>
        </View>
      </View>
      <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
        Monthly rent: {formatPKR(result.monthlyRentalIncome)} · Monthly net: {formatPKR(result.monthlyNetIncome)}
      </Text>
    </View>
  );
}

function CropYieldCalculator({ colors }: { colors: Colors }) {
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('acre');
  const [crop, setCrop] = useState(CROPS[0] ?? 'Wheat');
  const [yieldPerAcre, setYieldPerAcre] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CropYieldResult | null>(null);

  const calculate = () => {
    const issues = [
      validateNumber(area, 'Land area'),
      validateNumber(yieldPerAcre, 'Expected yield per acre', { allowZero: true }),
      validateNumber(sellingPrice, 'Selling price per unit', { allowZero: true }),
    ].filter(Boolean);
    if (issues.length > 0) {
      setError(issues[0] ?? 'Enter valid values.');
      setResult(null);
      return;
    }
    const calculated = calculateCropYield({
      landArea: parseInputNumber(area),
      areaUnit,
      expectedYieldPerAcre: parseInputNumber(yieldPerAcre),
      sellingPricePerUnit: parseInputNumber(sellingPrice),
    });
    if (!calculated) {
      setError('Unable to calculate crop yield. Check your values.');
      setResult(null);
      return;
    }
    setError('');
    setResult(calculated);
  };

  const reset = () => {
    setArea('');
    setAreaUnit('acre');
    setCrop(CROPS[0] ?? 'Wheat');
    setYieldPerAcre('');
    setSellingPrice('');
    setError('');
    setResult(null);
  };

  return (
    <View>
      <Text style={[styles.sectionEyebrow, { color: colors.action }]}>CROP YIELD CALCULATOR</Text>
      <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>Use your own crop yield and selling price; no market data is assumed.</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>CROP</Text>
      <OptionChips options={CROPS.map((item) => ({ key: item, label: item }))} selected={crop} onSelect={setCrop} colors={colors} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>AREA UNIT</Text>
      <AreaUnitOptions selected={areaUnit} onSelect={setAreaUnit} colors={colors} units={AGRI_AREA_UNITS} />
      <Field label={`LAND AREA (${areaUnit.toUpperCase()})`} value={area} onChange={setArea} colors={colors} placeholder="e.g. 1" />
      <Field label="EXPECTED YIELD PER ACRE (UNITS)" value={yieldPerAcre} onChange={setYieldPerAcre} colors={colors} placeholder="e.g. 40" />
      <Field label="SELLING PRICE PER UNIT (PKR)" value={sellingPrice} onChange={setSellingPrice} colors={colors} placeholder="e.g. 10000" />
      <ErrorMessage message={error} colors={colors} />
      <View style={styles.actionRow}>
        <ActionButton label="Calculate" icon="bar-chart-2" colors={colors} onPress={calculate} />
        <ActionButton label="Reset" icon="rotate-ccw" colors={colors} secondary onPress={reset} />
      </View>
      {result ? (
        <ResultGrid
          colors={colors}
          items={[
            { label: 'Total Acres', value: formatNumber(result.totalAcres, 2), emphasize: true },
            { label: 'Crop', value: crop },
            { label: 'Total Production', value: formatNumber(result.totalProduction, 2) },
            { label: 'Estimated Revenue', value: formatPKR(result.estimatedRevenue), emphasize: true },
          ]}
        />
      ) : null}
    </View>
  );
}

function AgriculturalIncomeCalculator({ colors }: { colors: Colors }) {
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('acre');
  const [rent, setRent] = useState('');
  const [expenses, setExpenses] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AgriculturalIncomeResult | null>(null);

  const calculate = () => {
    const issues = [
      validateNumber(area, 'Land area'),
      validateNumber(rent, 'Annual rent per acre', { allowZero: true }),
      validateNumber(expenses, 'Annual farming expenses', { allowZero: true }),
      validateNumber(purchasePrice, 'Purchase price', { required: false, allowZero: true }),
    ].filter(Boolean);
    if (issues.length > 0) {
      setError(issues[0] ?? 'Enter valid values.');
      setResult(null);
      return;
    }
    const calculated = calculateAgriculturalIncome({
      landArea: parseInputNumber(area),
      areaUnit,
      annualRentPerAcre: parseInputNumber(rent),
      annualFarmingExpenses: parseInputNumber(expenses),
      purchasePrice: purchasePrice.trim() ? parseInputNumber(purchasePrice) : undefined,
    });
    if (!calculated) {
      setError('Unable to calculate agricultural income. Check your values.');
      setResult(null);
      return;
    }
    setError('');
    setResult(calculated);
  };

  const reset = () => {
    setArea('');
    setAreaUnit('acre');
    setRent('');
    setExpenses('');
    setPurchasePrice('');
    setError('');
    setResult(null);
  };

  return (
    <View>
      <Text style={[styles.sectionEyebrow, { color: colors.action }]}>AGRICULTURAL LAND INCOME</Text>
      <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>Estimate gross rent, net income and annual return from your own inputs.</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>AREA UNIT</Text>
      <AreaUnitOptions selected={areaUnit} onSelect={setAreaUnit} colors={colors} units={AGRI_AREA_UNITS} />
      <Field label={`LAND AREA (${areaUnit.toUpperCase()})`} value={area} onChange={setArea} colors={colors} placeholder="e.g. 1" />
      <Field label="ANNUAL RENT / ACRE (PKR)" value={rent} onChange={setRent} colors={colors} placeholder="e.g. 250000" />
      <Field label="ANNUAL FARMING EXPENSES (PKR)" value={expenses} onChange={setExpenses} colors={colors} placeholder="e.g. 80000" />
      <Field label="PURCHASE PRICE (PKR)" value={purchasePrice} onChange={setPurchasePrice} colors={colors} placeholder="Optional for ROI" optional />
      <ErrorMessage message={error} colors={colors} />
      <View style={styles.actionRow}>
        <ActionButton label="Calculate" icon="bar-chart-2" colors={colors} onPress={calculate} />
        <ActionButton label="Reset" icon="rotate-ccw" colors={colors} secondary onPress={reset} />
      </View>
      {result ? (
        <ResultGrid
          colors={colors}
          items={[
            { label: 'Total Acres', value: formatNumber(result.totalAcres, 2), emphasize: true },
            { label: 'Gross Annual Income', value: formatPKR(result.grossAnnualIncome) },
            { label: 'Net Annual Income', value: formatPKR(result.netAnnualIncome), emphasize: true },
            { label: 'Monthly Equivalent', value: formatPKR(result.monthlyEquivalentIncome) },
            { label: 'Annual ROI', value: result.annualRoiPercent === null ? 'N/A' : formatPercent(result.annualRoiPercent) },
          ]}
        />
      ) : null}
    </View>
  );
}

function AgriGuide({ colors }: { colors: Colors }) {
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [otherIrrigation, setOtherIrrigation] = useState('');

  return (
    <View>
      <Text style={[styles.sectionEyebrow, { color: colors.action }]}>FARMING TERMS</Text>
      <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>Useful terms for evaluating agricultural properties in Pakistan.</Text>
      <View style={styles.termList}>
        {AGRI_TERMS.map((term) => (
          <View key={term.title} style={[styles.termItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={[styles.termIcon, { backgroundColor: `${colors.action}16` }]}>
              <Feather name={term.icon} size={15} color={colors.action} />
            </View>
            <View style={styles.termCopy}>
              <Text style={[styles.termTitle, { color: colors.foreground }]}>{term.title}</Text>
              <Text style={[styles.termDescription, { color: colors.mutedForeground }]}>{term.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionEyebrow, { color: colors.action, marginTop: 22 }]}>WATER / IRRIGATION</Text>
      <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>Mark the irrigation facilities available on a property.</Text>
      <View style={styles.termList}>
        {IRRIGATION_OPTIONS.map((option) => {
          const isAvailable = available[option.key] ?? false;
          return (
            <Pressable
              key={option.key}
              onPress={() => setAvailable((current) => ({ ...current, [option.key]: !isAvailable }))}
              style={[
                styles.irrigationItem,
                {
                  backgroundColor: isAvailable ? `${colors.action}12` : colors.secondary,
                  borderColor: isAvailable ? `${colors.action}66` : colors.border,
                },
              ]}
            >
              <Feather name={option.icon} size={15} color={isAvailable ? colors.action : colors.mutedForeground} />
              <Text style={[styles.irrigationText, { color: colors.foreground }]}>{option.label}</Text>
              <Feather name={isAvailable ? 'check-circle' : 'circle'} size={17} color={isAvailable ? colors.action : colors.mutedForeground} />
            </Pressable>
          );
        })}
      </View>
      <Field label="OTHER IRRIGATION DETAILS" value={otherIrrigation} onChange={setOtherIrrigation} colors={colors} placeholder="e.g. shared watercourse" keyboardType="default" optional />
    </View>
  );
}

function AgriLandTools({ colors }: { colors: Colors }) {
  const [activeTab, setActiveTab] = useState<'convert' | 'yield' | 'income' | 'guide'>('convert');
  const tabs = [
    { key: 'convert', label: 'Area' },
    { key: 'yield', label: 'Yield' },
    { key: 'income', label: 'Income' },
    { key: 'guide', label: 'Guide' },
  ];

  return (
    <Card
      title="Agri Land Tools"
      description="Area, crop economics, income and irrigation utilities."
      icon="sun"
      colors={colors}
    >
      <OptionChips options={tabs} selected={activeTab} onSelect={(key) => setActiveTab(key as typeof activeTab)} colors={colors} />
      {activeTab === 'convert' ? (
        <View>
          <Text style={[styles.sectionEyebrow, { color: colors.action }]}>LAND AREA CONVERTER</Text>
          <Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>Convert agricultural land between common Pakistan units.</Text>
          <AgriculturalAreaConverter colors={colors} />
        </View>
      ) : null}
      {activeTab === 'yield' ? <CropYieldCalculator colors={colors} /> : null}
      {activeTab === 'income' ? <AgriculturalIncomeCalculator colors={colors} /> : null}
      {activeTab === 'guide' ? <AgriGuide colors={colors} /> : null}
    </Card>
  );
}

function AgriculturalAreaConverter({ colors }: { colors: Colors }) {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState<AreaUnit>('acre');
  const [toUnit, setToUnit] = useState<AreaUnit>('kanal');
  const parsed = parseInputNumber(value);
  const error = value.trim() ? validateNumber(value, 'Area') ?? '' : '';
  const converted = !error && Number.isFinite(parsed) ? convertArea(parsed, fromUnit, toUnit) : null;

  return (
    <View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>FROM</Text>
      <AreaUnitOptions selected={fromUnit} onSelect={setFromUnit} colors={colors} units={AGRI_AREA_UNITS} />
      <Field label="LAND AREA" value={value} onChange={setValue} colors={colors} placeholder="Enter area" />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>TO</Text>
      <AreaUnitOptions selected={toUnit} onSelect={setToUnit} colors={colors} units={AGRI_AREA_UNITS} />
      <ErrorMessage message={error} colors={colors} />
      {converted !== null ? (
        <View style={[styles.heroResult, { backgroundColor: `${colors.action}0D`, borderColor: `${colors.action}33` }]}>
          <Text style={[styles.heroResultLabel, { color: colors.action }]}>CONVERTED AREA</Text>
          <Text style={[styles.heroResultValue, { color: colors.foreground }]}>{formatNumber(converted, 2)} {toUnit}</Text>
        </View>
      ) : null}
    </View>
  );
}

type LandFields = {
  area: string;
  pricePerUnit: string;
  purchasePrice: string;
  developmentCost: string;
  expectedSellingPrice: string;
  holdingPeriod: string;
};

const EMPTY_LAND_FIELDS: LandFields = {
  area: '',
  pricePerUnit: '',
  purchasePrice: '',
  developmentCost: '',
  expectedSellingPrice: '',
  holdingPeriod: '',
};

function LandCalculator({ colors }: { colors: Colors }) {
  const [fields, setFields] = useState<LandFields>(EMPTY_LAND_FIELDS);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('marla');
  const [error, setError] = useState('');
  const update = (key: keyof LandFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const liveResult = useMemo(() => {
    const area = parseInputNumber(fields.area);
    const pricePerUnit = fields.pricePerUnit.trim() ? parseInputNumber(fields.pricePerUnit) : 0;
    const purchasePrice = fields.purchasePrice.trim() ? parseInputNumber(fields.purchasePrice) : undefined;
    const developmentCost = parseInputNumber(fields.developmentCost);
    const expectedSellingPrice = parseInputNumber(fields.expectedSellingPrice);
    const holdingPeriodYears = fields.holdingPeriod.trim() ? parseInputNumber(fields.holdingPeriod) : undefined;
    if (
      !Number.isFinite(area) ||
      area <= 0 ||
      !Number.isFinite(pricePerUnit) ||
      pricePerUnit < 0 ||
      (purchasePrice !== undefined && (!Number.isFinite(purchasePrice) || purchasePrice <= 0)) ||
      !Number.isFinite(developmentCost) ||
      developmentCost < 0 ||
      !Number.isFinite(expectedSellingPrice) ||
      expectedSellingPrice <= 0 ||
      (holdingPeriodYears !== undefined && (!Number.isFinite(holdingPeriodYears) || holdingPeriodYears <= 0)) ||
      (purchasePrice === undefined && !fields.pricePerUnit.trim())
    ) {
      return null;
    }
    return calculateLandInvestment({
      area,
      areaUnit,
      pricePerUnit,
      purchasePrice,
      developmentCost,
      expectedSellingPrice,
      holdingPeriodYears,
    });
  }, [areaUnit, fields]);

  const calculate = () => {
    const issues = [
      validateNumber(fields.area, 'Land area'),
      fields.pricePerUnit.trim() ? validateNumber(fields.pricePerUnit, 'Price per unit', { allowZero: true }) : null,
      fields.purchasePrice.trim() ? validateNumber(fields.purchasePrice, 'Purchase price') : null,
      validateNumber(fields.developmentCost, 'Development cost', { allowZero: true }),
      validateNumber(fields.expectedSellingPrice, 'Expected selling price'),
      fields.holdingPeriod.trim() ? validateNumber(fields.holdingPeriod, 'Holding period') : null,
    ].filter(Boolean);
    if (issues.length > 0) {
      setError(issues[0] ?? 'Enter valid values.');
      return;
    }
    if (!fields.purchasePrice.trim() && !fields.pricePerUnit.trim()) {
      setError('Enter either a total purchase price or a price per unit.');
      return;
    }
    if (!liveResult) {
      setError('Unable to calculate this land investment. Check the entered values.');
      return;
    }
    setError('');
  };

  const reset = () => {
    setFields(EMPTY_LAND_FIELDS);
    setAreaUnit('marla');
    setError('');
  };

  return (
    <Card
      title="Land Calculator"
      description="Combine land area, purchase cost, development and ROI."
      icon="grid"
      colors={colors}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>AREA UNIT</Text>
      <AreaUnitOptions selected={areaUnit} onSelect={setAreaUnit} colors={colors} units={PRICE_UNITS} />
      <Field label={`LAND AREA (${areaUnit.toUpperCase()})`} value={fields.area} onChange={(value) => update('area', value)} colors={colors} placeholder="e.g. 10" />
      <Field label={`PRICE PER ${areaUnit.toUpperCase()} (PKR)`} value={fields.pricePerUnit} onChange={(value) => update('pricePerUnit', value)} colors={colors} placeholder="Fallback if purchase price is blank" optional />
      <Field label="TOTAL PURCHASE PRICE (PKR)" value={fields.purchasePrice} onChange={(value) => update('purchasePrice', value)} colors={colors} placeholder="Direct total purchase cost" optional />
      <Field label="DEVELOPMENT COST (PKR)" value={fields.developmentCost} onChange={(value) => update('developmentCost', value)} colors={colors} placeholder="e.g. 500000" />
      <Field label="EXPECTED SELLING PRICE (PKR)" value={fields.expectedSellingPrice} onChange={(value) => update('expectedSellingPrice', value)} colors={colors} placeholder="e.g. 7000000" />
      <Field label="HOLDING PERIOD (YEARS)" value={fields.holdingPeriod} onChange={(value) => update('holdingPeriod', value)} colors={colors} placeholder="Optional for annualized ROI" optional keyboardType="numeric" />
      <ErrorMessage message={error} colors={colors} />
      <View style={styles.actionRow}>
        <ActionButton label="Calculate" icon="grid" colors={colors} onPress={calculate} />
        <ActionButton label="Reset" icon="rotate-ccw" colors={colors} secondary onPress={reset} />
      </View>
      {liveResult ? (
        <ResultGrid
          colors={colors}
          items={[
            { label: 'Total Purchase Cost', value: formatPKR(liveResult.totalPurchaseCost), emphasize: true },
            { label: 'Total Investment', value: formatPKR(liveResult.totalInvestment), emphasize: true },
            { label: 'Expected Return', value: formatPKR(liveResult.expectedSellingPrice) },
            { label: 'Expected Profit', value: formatPKR(liveResult.expectedProfit), emphasize: true },
            { label: 'ROI', value: formatPercent(liveResult.roiPercent) },
            { label: 'Annualized ROI', value: liveResult.annualizedRoiPercent === null ? 'N/A' : formatPercent(liveResult.annualizedRoiPercent) },
          ]}
        />
      ) : null}
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Enter either a direct total purchase price or a price per selected unit. Results update as valid inputs are completed.
      </Text>
    </Card>
  );
}

const TOOL_ALIASES: Record<string, 'area' | 'price' | 'roi' | 'agri' | 'land'> = {
  area: 'area',
  price: 'price',
  roi: 'roi',
  agri: 'agri',
  land: 'land',
  calc: 'land',
};

const TOOL_META = {
  area: { title: 'Area Converter', description: 'Convert Marla, Kanal, square feet, square yard, square meter, Acre and Hectare.' },
  price: { title: 'Price Estimator', description: 'Estimate a property price from your own area and price-per-unit inputs.' },
  roi: { title: 'ROI Calculator', description: 'Model rental income, capital gain, expenses and investment return.' },
  agri: { title: 'Agri Land Tools', description: 'Calculate crop yield and farm income, convert area and review irrigation terms.' },
  land: { title: 'Land Calculator', description: 'Combine area, purchase cost, development cost and expected return.' },
} as const;

export default function PropertyToolsScreen() {
  const colors = useColors();
  const content = useMobileContent();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tool?: string | string[] }>();
  const rawTool = Array.isArray(params.tool) ? params.tool[0] : params.tool;
  const selectedTool = rawTool ? TOOL_ALIASES[rawTool] : undefined;
  const toolsCopy = content?.screens?.tools || {};
  const baseHeader = selectedTool ? TOOL_META[selectedTool] : { title: 'Tools & Calculators', description: 'Property utilities built for Pakistan — use your own figures for transparent estimates.' };
  const header = {
    title: toolsCopy[`${selectedTool || 'home'}Title`] || toolsCopy.title || baseHeader.title,
    description: toolsCopy[`${selectedTool || 'home'}Description`] || toolsCopy.description || baseHeader.description,
  };
  const topPadding = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={[styles.header, { backgroundColor: colors.action, paddingTop: topPadding + 14 }]}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.72 : 1 }]}
          >
            <Feather name="arrow-left" size={20} color={colors.actionForeground} />
          </Pressable>
          <Text style={[styles.headerEyebrow, { color: colors.primary }]}>{toolsCopy.eyebrow || 'OG LANDMARK'}</Text>
          <Text style={[styles.headerTitle, { color: colors.actionForeground }]}>{header.title}</Text>
          <Text style={[styles.headerDescription, { color: `${colors.actionForeground}B8` }]}>{header.description}</Text>
        </View>

        <View style={[styles.disclaimer, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}44` }]}>
          <Feather name="info" size={13} color={colors.primary} />
          <Text style={[styles.disclaimerText, { color: colors.foreground }]}>
            Estimates are indicative only. Use verified property and agricultural data before making a decision.
          </Text>
        </View>

        <View style={styles.content}>
          {!selectedTool || selectedTool === 'area' ? <AreaConverter colors={colors} /> : null}
          {!selectedTool || selectedTool === 'price' ? <PriceEstimator colors={colors} /> : null}
          {!selectedTool || selectedTool === 'roi' ? <ROICalculator colors={colors} /> : null}
          {!selectedTool || selectedTool === 'agri' ? <AgriLandTools colors={colors} /> : null}
          {!selectedTool || selectedTool === 'land' ? <LandCalculator colors={colors} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headerEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2.3, marginBottom: 4 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.4 },
  headerDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 6, maxWidth: 350 },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', margin: 16, borderWidth: 1, borderRadius: 12, padding: 12 },
  disclaimerText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  content: { paddingHorizontal: 16, gap: 16 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  cardIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardHeaderCopy: { flex: 1 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  cardDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15, marginTop: 3 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8, marginBottom: 7, marginTop: 2 },
  field: { marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 13 },
  chipContent: { gap: 7, paddingBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 19, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 10 },
  actionButton: { flex: 1, minHeight: 40, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10 },
  actionButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 2, marginBottom: 8 },
  errorText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  heroResult: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 3, marginBottom: 10 },
  heroResultLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1, marginBottom: 4 },
  heroResultValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 },
  resultPanel: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 4 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 13, overflow: 'hidden', marginTop: 8 },
  resultItem: { minHeight: 66, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 10, borderRightWidth: 1, borderBottomWidth: 1 },
  resultValue: { fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'center', marginBottom: 3 },
  resultLabel: { fontFamily: 'Inter_400Regular', fontSize: 9, textAlign: 'center' },
  resultHint: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 8 },
  metricBanner: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 13, marginTop: 10 },
  metricLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 2 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14, marginTop: 5 },
  twoColumn: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  sectionEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1, marginTop: 4, marginBottom: 4 },
  sectionCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginBottom: 12 },
  termList: { gap: 9 },
  termItem: { flexDirection: 'row', gap: 11, borderWidth: 1, borderRadius: 13, padding: 11 },
  termIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  termCopy: { flex: 1 },
  termTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 3 },
  termDescription: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  irrigationItem: { minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  irrigationText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11 },
});