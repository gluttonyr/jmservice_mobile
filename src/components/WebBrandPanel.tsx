import { StyleSheet, Text, View } from 'react-native';

import { OrbitBackground, OrbitStar } from '@/components/orbit';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';

const POINTS = ['Dépôts et retraits sécurisés', 'Discussion directe avec l’équipe', 'Événements et forum de la communauté'];

// Website on a computer: left half of the sign-in / sign-up pages.
export default function WebBrandPanel() {
  return (
    <OrbitBackground style={styles.panel}>
      <View style={styles.inner}>
        <JMLogo size={300} />
        <Text style={styles.tagline}>
          VOS TRANSACTIONS <Text style={styles.taglineGold}>EN ORBITE</Text>
        </Text>
        <View style={styles.points}>
          {POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <OrbitStar size={16} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    </OrbitBackground>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 1, borderRightColor: Colors.border },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  tagline: { color: Colors.chrome, fontFamily: Font.title, fontSize: 30, marginTop: 24, marginBottom: 36, textAlign: 'center' },
  taglineGold: { color: Colors.gold },
  points: { gap: 16 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointText: { color: Colors.chrome, fontFamily: Font.bodyMedium, fontSize: 17 },
});
