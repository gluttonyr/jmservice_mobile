import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, pick } from '@/constants/colors';

/** Rounded square back button of the « Orbite » screens. */
export function BackButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, style]}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      hitSlop={8}
    >
      <ChevronLeft color={Colors.chrome} size={24} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: pick('rgba(17,28,63,0.85)', '#FFFFFF'),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
