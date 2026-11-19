import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';

/** Top bar of the discussions: optional back chevron, avatar, title and subtitle, actions on the right. */
export function ChatHeader({
  title,
  subtitle,
  avatar,
  onBack,
  right,
  titleStyle = 'name',
  subtitleColor = Colors.textSecondary,
}: {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  /** name = bold sans serif (a person, a desk); brand = italic uppercase title (FORUM). */
  titleStyle?: 'name' | 'brand';
  subtitleColor?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8}>
          <ChevronLeft color={Colors.chrome} size={28} />
        </TouchableOpacity>
      )}
      {avatar}
      <View style={styles.copy}>
        <Text style={titleStyle === 'brand' ? styles.brand : styles.name} numberOfLines={1}>
          {titleStyle === 'brand' ? title.toUpperCase() : title}
        </Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(8,16,44,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { padding: 2 },
  copy: { flex: 1, minWidth: 0 },
  name: { color: Colors.chrome, fontFamily: Font.bodyExtraBold, fontSize: 19 },
  brand: { color: Colors.chrome, fontFamily: Font.title, fontSize: 24, lineHeight: 30 },
  subtitle: { fontFamily: Font.bodyMedium, fontSize: 14 },
});
