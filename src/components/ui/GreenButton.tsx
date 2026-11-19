import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '@/constants/colors';
import { Font } from '@/constants/fonts';

// Name kept for the existing screens. « Orbite » buttons: gold = main action,
// outline = navy with a blue border (e.g. "CRÉER UN COMPTE"), ghost = gold text.
interface GreenButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { paddingVertical: 10, paddingHorizontal: 18, fontSize: 14 },
  md: { paddingVertical: 15, paddingHorizontal: 26, fontSize: 17 },
  lg: { paddingVertical: 19, paddingHorizontal: 30, fontSize: 19 },
};

export default function GreenButton({
  title,
  onPress,
  style,
  textStyle,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
}: GreenButtonProps) {
  const currentSize = SIZES[size];
  const padding = { paddingVertical: currentSize.paddingVertical, paddingHorizontal: currentSize.paddingHorizontal };

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.outlineBtn, padding, disabled && styles.disabled, style]}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {loading
          ? <ActivityIndicator size="small" color={Colors.chrome} />
          : <Text style={[styles.titleText, styles.outlineText, { fontSize: currentSize.fontSize }, textStyle]}>{title}</Text>}
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[padding, styles.center, disabled && styles.disabled, style]}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {loading
          ? <ActivityIndicator size="small" color={Colors.gold} />
          : <Text style={[styles.ghostText, { fontSize: currentSize.fontSize - 2 }, textStyle]}>{title}</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[!disabled && styles.goldGlow, disabled && styles.disabled, style]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={disabled ? ['#2A3558', '#222B48'] : Gradients.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, padding]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.onGold} />
        ) : (
          <View style={styles.center}>
            <Text style={[styles.titleText, styles.primaryText, disabled && styles.disabledText, { fontSize: currentSize.fontSize }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  gradient: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldGlow: {
    borderRadius: 18,
    shadowColor: Colors.goldEnd,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  titleText: {
    fontFamily: Font.title,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  primaryText: { color: Colors.onGold },
  disabledText: { color: Colors.textSecondary },
  outlineBtn: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.blueLight,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: Colors.chrome },
  ghostText: {
    color: Colors.gold,
    fontFamily: Font.bodyBold,
  },
  disabled: { opacity: 0.6 },
});
