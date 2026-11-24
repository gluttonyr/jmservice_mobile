import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';

type Props = TextInputProps & {
  label: string;
  icon?: ReactNode;
  /** Element at the right edge, e.g. the show-password eye. */
  right?: ReactNode;
  /** Custom content instead of the text input (e.g. country code + phone). */
  children?: ReactNode;
};

/** Labelled input of the « Orbite » forms: night field, blue border while focused. */
export function OrbitField({ label, icon, right, children, style, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        {children ?? (
          <TextInput
            placeholderTextColor={Colors.textSecondary}
            {...inputProps}
            style={[styles.input, style]}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          />
        )}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

export const orbitFieldStyles = StyleSheet.create({
  input: {
    flex: 1,
    color: Colors.chrome,
    fontFamily: Font.bodyMedium,
    fontSize: 16,
    paddingVertical: 16,
    // The browser draws its own focus ring inside the rounded field.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
});

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: {
    color: Colors.textSecondary,
    fontFamily: Font.bodySemiBold,
    fontSize: 14,
    marginBottom: 8,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.night,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: pick('rgba(120,150,230,0.18)', 'rgba(40,70,150,0.16)'),
    paddingHorizontal: 16,
  },
  boxFocused: {
    borderColor: Colors.blue,
    shadowColor: Colors.blue,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  icon: { marginRight: 12 },
  input: orbitFieldStyles.input,
  right: { marginLeft: 8 },
});
