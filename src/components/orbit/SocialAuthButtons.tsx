import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as AppleAuthentication from 'expo-apple-authentication';
import AppleWebButton from '@/components/AppleWebButton';
import { Colors } from '@/constants/colors';
import { Font } from '@/constants/fonts';

type Props = {
  mode: 'signin' | 'signup';
  googleAvailable: boolean;
  googleLoading: boolean;
  onGoogle: () => void;
  onApple: () => void;
};

/** "ou" divider, then the Google and Apple buttons, shown exactly as before (same conditions per platform). */
export function SocialAuthButtons({ mode, googleAvailable, googleLoading, onGoogle, onApple }: Props) {
  const signup = mode === 'signup';
  return (
    <View>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      {googleAvailable && (
        <TouchableOpacity style={styles.googleBtn} onPress={onGoogle} disabled={googleLoading} activeOpacity={0.85}>
          <Image source={require('@/assets/google.webp')} style={styles.googleIcon} contentFit="contain" />
          <Text style={styles.googleText}>
            {googleLoading ? 'Connexion...' : signup ? "S'inscrire avec Google" : 'Continuer avec Google'}
          </Text>
        </TouchableOpacity>
      )}

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={signup
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          // White on the dark background: a black button would be invisible (App Store guideline 4).
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={18}
          style={styles.appleBtn}
          onPress={onApple}
        />
      )}
      {Platform.OS === 'web' && (
        <AppleWebButton title={signup ? "S'inscrire avec Apple" : 'Continuer avec Apple'} onPress={onApple} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textSecondary, fontFamily: Font.bodySemiBold, fontSize: 14, marginHorizontal: 16 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureWhite,
    borderRadius: 18,
    paddingVertical: 15,
    gap: 12,
    marginBottom: 12,
  },
  googleIcon: { width: 24, height: 24 },
  googleText: { color: '#141B2E', fontFamily: Font.bodyBold, fontSize: 16 },
  appleBtn: { width: '100%', height: 54 },
});
