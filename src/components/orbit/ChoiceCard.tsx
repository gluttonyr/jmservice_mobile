import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';

/**
 * One choice of a list (bookmaker, operator): logo tile, name, caption and a radio on the right.
 * `soon` replaces the radio with a "Bientôt" badge and makes the card unselectable.
 */
export function ChoiceCard({
  logo,
  title,
  caption,
  selected,
  soon = false,
  onPress,
}: {
  logo: ReactNode;
  title: string;
  caption?: string;
  selected: boolean;
  soon?: boolean;
  onPress: () => void;
}) {
  const body = (
    <>
      <View style={styles.logo}>{logo}</View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!caption && <Text style={styles.caption} numberOfLines={1}>{caption}</Text>}
      </View>
      {soon ? (
        <View style={styles.soon}><Text style={styles.soonText}>Bientôt</Text></View>
      ) : selected ? (
        <View style={styles.radioOn}><Check color={Colors.onGold} size={18} strokeWidth={3} /></View>
      ) : (
        <View style={styles.radioOff} />
      )}
    </>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={soon}
      activeOpacity={0.8}
      style={[styles.halo, selected && styles.haloOn, soon && styles.soonCard]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: soon }}
      accessibilityLabel={soon ? `${title}, bientôt disponible` : title}
    >
      {selected ? (
        <LinearGradient colors={[pick('#1B3A8C', '#EEF4FF'), pick('#0F1F55', '#DCE8FF')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, styles.cardOn]}>
          {body}
        </LinearGradient>
      ) : (
        <View style={styles.card}>{body}</View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  halo: { borderRadius: 30, padding: 4, marginBottom: 10 },
  haloOn: { backgroundColor: 'rgba(255,194,51,0.12)' },
  soonCard: { opacity: 0.55 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 26,
    backgroundColor: pick('rgba(17,28,63,0.9)', '#FFFFFF'),
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cardOn: { borderWidth: 2, borderColor: Colors.gold },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: Colors.pureWhite,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 18 },
  caption: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, marginTop: 2 },
  radioOn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  radioOff: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: pick('#2A3A6E', '#C5CFE6') },
  soon: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,194,51,0.16)' },
  soonText: { color: Colors.goldText, fontFamily: Font.bodyBold, fontSize: 12 },
});
