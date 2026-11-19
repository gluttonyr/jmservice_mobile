import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Ellipse } from 'react-native-svg';
import { OrbitStar } from './OrbitStar';

/** Icon in a blue sphere crossed by a gold orbit, at the top of the sign-in and sign-up screens. */
export function HeroIcon({ children, size = 120 }: { children: ReactNode; size?: number }) {
  const ringW = size * 3.3;
  const ringH = size * 1.55;
  return (
    <View style={[styles.wrap, { width: ringW, height: ringH }]}>
      <Svg width={ringW} height={ringH} style={StyleSheet.absoluteFill} viewBox="0 0 330 155" pointerEvents="none">
        <Ellipse cx="165" cy="78" rx="158" ry="58" transform="rotate(-10 165 78)" stroke="rgba(255,194,51,0.6)" strokeWidth="1.6" fill="none" />
      </Svg>
      <LinearGradient
        colors={['#4C94FF', '#1E4FC4']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.sphere, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {children}
      </LinearGradient>
      <View style={[styles.star, { top: ringH / 2 - size / 2 - 6, left: ringW / 2 + size * 0.32 }]} pointerEvents="none">
        <OrbitStar size={size * 0.34} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  sphere: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(140,185,255,0.45)',
    shadowColor: '#2F7BFF',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  star: { position: 'absolute' },
});
