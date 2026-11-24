import { Colors, pick } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Website: as soon as the browser confirms the application is installed (« appinstalled »), tells the client
// clearly where to find it. Chrome does not open the new application by itself on a phone, and a website
// cannot open it either. Root layout, website only.

const ICON = { uri: '/icons/icon-192.png' };

export function InstalledAppHost() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const show = () => setVisible(true);
    window.addEventListener('appinstalled', show);
    return () => window.removeEventListener('appinstalled', show);
  }, []);

  if (!visible) return null;
  const phone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const close = () => setVisible(false);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fermer le message">
        <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert" accessibilityViewIsModal>
          <LinearGradient colors={['#FFD255', '#FF9F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
          <View style={styles.iconWrap}>
            <Image source={ICON} style={styles.icon} />
            <View style={styles.badge}><Check color={Colors.onGold} size={16} strokeWidth={3.5} /></View>
          </View>
          <Text style={styles.title}>APPLICATION INSTALLÉE !</Text>
          <Text style={styles.message}>
            {phone
              ? 'JM Services est maintenant sur votre écran d’accueil, avec vos autres applications.'
              : 'JM Services est maintenant installée sur votre ordinateur.'}
          </Text>
          <View style={styles.steps}>
            <Text style={styles.step}>
              <Text style={styles.stepStrong}>Touchez l’icône JM Services</Text>
              {phone ? ' sur votre écran d’accueil pour l’ouvrir en plein écran.' : ' pour l’ouvrir dans sa propre fenêtre.'}
            </Text>
            {phone && (
              <Text style={[styles.step, { marginTop: 8 }]}>
                Les liens <Text style={styles.stepStrong}>jmservices.io</Text> reçus par WhatsApp ou SMS l’ouvriront aussi directement.
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={close} activeOpacity={0.85} accessibilityRole="button" style={styles.buttonWrap}>
            <LinearGradient colors={['#FFD255', '#FF9F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
              <Text style={styles.buttonText}>J’AI COMPRIS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: pick('rgba(3,6,16,0.78)', 'rgba(12,22,52,0.45)'), alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,194,51,0.35)',
    backgroundColor: pick('#111C3F', '#FFFFFF'),
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  iconWrap: { marginBottom: 18 },
  icon: { width: 84, height: 84, borderRadius: 22, borderWidth: 1, borderColor: pick('rgba(120,150,230,0.3)', 'rgba(40,70,150,0.22)') },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.success,
    borderWidth: 3,
    borderColor: pick('#111C3F', '#FFFFFF'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 22, textAlign: 'center' },
  message: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  steps: {
    alignSelf: 'stretch',
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(47,123,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(90,162,255,0.28)',
  },
  step: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 14, lineHeight: 20 },
  stepStrong: { color: Colors.chrome, fontFamily: Font.bodyBold },
  buttonWrap: { alignSelf: 'stretch', marginTop: 22, borderRadius: 14, overflow: 'hidden' },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: Colors.onGold, fontFamily: Font.title, fontSize: 16 },
});
