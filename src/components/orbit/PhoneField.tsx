import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import CountryPicker, { Country, CountryCode, DARK_THEME } from '@/components/CountryPicker';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { OrbitField, orbitFieldStyles } from './OrbitField';

export type PhoneValue = { countryCode: CountryCode; callingCode: string; number: string };

// Togo by default (country of the clients).
export const DEFAULT_PHONE: PhoneValue = { countryCode: 'TG', callingCode: '228', number: '' };

/** International form sent to the server, e.g. "+22890000000" (spaces removed), or "" when no number was typed. */
export function fullPhone(value: PhoneValue): string {
  const digits = value.number.replace(/\D/g, '');
  return digits ? `+${value.callingCode}${digits}` : '';
}

type Props = {
  label: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  onSubmitEditing?: () => void;
};

/** Phone number of the « Orbite » forms: country calling code picker + number. */
export function PhoneField({ label, value, onChange, onSubmitEditing }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const onSelectCountry = (country: Country) => {
    onChange({ ...value, countryCode: country.cca2, callingCode: country.callingCode[0] });
    setShowPicker(false);
  };

  return (
    <OrbitField label={label}>
      <TouchableOpacity
        style={styles.countrySelector}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
        accessibilityLabel="Choisir le pays"
      >
        <CountryPicker
          countryCode={value.countryCode}
          withFlag
          withEmoji
          withFilter
          withCallingCode
          withAlphaFilter
          theme={DARK_THEME}
          onSelect={onSelectCountry}
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          // The picker renders its own flag button: hidden, it is opened from this button.
          containerButtonStyle={styles.pickerHidden}
        />
        <Text style={styles.callingCodeText}>+{value.callingCode}</Text>
        <ChevronDown color={Colors.textSecondary} size={16} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TextInput
        style={orbitFieldStyles.input}
        placeholder="XX XX XX XX"
        placeholderTextColor={Colors.textSecondary}
        value={value.number}
        onChangeText={(number) => onChange({ ...value, number })}
        keyboardType="phone-pad"
        autoComplete="tel"
        onSubmitEditing={onSubmitEditing}
      />
    </OrbitField>
  );
}

export type ContactMethod = 'phone' | 'email';

/** « Téléphone | E-mail » switch above the sign-in / sign-up fields. */
export function ContactMethodTabs({ value, onChange }: { value: ContactMethod; onChange: (v: ContactMethod) => void }) {
  const tabs: { key: ContactMethod; label: string }[] = [
    { key: 'phone', label: 'Téléphone' },
    { key: 'email', label: 'E-mail' },
  ];
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  countrySelector: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingRight: 4 },
  pickerHidden: { opacity: 0, position: 'absolute', width: 0, height: 0 },
  callingCodeText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16, marginLeft: 2 },
  divider: { width: 1, height: 24, backgroundColor: Colors.border, marginHorizontal: 12 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.night,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(120,150,230,0.18)',
    padding: 4,
    marginBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12 },
  tabActive: { backgroundColor: 'rgba(47,123,255,0.22)', borderWidth: 1, borderColor: 'rgba(90,162,255,0.55)' },
  tabText: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 14 },
  tabTextActive: { color: Colors.chrome },
});
