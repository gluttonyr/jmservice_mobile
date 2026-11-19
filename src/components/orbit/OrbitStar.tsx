import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';

/** Four-point star of the JM logo, used for progress steps and decoration. */
export function OrbitStar({ size = 16, color = Colors.gold, opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={color} />
    </Svg>
  );
}
