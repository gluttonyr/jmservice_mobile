import { OrbitStar } from '@/components/orbit';
import JMLogo from '@/components/ui/JMLogo';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { UserRole } from '@/data_api/models/user.types';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

// Minimum time the splash stays on screen, so the animation is seen even when the session resolves at once.
// Same length as Matistore's splash (0.8 s fade + 2.2 s progress + 0.4 s).
const MIN_SPLASH_MS = 3400;

// Gold orbit around the logo, in units of the ring box width (design 02_Splash).
const RING = { rx: 0.452, ry: 0.21, tilt: -5 };
// Stars sitting on the gold orbit: angle on the ellipse (degrees, 90 = bottom), size (box width units), colour.
const RING_STARS = [
  { angle: 152, size: 0.07, color: Colors.goldText, glow: true },
  { angle: 126, size: 0.075, color: Colors.goldText, glow: true },
  { angle: 104, size: 0.065, color: Colors.goldText, glow: true },
  { angle: 84, size: 0.09, color: Colors.pureWhite, glow: true },
  { angle: 22, size: 0.045, color: pick('#7E8DB8', '#7A86A8'), glow: false },
  { angle: -4, size: 0.055, color: pick('#7E8DB8', '#7A86A8'), glow: false },
] as const;
// Faint dots in the night sky (fractions of the screen).
const SKY_DOTS = [
  { x: 0.13, y: 0.145, r: 2.2 }, { x: 0.77, y: 0.107, r: 1.8 }, { x: 0.85, y: 0.25, r: 2.4 },
  { x: 0.23, y: 0.783, r: 1.6 }, { x: 0.7, y: 0.83, r: 2 }, { x: 0.06, y: 0.5, r: 1.4 },
];

/** Point of the tilted orbit at `angleDeg`, relative to the ring centre. */
function orbitPoint(angleDeg: number, width: number) {
  const t = (angleDeg * Math.PI) / 180;
  const tilt = (RING.tilt * Math.PI) / 180;
  const x = RING.rx * width * Math.cos(t);
  const y = RING.ry * width * Math.sin(t);
  return { x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt) };
}

function RingStar({ id, size, color, glow, delay }: { id: string; size: number; color: string; glow: boolean; delay: number }) {
  const appear = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay + 600),
      Animated.timing(twinkle, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(twinkle, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [appear, twinkle, delay]);
  const halo = size * 1.9;
  return (
    <Animated.View
      style={{
        width: halo,
        height: halo,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: Animated.multiply(appear, twinkle),
        transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
      }}
    >
      {glow && (
        <Svg width={halo} height={halo} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`halo-${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity="0.4" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill={`url(#halo-${id})`} />
        </Svg>
      )}
      <OrbitStar size={size} color={color} />
    </Animated.View>
  );
}

export default function SplashScreen() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const box = Math.min(screenW, 520);
  const boxH = box * 0.66;
  // The logo picture has transparent margins: 0.84 of the box gives the ~70 % visible width of the design.
  const logoSize = (box * 0.84) / 1.35; // JMLogo is 1.35 × size wide

  const bgAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const { user, token, authReady } = useAuth();
  const [animationDone, setAnimationDone] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Visibility only depends on plain timings (never on a spring finishing).
    Animated.timing(bgAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.timing(logoFade, { toValue: 1, duration: 800, delay: 150, useNativeDriver: true }).start();
    Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, delay: 150, useNativeDriver: true }).start();
    Animated.timing(ringAnim, { toValue: 1, duration: 900, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(textAnim, { toValue: 1, duration: 700, delay: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const orbit = Animated.loop(Animated.timing(orbitAnim, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true }));
    orbit.start();
    const done = setTimeout(() => setAnimationDone(true), MIN_SPLASH_MS);
    const dotsTimer = setInterval(() => setDots((d) => (d.length >= 3 ? '' : `${d}.`)), 400);
    return () => { orbit.stop(); clearTimeout(done); clearInterval(dotsTimer); };
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

  // A small light travelling around the gold orbit.
  const samples = Array.from({ length: 25 }, (_, i) => i / 24);
  const orbitX = orbitAnim.interpolate({ inputRange: samples, outputRange: samples.map((s) => orbitPoint(s * 360, box).x) });
  const orbitY = orbitAnim.interpolate({ inputRange: samples, outputRange: samples.map((s) => orbitPoint(s * 360, box).y) });
  const textSlide = textAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const cx = box / 2;
  const cy = boxH / 2;

  return (
    <View style={styles.container}>
      {/* Night sky with a blue glow behind the logo */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgAnim }]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="splashGlow" cx="50%" cy="46%" rx="85%" ry="42%">
              <Stop offset="0" stopColor="#1B3F9E" stopOpacity="1" />
              <Stop offset="0.45" stopColor="#10236A" stopOpacity="1" />
              <Stop offset="1" stopColor="#060B1E" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#splashGlow)" />
          {SKY_DOTS.map((d) => (
            <Circle key={`${d.x}-${d.y}`} cx={d.x * screenW} cy={d.y * screenH} r={d.r} fill="#8FA3D6" opacity={0.7} />
          ))}
        </Svg>
      </Animated.View>

      <View style={styles.center}>
        <View style={{ width: box, height: boxH, alignItems: 'center', justifyContent: 'center' }}>
          {/* Orbits */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: ringAnim, transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] },
            ]}
            pointerEvents="none"
          >
            <Svg width={box} height={boxH}>
              <Ellipse
                cx={cx} cy={cy} rx={box * 0.6} ry={box * 0.31}
                transform={`rotate(${RING.tilt} ${cx} ${cy})`}
                stroke="rgba(90,140,255,0.28)" strokeWidth={1.2} fill="none"
              />
              <Ellipse
                cx={cx} cy={cy} rx={box * RING.rx} ry={box * RING.ry}
                transform={`rotate(${RING.tilt} ${cx} ${cy})`}
                stroke="rgba(255,194,51,0.6)" strokeWidth={1.6} fill="none"
              />
            </Svg>
          </Animated.View>

          {/* Logo, slightly above the centre of the orbit (as in the design) */}
          <Animated.View style={{ marginBottom: box * 0.08, opacity: logoFade, transform: [{ scale: logoScale }] }}>
            <JMLogo size={logoSize} />
          </Animated.View>

          {/* Light travelling on the orbit */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.orbitLight,
              { left: cx - 4, top: cy - 4, opacity: ringAnim, transform: [{ translateX: orbitX }, { translateY: orbitY }] },
            ]}
          />

          {/* Stars on the orbit, lit one after the other */}
          {RING_STARS.map((star, i) => {
            const p = orbitPoint(star.angle, box);
            const size = star.size * box;
            const halo = size * 1.9;
            return (
              <View key={star.angle} pointerEvents="none" style={{ position: 'absolute', left: cx + p.x - halo / 2, top: cy + p.y - halo / 2 }}>
                <RingStar id={String(i)} size={size} color={star.color} glow={star.glow} delay={700 + i * 140} />
              </View>
            );
          })}
        </View>

        <Animated.View style={[styles.texts, { opacity: textAnim, transform: [{ translateY: textSlide }] }]}>
          <Text style={styles.headline}>
            RECHARGEZ. ENCAISSEZ.{'\n'}<Text style={styles.headlineGold}>SANS ATTENDRE.</Text>
          </Text>
          <Text style={styles.loading}>Connexion à votre espace{dots}</Text>
        </Animated.View>
      </View>

      <Animated.Text style={[styles.footer, { opacity: textAnim }]}>DÉPÔTS & RETRAITS 1XBET · MOBILE MONEY</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.night, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  orbitLight: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFE7A3',
    borderWidth: 2,
    borderColor: 'rgba(255,194,51,0.45)',
  },
  texts: { alignItems: 'center', marginTop: 34, paddingHorizontal: 24, maxWidth: 420 },
  headline: { color: Colors.chrome, fontFamily: Font.title, fontSize: 32, lineHeight: 46, textAlign: 'center' },
  headlineGold: { color: Colors.goldText },
  loading: { color: pick('#B9C3DA', '#4A5886'), fontFamily: Font.bodyMedium, fontSize: 16, marginTop: 18, minWidth: 220, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 44,
    color: pick('#8D9AC0', '#66739A'),
    fontFamily: Font.bodyBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
