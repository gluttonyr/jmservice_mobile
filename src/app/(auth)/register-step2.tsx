import { BackButton, OrbitBackground, OrbitField, OrbitStar, StarStepper, orbitFieldStyles } from '@/components/orbit';
import GreenButton from '@/components/ui/GreenButton';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import { authService } from '@/data_api/services/authService';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, Eye, EyeOff, Lock, User } from 'lucide-react-native';
import { useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View,
} from 'react-native';
import CountryPicker, {
  Country,
  CountryCode,
  DARK_THEME,
} from '@/components/CountryPicker';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { consumePendingAppleIdentityToken, peekPendingAppleIdentityToken } from '@/hooks/useAppleAuth';

// Terms page served by the backend this app talks to (not a hard-coded domain).
const TERMS_URL = `${Constants.expoConfig?.extra?.apiUrl ?? ''}/privacy-rule`;

export default function RegisterStep2() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Togo par défaut (pays de l'utilisateur)
  const [countryCode, setCountryCode] = useState<CountryCode>('TG');
  const [callingCode, setCallingCode] = useState('228');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPicker, setShowPicker] = useState(false);

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

  const fullTelephone = `+${callingCode}${phoneNumber}`;

  const onSelectCountry = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
    setShowPicker(false);
  };

  const handleCreate = async () => {
    try {
      if (!phoneNumber || !password || !confirm || (!prenom && !nom)) {
        setError('Veuillez remplir tous les champs.');
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
        email: params.email as string,
        telephone: fullTelephone,
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
      router.replace('/(auth)/login');

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
                {[prenom, nom].filter(Boolean).join(' ')} · {params.email}
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            {!nameFromProvider && params.email ? (
              <OrbitField
                label="Prénom"
                icon={<User color={Colors.blueLight} size={20} />}
                placeholder="Votre prénom"
                value={typedPrenom}
                onChangeText={setTypedPrenom}
                autoCapitalize="words"
              />
            ) : null}

            {/* Téléphone avec sélecteur de pays */}
            <OrbitField label="Téléphone">
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
                accessibilityLabel="Choisir le pays"
              >
                <CountryPicker
                  countryCode={countryCode}
                  withFlag
                  withEmoji
                  withFilter
                  withCallingCode
                  withAlphaFilter
                  theme={DARK_THEME}
                  onSelect={onSelectCountry}
                  visible={showPicker}
                  onClose={() => setShowPicker(false)}
                  // Le composant rend le drapeau inline, on le cache visuellement
                  // car on le déclenche via notre bouton
                  containerButtonStyle={styles.pickerHidden}
                />
                <Text style={styles.callingCodeText}>+{callingCode}</Text>
                <ChevronDown color={Colors.textSecondary} size={16} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TextInput
                style={orbitFieldStyles.input}
                placeholder="XX XX XX XX"
                placeholderTextColor={Colors.textSecondary}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </OrbitField>

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

  // Sélecteur de pays
  countrySelector: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingRight: 4 },
  // On cache le rendu natif du bouton CountryPicker car on gère l'ouverture nous-mêmes
  pickerHidden: { opacity: 0, position: 'absolute', width: 0, height: 0 },
  callingCodeText: { color: Colors.chrome, fontFamily: Font.bodyBold, fontSize: 16, marginLeft: 2 },
  divider: { width: 1, height: 24, backgroundColor: Colors.border, marginHorizontal: 12 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 20, marginTop: 2 },
  termsText: { flex: 1, color: Colors.textSecondary, fontFamily: Font.body, fontSize: 13, lineHeight: 19 },
  termsLink: { color: Colors.gold, fontFamily: Font.bodySemiBold },
  btn: { width: '100%' },
});
