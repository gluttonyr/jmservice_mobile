import { OrbitBackground, OrbitStar } from '@/components/orbit';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { UserRole } from '@/data_api/models/user.types';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

// Minimum time the splash stays on screen, so the animation is seen even when the session resolves at once.
const MIN_SPLASH_MS = 2600;

// Stars placed on the orbit ring around the logo (percent of the ring box), each twinkling with its own delay.
const RING_STARS = [
  { left: '8%', top: '62%', size: 22, color: Colors.gold, delay: 0 },
  { left: '19%', top: '75%', size: 26, color: Colors.gold, delay: 350 },
  { left: '33%', top: '79%', size: 20, color: Colors.gold, delay: 700 },
  { left: '52%', top: '76%', size: 28, color: Colors.pureWhite, delay: 1050 },
  { left: '90%', top: '32%', size: 18, color: '#8FB4FF', delay: 500 },
] as const;

function TwinklingStar({ delay, size, color }: { delay: number; size: number; color: string }) {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);
  return (
    <Animated.View style={{ opacity, transform: [{ scale: opacity.interpolate({ inputRange: [0.25, 1], outputRange: [0.75, 1] }) }] }}>
      <OrbitStar size={size} color={color} />
    </Animated.View>
  );
}

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const { user, token, authReady } = useAuth();
  const [animationDone, setAnimationDone] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Visibility only depends on plain timings (never on a spring finishing).
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    Animated.timing(textAnim, { toValue: 1, duration: 1300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
    const done = setTimeout(() => setAnimationDone(true), MIN_SPLASH_MS);
    const dotsTimer = setInterval(() => setDots((d) => (d.length >= 3 ? '' : `${d}.`)), 400);
    return () => { clearTimeout(done); clearInterval(dotsTimer); };
  }, []);

  // On attend à la fois la fin de l'animation ET la résolution réelle de la
  // session (token + validation) avant de décider où rediriger — plus de
  // délai deviné, et on route directement vers le bon espace (admin/user).
  useEffect(() => {
    if (!animationDone || !authReady) return;
    if (token && user) {
      router.replace(user.role === UserRole.ADMIN ? '/(admin)/admin-home' : '/(tabs)/home');
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [animationDone, authReady, token, user]);

  const textSlide = textAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <OrbitBackground orbits={false} style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={[styles.ringBox, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 400 260" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Ellipse cx="200" cy="140" rx="190" ry="88" transform="rotate(-6 200 140)" stroke="rgba(255,194,51,0.55)" strokeWidth="1.6" fill="none" />
            <Ellipse cx="200" cy="140" rx="240" ry="120" transform="rotate(-6 200 140)" stroke="rgba(90,162,255,0.22)" strokeWidth="1" fill="none" />
          </Svg>
          <JMLogo size={210} />
          {RING_STARS.map((star) => (
            <View key={`${star.left}-${star.top}`} style={[styles.ringStar, { left: star.left, top: star.top }]} pointerEvents="none">
              <TwinklingStar delay={star.delay} size={star.size} color={star.color} />
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.texts, { opacity: textAnim, transform: [{ translateY: textSlide }] }]}>
          <Text style={styles.headline}>
            VOS TRANSACTIONS <Text style={styles.headlineGold}>EN ORBITE</Text>
          </Text>
          <Text style={styles.loading}>Connexion à votre espace{dots}</Text>
        </Animated.View>
      </View>

      <Text style={styles.footer}>DÉPÔTS & RETRAITS · MOBILE MONEY</Text>
    </OrbitBackground>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ringBox: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 400 / 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringStar: { position: 'absolute' },
  texts: { alignItems: 'center', marginTop: 40 },
  headline: {
    color: Colors.chrome,
    fontFamily: Font.title,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
  },
  headlineGold: { color: Colors.gold },
  loading: { color: Colors.textSecondary, fontFamily: Font.bodyMedium, fontSize: 16, marginTop: 16, minWidth: 220, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 48,
    color: Colors.textSecondary,
    fontFamily: Font.bodyBold,
    fontSize: 12,
    letterSpacing: 3,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
