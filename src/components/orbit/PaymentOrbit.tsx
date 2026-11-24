import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { OrbitStar } from './OrbitStar';

const NODE = 32;
const RADIUS_MAX = 112;
const TOP = 18;

/**
 * Follow-up of a deposit drawn as an orbit: four stations clockwise from the top
 * (labels[0] at the top, then right, bottom, left). `current` is 1-based; stations before it are done.
 * `children` is shown in the middle of the ring (status, amount…).
 */
export function PaymentOrbit({ labels, current, children }: { labels: [string, string, string, string]; current: number; children?: ReactNode }) {
  const [width, setWidth] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const r = Math.min(RADIUS_MAX, Math.max(0, width / 2 - 78));
  const size = r * 2 + NODE + 8 + TOP;
  const cx = width / 2;
  const cy = (size + TOP) / 2;
  const circumference = 2 * Math.PI * r;
  // Gold arc from the top to a little past the current station.
  const arc = Math.min(1, (current - 1) / 4 + 0.08) * circumference;

  // top, right, bottom, left
  const positions = [
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
  ];

  return (
    <View style={[styles.root, { height: size + 8 }]} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Circle cx={cx} cy={cy} r={r + 16} stroke="rgba(90,162,255,0.16)" strokeWidth={1} strokeDasharray="2 6" fill="none" />
            <Circle cx={cx} cy={cy} r={r} stroke="rgba(90,162,255,0.32)" strokeWidth={3} fill="rgba(30,70,180,0.18)" />
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={Colors.gold}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${arc} ${circumference}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </Svg>

          <View style={[styles.center, { top: cy - r + NODE, left: cx - r + 12, width: r * 2 - 24, height: r * 2 - NODE * 2 }]}>
            {children}
          </View>

          {positions.map((p, i) => {
            const step = i + 1;
            const done = step < current;
            const active = step === current;
            const label = labels[i];
            const labelStyle = [
              styles.label,
              (active || done) && styles.labelOn,
              i === 0 && { left: p.x + NODE / 2 + 8, top: p.y - NODE / 2 - 16 },
              i === 1 && { left: p.x + NODE / 2 + 6, top: p.y - 20, width: 74 },
              i === 2 && { left: p.x + NODE / 2 + 8, top: p.y + 2 },
              i === 3 && { right: width - p.x + NODE / 2 + 6, top: p.y - 20, width: 74, textAlign: 'right' as const },
            ];
            return (
              <View key={label} pointerEvents="none">
                {active && (
                  <Animated.View
                    style={[
                      styles.glow,
                      { left: p.x - NODE * 0.85, top: p.y - NODE * 0.85, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.node,
                    { left: p.x - NODE / 2, top: p.y - NODE / 2 },
                    done && styles.nodeDone,
                    active && styles.nodeActive,
                  ]}
                >
                  {active ? <OrbitStar size={18} color={Colors.onGold} /> : done ? <Check color={Colors.onGold} size={16} strokeWidth={3} /> : null}
                </View>
                <Text style={labelStyle}>{label}</Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', marginBottom: 18 },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: NODE * 1.7, height: NODE * 1.7, borderRadius: NODE * 0.85, borderWidth: 6, borderColor: 'rgba(255,194,51,0.45)' },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    backgroundColor: pick('#0B1438', '#FFFFFF'),
    borderWidth: 2,
    borderColor: pick('#2A3A6E', '#C5CFE6'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  nodeActive: { backgroundColor: Colors.gold, borderColor: '#FFE29A' },
  label: { position: 'absolute', color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 13, lineHeight: 17 },
  labelOn: { color: Colors.goldText },
});
