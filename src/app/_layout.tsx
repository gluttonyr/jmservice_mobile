import '@/components/legacyBrowserPolyfills';

import '@/components/completeAuthPopup';
import '@/components/hideScrollbars';
import '@/components/lockWebPage';
import { AlertHost } from '@/components/appAlert';
import { UpdateAvailableModal } from '@/components/updateAvailableNodal';
import { StartAtRoot } from '@/components/StartAtRoot';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useVersionCheck } from '@/hooks/useVersionChech';
import { useWideWeb } from '@/hooks/useWideWeb';
import { Colors } from '@/constants/colors';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { FONT_ASSETS } from '@/constants/fonts';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Toast from 'react-native-toast-message';

// Web only: dark navigation theme, so no light background shows around centered screens.
const webTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.darkBg, card: Colors.darkBg } };
function WebTheme({ children }: { children: ReactNode }) {
  return Platform.OS === 'web' ? <ThemeProvider value={webTheme}>{children}</ThemeProvider> : <>{children}</>;
}

// Shown instead of an empty blue page when a screen crashes, with the error text so it can be reported.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const restart = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign('/');
    else retry();
  };
  return (
    <View style={{ flex: 1, backgroundColor: Colors.darkBg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: Colors.white, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>
        Une erreur est survenue
      </Text>
      <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 22 }}>
        {String(error?.message ?? error)}
      </Text>
      <Pressable onPress={restart} style={{ backgroundColor: Colors.primaryGreen, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: Colors.darkBg, fontWeight: '700' }}>Recharger</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  // ⚠️ Un `new QueryClient()` à chaque render du RootLayout recrée le cache
  // React Query à chaque fois. Comme RootLayout ne se remonte normalement
  // qu'une fois, ce n'est pas grave en pratique, mais `useRef` évite tout
  // risque si jamais ce composant venait à re-render pour une autre raison.
  const queryClientRef = useRef<QueryClient | undefined>(undefined);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  const { visible: updateVisible, remindLater, dismiss } = useVersionCheck();
  const wide = useWideWeb();
  const pushedScreen = { animation: 'slide_from_right' as const };
  // If a font fails to load the app still opens, with the system font.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: Colors.darkBg }} />;
  }

  return (
    <GestureHandlerRootView style={wide ? { flex: 1, backgroundColor: Colors.darkBg } : { flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClientRef.current}>
            <WebTheme>
            <StartAtRoot />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />

              {/* Les tabs (PagerView) — animation fade pour ne pas voir de slide */}
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />

              {/* ── Screens poussés PAR-DESSUS les tabs ── */}
              <Stack.Screen
                name="user_chats/[id]"
                options={pushedScreen}
              />
              <Stack.Screen
                name="admin_chats/[id]"
                options={pushedScreen}
              />
              <Stack.Screen
                name="admin_events/create"
                options={pushedScreen}
              />
              <Stack.Screen
                name="admin_events/edit"
                options={pushedScreen}
              />
              <Stack.Screen
                name="user_events/[id]"
                options={pushedScreen}
              />
              <Stack.Screen
                name="user_chats/deposit-withdrawal"
                options={pushedScreen}
              />
              <Stack.Screen
                name="user_transactions/index"
                options={pushedScreen}
              />
              <Stack.Screen
                name="user_notifications/index"
                options={pushedScreen}
              />
              <Stack.Screen
                name="admin_transactions/index"
                options={pushedScreen}
              />
              <Stack.Screen
                name="config/slide-editor"
                options={pushedScreen}
              />

              <Stack.Screen name="+not-found" />
            </Stack>
            </WebTheme>

          <StatusBar style="light" />
          <Toast />

          {/* Placé au niveau racine : s'affiche par-dessus n'importe quel écran */}
          <UpdateAvailableModal
            visible={updateVisible}
            onClose={dismiss}
            onRemindLater={remindLater}
          />
          {/* Every Alert.alert of the app, in the JM Services style (last: drawn above everything). */}
          <AlertHost />
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
