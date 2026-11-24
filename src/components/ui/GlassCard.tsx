import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, pick } from '@/constants/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glow?: boolean;
}

export default function GlassCard({ children, style, glow = false }: GlassCardProps) {
  return (
    <View style={[styles.card, glow && styles.glowCard, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: pick('rgba(17,28,63,0.92)', '#FFFFFF'),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  glowCard: {
    borderColor: 'rgba(255,194,51,0.4)',
    shadowColor: Colors.primaryGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});
