import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { BackButton } from './BackButton';

/** Header of the deposit and withdrawal flows: back button, italic title and "Étape X sur N". */
export function FlowHeader({
  title,
  subtitle,
  onBack,
  right,
  top = 0,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
  /** Safe area inset at the top of the screen. */
  top?: number;
}) {
  return (
    <View style={[styles.root, { paddingTop: top + 14 }]}>
      <BackButton onPress={onBack} />
      <View style={styles.copy}>
        <Text style={[styles.title, title.length > 14 && styles.titleLong]} numberOfLines={1} adjustsFontSizeToFit>{title.toUpperCase()}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 24, lineHeight: 30 },
  titleLong: { fontSize: 20 },
  subtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14 },
});
