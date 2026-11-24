import { StyleSheet, Text, View } from 'react-native';
import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { OrbitStar } from './OrbitStar';

/**
 * Progress line of the « Orbite » flows: one star per step, gold up to the current step.
 * `current` is 1-based.
 */
export function StarStepper({ steps, current, color = Colors.gold, activeColor, compact = false }: {
  steps: string[];
  current: number;
  /** Colour of the reached stars and line (gold in the flows, blue in the transaction list). */
  color?: string;
  /** Colour of the current star; defaults to `color`. */
  activeColor?: string;
  /** Smaller stars and no bottom margin (inside a card). */
  compact?: boolean;
}) {
  const last = steps.length - 1;
  const progress = last > 0 ? Math.min(1, Math.max(0, (current - 1) / last)) : 1;
  return (
    <View style={[styles.root, compact && styles.rootCompact]} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: current }}>
      <View style={styles.track}>
        {/* The line runs between the centres of the first and last stars. */}
        <View style={styles.lineBox}>
          <View style={styles.line} />
          <View style={[styles.line, styles.lineDone, { width: `${progress * 100}%`, backgroundColor: color }]} />
        </View>
        <View style={styles.stars}>
          {steps.map((label, i) => {
            const done = i + 1 <= current;
            const active = i + 1 === current;
            return (
              <View key={label} style={styles.starSlot}>
                {active && <View style={[styles.glow, { borderColor: `${color}59` }]} />}
                <OrbitStar size={(active ? 30 : 24) - (compact ? 4 : 0)} color={active ? activeColor ?? color : done ? color : pick('#2A3A6E', '#C5CFE6')} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.labels}>
        {steps.map((label, i) => (
          <Text
            key={label}
            style={[
              styles.label,
              steps.length >= 5 && styles.labelSmall,
              i === 0 && styles.labelFirst,
              i === last && styles.labelLast,
              i + 1 < current && styles.labelDone,
              i + 1 === current && (activeColor ? { color: Colors.chrome, fontFamily: Font.bodyBold } : styles.labelActive),
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 28 },
  rootCompact: { marginBottom: 0 },
  track: { height: 32, justifyContent: 'center' },
  lineBox: { position: 'absolute', left: 15, right: 15, height: 3 },
  line: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: pick('#1E2A55', '#DCE3F2') },
  lineDone: { right: undefined, backgroundColor: Colors.gold },
  stars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starSlot: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'rgba(255,194,51,0.35)' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { flex: 1, textAlign: 'center', color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 13 },
  labelSmall: { fontSize: 12 },
  labelFirst: { textAlign: 'left' },
  labelLast: { textAlign: 'right' },
  labelDone: { color: Colors.chrome },
  labelActive: { color: Colors.goldText },
});
