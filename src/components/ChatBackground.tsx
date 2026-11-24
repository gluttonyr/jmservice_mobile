import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import {
  CircleArrowDown,
  CircleArrowUp,
  CircleDollarSign,
  Coins,
  Dices,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Ticket,
  Timer,
  TrendingUp,
  Trophy,
  Volleyball,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import Svg, { Ellipse, Path, Text as SvgText } from 'react-native-svg';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

// « Des icônes JM en filigrane »: each space has its own icons and colour (design board 12).
// The JM logo and pairs of stars are mixed into every set.
const ICON_SETS = {
  // Client support: blue, sport and trophies.
  default: [Volleyball, Dices, Trophy, Ticket, Timer, MessageCircle, Coins, TrendingUp],
  // Deposit / withdrawal: gold, coins and arrows.
  finance: [CircleDollarSign, CircleArrowUp, CircleArrowDown, Ticket, Smartphone, ShieldCheck, TrendingUp, Coins],
  // Admin conversations: turquoise, shield.
  admin: [ShieldCheck, CircleArrowUp, CircleArrowDown, Smartphone, Timer, MessageCircle, Trophy, CircleDollarSign],
  // General discussion: chrome, bubbles.
  forum: [MessageCircle, Volleyball, Trophy, Ticket, Dices, Megaphone, Timer, Coins],
} satisfies Record<string, LucideIcon[]>;

const VARIANT_COLORS: Record<keyof typeof ICON_SETS, string> = {
  default: '#5AA2FF',
  finance: '#FFC233',
  admin: '#19D3C5',
  forum: pick('#B9C3DA', '#4A5886'),
};

export type ChatBackgroundVariant = keyof typeof ICON_SETS;

type Props = {
  variant?: ChatBackgroundVariant;
  /** Defaults to the colour of the variant. */
  iconColor?: string;
  opacity?: number;
  spacing?: number;
  iconSize?: number;
  backgroundColor?: string;
  seed?: number;
};

function mulberry32(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

type Doodle =
  | { key: string; kind: 'icon'; Icon: LucideIcon; x: number; y: number; size: number; rotate: number }
  | { key: string; kind: 'brand' | 'stars'; x: number; y: number; size: number; rotate: number };

/** "JM" in an oval, the watermark version of the logo. */
function JMOutline({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size * 1.7} height={size} viewBox="0 0 68 40">
      <Ellipse cx="34" cy="20" rx="31" ry="15" transform="rotate(-10 34 20)" stroke={color} strokeWidth={3} fill="none" />
      <SvgText
        x="34"
        y="28"
        fontSize="22"
        fontFamily={Font.title}
        textAnchor="middle"
        stroke={color}
        strokeWidth={1.4}
        fill="none"
      >
        JM
      </SvgText>
    </Svg>
  );
}

const STAR = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z';

/** Two four-point stars side by side, filled. */
function StarPair({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size * 2.2} height={size} viewBox="0 0 53 24">
      <Path d={STAR} fill={color} transform="translate(0 2) scale(0.85)" />
      <Path d={STAR} fill={color} transform="translate(29 0)" />
    </Svg>
  );
}

export function ChatBackground({
  variant = 'default',
  iconColor,
  opacity = 0.14,
  spacing = 64,
  iconSize = 24,
  backgroundColor = Colors.darkBg,
  seed = 7,
}: Props) {
  const { width, height } = useWindowDimensions();
  const color = iconColor ?? VARIANT_COLORS[variant];

  const doodles = useMemo<Doodle[]>(() => {
    const icons = ICON_SETS[variant];
    const random = mulberry32(seed);
    const rows = Math.ceil(height / spacing) + 1;
    const columns = Math.ceil(width / spacing) + 1;
    const list: Doodle[] = [];
    let iconIndex = 0;

    for (let row = 0; row < rows; row += 1) {
      const rowOffset = row % 2 === 0 ? 0 : spacing / 2;
      for (let column = 0; column < columns; column += 1) {
        const roll = random();
        const base = {
          key: `${row}-${column}`,
          x: column * spacing + rowOffset + (random() - 0.5) * spacing * 0.2 - iconSize / 2,
          y: row * spacing + (random() - 0.5) * spacing * 0.2,
          size: iconSize + Math.round((random() - 0.5) * 6),
          rotate: Math.round((random() - 0.5) * 30),
        };
        if (roll < 0.16) list.push({ ...base, kind: 'brand' });
        else if (roll < 0.28) list.push({ ...base, kind: 'stars', rotate: 0 });
        else {
          list.push({ ...base, kind: 'icon', Icon: icons[iconIndex % icons.length] });
          iconIndex += 1 + Math.floor(random() * 2);
        }
      }
    }
    return list;
  }, [variant, seed, spacing, iconSize, width, height]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      {doodles.map((d) => (
        <View
          key={d.key}
          style={{ position: 'absolute', left: d.x, top: d.y, opacity, transform: [{ rotate: `${d.rotate}deg` }] }}
        >
          {d.kind === 'brand' ? (
            <JMOutline size={d.size} color={color} />
          ) : d.kind === 'stars' ? (
            <StarPair size={d.size * 0.9} color={color} />
          ) : d.kind === 'icon' ? (
            <d.Icon color={color} size={d.size} strokeWidth={2} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
