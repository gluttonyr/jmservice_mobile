import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { useInstallApp } from '@/hooks/useInstallApp';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Download, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

// « Installer l'application » of the website (see useInstallApp). Shown only where it can work:
// never on the phone apps, nor once the site is installed.
//   card: client home, can be put away for a week;   row: profile;   link: welcome screen.

const ICON = { uri: '/icons/icon-192.png' };
const DISMISS_KEY = 'jm_install_card_hidden_until';
const WEEK = 7 * 24 * 3600 * 1000;

function hiddenForNow() {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

export function InstallAppButton({ variant, style }: { variant: 'card' | 'row' | 'link'; style?: StyleProp<ViewStyle> }) {
  const { available, ios, install } = useInstallApp();
  const [dismissed, setDismissed] = useState(false);
  if (!available || (variant === 'card' && (dismissed || hiddenForNow()))) return null;

  const hint = ios ? "Ajoutez JM Services à l'écran d'accueil de votre iPhone." : 'Ouvrez JM Services en un toucher, comme une application.';

  if (variant === 'link') {
    return (
      <TouchableOpacity style={[styles.link, style]} onPress={install} activeOpacity={0.8} accessibilityRole="button">
        <Download color={Colors.goldText} size={17} />
        <Text style={styles.linkText}>Installer l'application</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'row') {
    return (
      <TouchableOpacity style={[styles.row, style]} onPress={install} activeOpacity={0.8} accessibilityRole="button">
        <Download color={Colors.goldText} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowText}>Installer l'application</Text>
          <Text style={styles.rowHint}>{hint}</Text>
        </View>
        <ChevronRight color={Colors.goldText} size={16} />
      </TouchableOpacity>
    );
  }

  const putAway = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + WEEK));
    } catch {
      // Storage refused: hidden until the next visit only.
    }
    setDismissed(true);
  };

  return (
    <View style={[styles.card, style]}>
      <Image source={ICON} style={styles.cardIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>INSTALLEZ L'APPLICATION</Text>
        <Text style={styles.cardHint}>{hint}</Text>
        <TouchableOpacity onPress={install} activeOpacity={0.85} accessibilityRole="button" style={styles.cardButtonWrap}>
          <LinearGradient colors={['#FFD255', '#FF9F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardButton}>
            <View style={{ zIndex: 1 }}><Download color={Colors.onGold} size={16} /></View>
            <Text style={styles.cardButtonText}>Installer</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={putAway} style={styles.close} accessibilityRole="button" accessibilityLabel="Masquer pour le moment" hitSlop={10}>
        <X color={Colors.textSecondary} size={18} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.28)',
  },
  cardIcon: { width: 56, height: 56, borderRadius: 14 },
  cardTitle: { color: Colors.chrome, fontFamily: Font.title, fontSize: 16, paddingRight: 22 },
  cardHint: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, lineHeight: 18, marginTop: 4 },
  cardButtonWrap: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  cardButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  cardButtonText: { color: Colors.onGold, fontFamily: Font.bodyExtraBold, fontSize: 14 },
  close: { position: 'absolute', top: 12, right: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,194,51,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.3)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowText: { color: Colors.goldText, fontFamily: Font.bodyBold, fontSize: 16 },
  rowHint: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 12, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  linkText: { color: Colors.goldText, fontFamily: Font.bodyBold, fontSize: 15 },
});
