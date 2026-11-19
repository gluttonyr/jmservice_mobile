import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Polygon, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';

type Props = {
  /** Main text, e.g. the promo code (parameter CODE_PROMO) or the USSD code. */
  value: string;
  /** Small spaced caption above the value, e.g. "CODE USSD MOOV". */
  caption?: string;
  /** Gold dashes on each side, like the "SERVICES" band of the logo. */
  dashes?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const BEVEL = 22;

/** « La plaque »: hexagonal band of the logo, used for the promo code and the USSD code. */
export function Plaque({ value, caption, dashes = true, size = 'md', style }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };
  const { w, h } = box;
  // Long values (USSD codes) must stay readable in full: shrink the font to the width instead of cutting.
  const base = size === 'lg' ? 26 : 24;
  const room = w - (BEVEL + 6) * 2;
  const fontSize = w > 0 ? Math.max(13, Math.min(base, room / (value.length * 0.74))) : base;
  const points = `${BEVEL},1 ${w - BEVEL},1 ${w - 1},${h / 2} ${w - BEVEL},${h - 1} ${BEVEL},${h - 1} 1,${h / 2}`;

  return (
    <View style={[styles.row, style]}>
      {dashes && <View style={styles.dash} />}
      <View style={[styles.plaque, size === 'lg' && styles.plaqueLg]} onLayout={onLayout}>
        {w > 0 && (
          <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgGradient id="plaqueFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#2457C8" />
                <Stop offset="1" stopColor="#152E7A" />
              </SvgGradient>
            </Defs>
            <Polygon points={points} fill="url(#plaqueFill)" stroke={Colors.gold} strokeWidth={2} />
          </Svg>
        )}
        {!!caption && <Text style={styles.caption} numberOfLines={1}>{caption}</Text>}
        <Text
          style={[styles.value, { fontSize }]}
          numberOfLines={2}
          selectable
        >
          {value}
        </Text>
      </View>
      {dashes && <View style={styles.dash} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: { width: 16, height: 4, borderRadius: 2, backgroundColor: Colors.gold },
  plaque: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: BEVEL + 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plaqueLg: { minHeight: 82, paddingVertical: 14 },
  caption: {
    color: '#9CC0FF',
    fontFamily: Font.bodyBold,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    color: Colors.chrome,
    fontFamily: Font.title,
    fontSize: 24,
    letterSpacing: 1,
  },
});
