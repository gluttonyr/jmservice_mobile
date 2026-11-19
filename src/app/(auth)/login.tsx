import GreenButton from '@/components/ui/GreenButton';
import JMLogo from '@/components/ui/JMLogo';
import { Colors } from '@/constants/colors';
import { authService } from '@/data_api/services/authService';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { authStorage } from '@/storage/authStorage';
import { useQueryClient } from '@tanstack/react-query';
import { BackButton, HeroIcon, OrbitBackground, OrbitField, SocialAuthButtons } from '@/components/orbit';
import { Font } from '@/constants/fonts';
import { router } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Animated, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loginInProgressRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const queryClient = useQueryClient();
  const { signInWithGoogle, loading: googleLoading, available: googleAvailable } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth();
  const insets = useSafeAreaInsets();
  

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (loginInProgressRef.current) return;
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    loginInProgressRef.current = true;
    setError('');
    setLoading(true);
    let navigationStarted = false;
    try {
      const res = await authService.login({ email, password });
      await authStorage.setToken(res.data.access_token);
      await authStorage.setUser(res.data.user);

      queryClient.setQueryData(['user'], res.data.user);
      Toast.show({
        type: 'success',
        text1: 'Connexion réussie',
        text2: 'Vous êtes maintenant connecté à votre compte.',
      });
      if (res.data.user.role === "ADMIN") {
        navigationStarted = true;
        router.replace('/(admin)/admin-home');
      } else {
        navigationStarted = true;
        router.replace('/(tabs)/home');
      }

    } catch (err:any) {
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
    } finally {
      if (!navigationStarted) {
        loginInProgressRef.current = false;
        setLoading(false);
      }
    }
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

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <HeroIcon size={96}>
            <Lock color={Colors.pureWhite} size={40} strokeWidth={2} />
          </HeroIcon>
          <Text style={styles.title}>CONNEXION</Text>
          <Text style={styles.subtitle}>Accédez à votre espace JM Services</Text>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <View style={styles.card}>
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
            <OrbitField
              label="Mot de passe"
              icon={<Lock color={Colors.blueLight} size={20} />}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              onSubmitEditing={handleLogin}
              right={(
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10} accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  {showPassword
                    ? <EyeOff color={Colors.chrome} size={22} />
                    : <Eye color={Colors.chrome} size={22} />}
                </TouchableOpacity>
              )}
            />

            <GreenButton
              title="Se connecter"
              onPress={handleLogin}
              size="lg"
              style={styles.loginBtn}
              loading={loading}
            />
          </View>

          <SocialAuthButtons
            mode="signin"
            googleAvailable={googleAvailable}
            googleLoading={googleLoading}
            onGoogle={signInWithGoogle}
            onApple={signInWithApple}
          />

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register-step1')}>
              <Text style={styles.registerLink}>S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      </OrbitBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  scroll: { flexGrow: 1, paddingBottom: 40, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { paddingTop: 4 },
  title: { color: Colors.chrome, fontFamily: Font.title, fontSize: 40, textAlign: 'center', marginTop: 4 },
  subtitle: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 16, textAlign: 'center', marginTop: 4, marginBottom: 22 },
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
  loginBtn: { width: '100%', marginTop: 6 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  registerText: { color: Colors.textSecondary, fontFamily: Font.body, fontSize: 15 },
  registerLink: { color: Colors.gold, fontFamily: Font.bodyBold, fontSize: 15, textDecorationLine: 'underline' },
});
