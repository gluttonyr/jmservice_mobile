import { authService } from '@/data_api/services/authService';
import { authStorage } from '@/storage/authStorage';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

let pendingAppleIdentityToken: string | null = null;

// Read without clearing: a failed sign-up attempt (e.g. phone already used) must be able to retry.
export function peekPendingAppleIdentityToken(): string | null {
  return pendingAppleIdentityToken;
}

export function consumePendingAppleIdentityToken(): string | null {
  const token = pendingAppleIdentityToken;
  pendingAppleIdentityToken = null;
  return token;
}

async function openSession(queryClient: QueryClient, result: { access_token: string; user: any }) {
  await authStorage.setToken(result.access_token);
  await authStorage.setUser(result.user);
  queryClient.setQueryData(['user'], result.user);
  Toast.show({ type: 'success', text1: 'Connexion réussie', text2: 'Vous êtes connecté avec Apple.' });
  router.replace(result.user?.role === 'ADMIN' ? '/(admin)/admin-home' : '/(tabs)/home');
}

// Apple already authenticated the person, so the account is created without any password
// and the session opens right away (App Store guideline 4: no password after Sign in with Apple).
export async function completeAppleSignUp(
  queryClient: QueryClient,
  details: { prenom: string; nom: string; email: string; appleId: string; telephone?: string },
) {
  const identityToken = peekPendingAppleIdentityToken();
  if (!identityToken) throw new Error('La session Apple a expiré. Recommencez avec « Continuer avec Apple ».');
  await authService.register({
    ...details,
    username: [details.nom, details.prenom].filter(Boolean).join(' '),
    provider: 'apple',
    identityToken,
  });
  const result = await authService.verifyAppleToken(identityToken);
  if (!result?.access_token) {
    throw new Error('Votre compte est créé. Touchez « Continuer avec Apple » pour vous connecter.');
  }
  consumePendingAppleIdentityToken();
  await openSession(queryClient, result);
}

export function useAppleAuth() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') return;
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple n’a pas fourni de jeton de connexion.');

      const result = await authService.verifyAppleToken(credential.identityToken);
      if (!result?.isNewUser && result?.access_token) {
        await openSession(queryClient, result);
        return;
      }

      if (!result?.isNewUser || !result.appleId || !result.email) {
        throw new Error('Apple n’a pas transmis les informations nécessaires pour créer le compte.');
      }

      pendingAppleIdentityToken = credential.identityToken;
      const prenom = credential.fullName?.givenName?.trim() || '';
      const nom = credential.fullName?.familyName?.trim() || '';
      // No extra sign-up step: Apple gives the name only on the very first sign-in, and without it the
      // account starts as "Client" (editable in Profil).
      await completeAppleSignUp(queryClient, {
        prenom: prenom || (nom ? '' : 'Client'),
        nom,
        email: result.email,
        appleId: result.appleId,
      });
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') return;
      Toast.show({
        type: 'error',
        text1: 'Connexion Apple',
        text2: error?.response?.data?.message || error?.message || 'La connexion Apple a échoué.',
      });
    } finally {
      setLoading(false);
    }
  };

  return { signInWithApple, loading };
}
