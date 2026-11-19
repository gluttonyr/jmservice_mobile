import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { User, Mail } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';
import GreenButton from '@/components/ui/GreenButton';
import JMLogo from '@/components/ui/JMLogo';
import { BackButton, OrbitBackground, OrbitField, SocialAuthButtons, StarStepper } from '@/components/orbit';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterStep1() {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const { signInWithGoogle, loading: googleLoading, available: googleAvailable } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth();
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if ((!prenom && !nom) || !email) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (!email.includes('@')) {
      setError('Adresse email invalide.');
      return;
    }
    setError('');
    router.push({ pathname: '/(auth)/register-step2', params: { prenom, nom, email } });
  };

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

        <View style={styles.content}>
          <Text style={styles.title}>CRÉER UN COMPTE</Text>
          <Text style={styles.subtitle}>Informations personnelles</Text>

          <StarStepper steps={['Identité', 'Sécurité']} current={1} />

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <View style={styles.card}>
            <OrbitField
              label="Prénom"
              icon={<User color={Colors.blueLight} size={20} />}
              placeholder="Votre prénom"
              value={prenom}
              onChangeText={setPrenom}
              autoCapitalize="words"
              autoComplete="given-name"
            />
            <OrbitField
              label="Nom"
              icon={<User color={Colors.blueLight} size={20} />}
              placeholder="Votre nom de famille"
              value={nom}
              onChangeText={setNom}
              autoCapitalize="words"
              autoComplete="family-name"
            />
            <OrbitField
              label="Email"
              icon={<Mail color={Colors.blueLight} size={20} />}
              placeholder="votre@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <GreenButton
              title="Continuer"
              onPress={handleNext}
              size="lg"
              style={styles.btn}
            />
          </View>

          <SocialAuthButtons
            mode="signup"
            googleAvailable={googleAvailable}
            googleLoading={googleLoading}
            onGoogle={signInWithGoogle}
            onApple={signInWithApple}
          />

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
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
  content: {},
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 32 },
  subtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 16, marginTop: 2, marginBottom: 22 },
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
  btn: { width: '100%', marginTop: 6 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  loginText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15 },
  loginLink: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 15, textDecorationLine: 'underline' },
});
