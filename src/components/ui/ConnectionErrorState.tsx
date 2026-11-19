import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  message?: string;
  onRetry: () => void;
  /** Remplit l'espace disponible (page dédiée : liste de chats/forum/events). */
  fullscreen?: boolean;
};

/**
 * État "impossible de contacter le serveur" — à afficher à la place d'un
 * spinner qui tourne indéfiniment ou d'un faux état "aucune donnée" quand le
 * problème est en réalité une erreur réseau/serveur.
 */
export function ConnectionErrorState({
  message = 'Impossible de contacter le serveur. Vérifiez votre connexion.',
  onRetry,
  fullscreen = false,
}: Props) {
  return (
    <View style={[styles.box, fullscreen && styles.fullscreen]}>
      <View style={styles.icon}><WifiOff color={Colors.gold} size={24} /></View>
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryBtnText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(17,28,63,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.25)',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: 16,
  },
  // Full page: no frame, just the message in the middle.
  fullscreen: { flex: 1, justifyContent: 'center', marginHorizontal: 24, marginTop: 0, backgroundColor: 'transparent', borderWidth: 0 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,194,51,0.12)', alignItems: 'center', justifyContent: 'center' },
  text: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255,194,51,0.1)',
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  retryBtnText: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 14 },
});
