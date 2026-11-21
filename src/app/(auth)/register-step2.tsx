import {
  BackButton, DEFAULT_PHONE, OrbitBackground, OrbitField, OrbitStar, PhoneField, StarStepper, fullPhone, type PhoneValue,
} from '@/components/orbit';
import GreenButton from '@/components/ui/GreenButton';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { authService } from '@/data_api/services/authService';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Lock, User } from 'lucide-react-native';
import { useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { consumePendingAppleIdentityToken, peekPendingAppleIdentityToken } from '@/hooks/useAppleAuth';

// Terms page served by the backend this app talks to (not a hard-coded domain).
const TERMS_URL = `${Constants.expoConfig?.extra?.apiUrl ?? ''}/privacy-rule`;

export default function RegisterStep2() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Sign-up with a phone number (step 1) or with an email: the phone is then optional here.
  // Google / Apple accounts arriving here also have an email.
  const email = ((params.email as string) ?? '').trim();
  const phoneFromStep1 = ((params.telephone as string) ?? '').trim();
  const [phone, setPhone] = useState<PhoneValue>(DEFAULT_PHONE);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Google / Apple may give only one of the two names (or none: then the user types a first name).
  const nameFromProvider = !!(params.prenom || params.nom);
  const [typedPrenom, setTypedPrenom] = useState('');
  const prenom = nameFromProvider ? ((params.prenom as string) ?? '').trim() : typedPrenom.trim();
  const nom = ((params.nom as string) ?? '').trim();

  const telephone = phoneFromStep1 || fullPhone(phone);

  const handleCreate = async () => {
    try {
      if (!password || !confirm || (!prenom && !nom) || (!email && !telephone)) {
        setError('Veuillez remplir tous les champs.');
        return;
      }
      if (!phoneFromStep1 && phone.number.trim() && phone.number.replace(/\D/g, '').length < 8) {
        setError('Numéro de téléphone invalide.');
        return;
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      if (password !== confirm) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
      setError('');
      setLoading(true);
      await authService.register({
        prenom,
        nom,
        username: [nom, prenom].filter(Boolean).join(' '),
        ...(email ? { email } : {}),
        ...(telephone ? { telephone } : {}),
        password,
        ...(params.googleId ? { googleId: params.googleId as string, provider: 'google' } : {}),
        ...(params.appleId ? {
          appleId: params.appleId as string,
          provider: 'apple',
          identityToken: peekPendingAppleIdentityToken() ?? undefined,
        } : {}),
      });
      consumePendingAppleIdentityToken();
      Toast.show({
        type: 'success',
        text1: 'Compte créé',
        text2: 'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
      });

      setLoading(false);
      // The sign-in screen opens on the identifier just used.
      router.replace({ pathname: '/(auth)/login', params: { method: email && !phoneFromStep1 ? 'email' : 'phone' } });

    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Une erreur est survenue lors de la création du compte.';

      setError(message);

      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: message,
      });
      setLoading(false);
    }

  };

  const eye = (visible: boolean, toggle: () => void) => (
    <TouchableOpacity onPress={toggle} hitSlop={10} accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
      {visible ? <EyeOff color={Colors.chrome} size={22} /> : <Eye color={Colors.chrome} size={22} />}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <OrbitBackground orbits={false}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <BackButton onPress={() => router.back()} />
            <JMLogo size={88} />
          </View>

          <Text style={styles.title}>PRESQUE TERMINÉ{' '}!</Text>
          <Text style={styles.subtitle}>Sécurisez votre compte</Text>

          <StarStepper steps={['Identité', 'Sécurité']} current={2} />

          {nameFromProvider ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                {[prenom, nom].filter(Boolean).join(' ')} · {email || phoneFromStep1}
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            {!nameFromProvider && email ? (
              <OrbitField
                label="Prénom"
                icon={<User color={Colors.blueLight} size={20} />}
                placeholder="Votre prénom"
                value={typedPrenom}
                onChangeText={setTypedPrenom}
                autoCapitalize="words"
              />
            ) : null}

            {/* Phone: not asked again when it was the sign-up identifier; optional when signing up by email. */}
            {!phoneFromStep1 ? (
              <PhoneField label={email ? 'Téléphone (facultatif)' : 'Téléphone'} value={phone} onChange={setPhone} />
            ) : null}

            <OrbitField
              label="Mot de passe"
              icon={<Lock color={Colors.blueLight} size={20} />}
              placeholder="Minimum 8 caractères"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoComplete="new-password"
              right={eye(showPwd, () => setShowPwd(!showPwd))}
            />

            <OrbitField
              label="Confirmer le mot de passe"
              icon={<Lock color={Colors.blueLight} size={20} />}
              placeholder="Répéter le mot de passe"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              right={eye(showConfirm, () => setShowConfirm(!showConfirm))}
            />

            <View style={styles.termsRow}>
              <OrbitStar size={12} />
              <Text style={styles.termsText}>
                En créant un compte, vous acceptez nos{' '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
                  conditions d'utilisation
                </Text>
              </Text>
            </View>

            <GreenButton
              title="Créer mon compte"
              onPress={handleCreate}
              size="lg"
              style={styles.btn}
              loading={loading}
            />
          </View>
        </ScrollView>
      </OrbitBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  scroll: { flexGrow: 1, paddingBottom: 40, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 32 },
  subtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 16, marginTop: 2, marginBottom: 22 },

  summaryCard: {
    backgroundColor: 'rgba(47,123,255,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(90,162,255,0.35)',
    padding: 14,
    marginBottom: 16,
  },
  summaryText: { color: Colors.chrome, fontFamily: Font.bodySemiBold, fontSize: 14 },

  errorBox: {
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: Colors.error, fontFamily: Font.bodyMedium, fontSize: 14 },

  card: {
    backgroundColor: 'rgba(17,28,63,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(120,150,230,0.16)',
    padding: 20,
    paddingBottom: 22,
  },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 20, marginTop: 2 },
  termsText: { flex: 1, color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, lineHeight: 19 },
  termsLink: { color: Colors.gold, fontFamily: Font.bodySemiBold },
  btn: { width: '100%' },
});
