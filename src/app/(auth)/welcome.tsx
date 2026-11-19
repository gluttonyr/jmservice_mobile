import { OrbitBackground, Plaque } from '@/components/orbit';
import GreenButton from '@/components/ui/GreenButton';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { usePromoCode } from '@/hooks/usePromoCode';
import { useWideWeb } from '@/hooks/useWideWeb';
import { router } from 'expo-router';
import { ShieldCheck, Zap } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Badge({ icon, label, style }: { icon: React.ReactNode; label: string; style?: object }) {
  return (
    <View style={[styles.badge, style]}>
      {icon}
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const wide = useWideWeb();
  const promoCode = usePromoCode();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Visibility only depends on plain timings; the spring just moves the sheet into place.
    Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }).start();
  }, []);

  // Not shown on iOS (App Store review).
  const showPromo = Platform.OS !== 'ios' && !!promoCode;

  const actions = (
    <>
      <View style={styles.buttons}>
        <GreenButton title="Se connecter" onPress={() => router.push('/(auth)/login')} size="lg" style={styles.btn} />
        <GreenButton
          title="Créer un compte"
          onPress={() => router.push('/(auth)/register-step1')}
          size="lg"
          variant="outline"
          style={styles.btn}
        />
      </View>
      {showPromo && (
        <View style={styles.promoRow}>
          <Text style={styles.promoLabel}>Code promo</Text>
          <Plaque value={promoCode} style={styles.promoPlaque} />
        </View>
      )}
    </>
  );

  // Website on a computer: the left panel already shows the logo and the slogan.
  if (wide) {
    return (
      <OrbitBackground orbits={false} style={styles.wideContainer}>
        <Animated.View style={[styles.wideContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.headline}>
            DÉPOSEZ. RETIREZ.{'\n'}<Text style={styles.headlineGold}>EN QUELQUES SECONDES.</Text>
          </Text>
          <Text style={styles.body}>Rechargez et videz votre compte de paris avec Mobile Money.</Text>
          {actions}
        </Animated.View>
      </OrbitBackground>
    );
  }

  return (
    <OrbitBackground>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <Badge
            icon={<Zap color={Colors.gold} size={18} />}
            label="Rapide"
            style={[styles.badgeRight, { top: insets.top + 16 }]}
          />
          <Animated.View style={{ opacity: logoAnim, transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
            <JMLogo size={250} />
          </Animated.View>
          <Badge icon={<ShieldCheck color={Colors.success} size={18} />} label="Sécurisé 100%" style={styles.badgeLeft} />
        </View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 28, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.headline}>
            DÉPOSEZ. RETIREZ.{'\n'}<Text style={styles.headlineGold}>EN QUELQUES SECONDES.</Text>
          </Text>
          <Text style={styles.body}>
            Rechargez et videz votre compte de paris avec Mobile Money. Vos transactions en orbite.
          </Text>
          {actions}
        </Animated.View>
      </ScrollView>
    </OrbitBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  hero: { minHeight: 380, alignItems: 'center', justifyContent: 'center', paddingBottom: 48 },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(6,11,30,0.72)',
    borderWidth: 1,
  },
  badgeRight: { right: 20, borderColor: 'rgba(255,194,51,0.45)' },
  badgeLeft: { left: 20, bottom: 8, borderColor: 'rgba(61,220,151,0.4)' },
  badgeText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 15 },
  sheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(120,150,230,0.14)',
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  headline: { color: Colors.chrome, fontFamily: Font.title, fontSize: 34, lineHeight: 40 },
  headlineGold: { color: Colors.gold },
  body: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 16, lineHeight: 24, marginTop: 14, marginBottom: 26 },
  buttons: { width: '100%', gap: 14 },
  btn: { width: '100%' },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26 },
  promoLabel: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 15 },
  promoPlaque: { flex: 1 },
  wideContainer: { justifyContent: 'center' },
  wideContent: { paddingHorizontal: 40 },
});
