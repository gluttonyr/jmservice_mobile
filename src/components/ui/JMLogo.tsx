import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

// Width / height of assets/jm-logo.png (transparent JM Services logo, "SERVICES" band included).
const LOGO_RATIO = 936 / 551;

interface JMLogoProps {
  /** Size of the square the old logo used to fill: the wide logo keeps about the same visual weight. */
  size?: number;
  /** Kept for the existing call sites: the logo already contains "SERVICES", no text is added. */
  showText?: boolean;
}

export default function JMLogo({ size = 90 }: JMLogoProps) {
  const width = Math.round(size * 1.35);
  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel="JM Services">
      <Image
        source={require('@/assets/jm-logo.png')}
        style={{ width, height: Math.round(width / LOGO_RATIO) }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
