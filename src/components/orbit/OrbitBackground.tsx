import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Ellipse } from 'react-native-svg';
import { Gradients } from '@/constants/colors';
import { OrbitStar } from './OrbitStar';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** client = blue night with gold orbits; admin = turquoise night. */
  variant?: 'client' | 'admin';
  /** Draws the two orbit rings and stars across the top of the screen. */
  orbits?: boolean;
};

/**
 * True inside a layout that already paints one background behind all its pages (website on a computer:
 * the tab pages are a centred column, so each page painting its own gradient would show seams on its sides).
 */
export const OrbitBackdropContext = createContext(false);

/** Page background of the « Orbite » design: blue glow at the top fading into the night. */
export function OrbitBackground({ children, style, variant = 'client', orbits = true }: Props) {
  const admin = variant === 'admin';
  if (useContext(OrbitBackdropContext)) {
    return <View style={[styles.root, styles.transparent, style]}>{children}</View>;
  }
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={admin ? Gradients.admin : Gradients.page}
        locations={admin ? [0, 0.6] : [0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {orbits && (
        <View style={styles.orbits} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice">
            <Ellipse
              cx="220" cy="150" rx="260" ry="80"
              transform="rotate(-12 220 150)"
              stroke={admin ? 'rgba(25,211,197,0.35)' : 'rgba(255,194,51,0.45)'}
              strokeWidth="1.2"
              fill="none"
            />
            <Ellipse
              cx="200" cy="170" rx="300" ry="105"
              transform="rotate(-8 200 170)"
              stroke="rgba(90,162,255,0.22)"
              strokeWidth="1"
              fill="none"
            />
          </Svg>
          <View style={[styles.star, { top: '18%', right: '12%' }]}>
            <OrbitStar size={18} color={admin ? '#19D3C5' : '#FFC233'} />
          </View>
          <View style={[styles.star, { top: '62%', left: '8%' }]}>
            <OrbitStar size={8} color="#8FB4FF" opacity={0.6} />
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060B1E' },
  transparent: { backgroundColor: 'transparent' },
  orbits: { position: 'absolute', top: 0, left: 0, right: 0, height: 320, overflow: 'hidden' },
  star: { position: 'absolute' },
});
