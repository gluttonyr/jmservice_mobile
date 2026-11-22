import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

// Website installed as an application (PWA, see public/manifest.webmanifest and public/sw.js).
// Android / computer: Chrome's install window (its proposal is kept by public/index.html).
// iPhone: Safari cannot install from a button, the user adds the site with Share → « Sur l'écran d'accueil ».
// Nothing on the phone apps, and nothing once the site is opened as the installed application.

type InstallPrompt = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type InstallWindow = Window & { __jmInstallPrompt?: InstallPrompt | null; __jmInstalled?: boolean };

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function readState() {
  if (!isWeb) return { available: false, ios: false };
  const w = window as InstallWindow;
  const nav = navigator as Navigator & { standalone?: boolean; maxTouchPoints?: number };
  const ua = nav.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  const standalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || nav.standalone === true;
  const installed = standalone || w.__jmInstalled === true;
  return { available: !installed && (!!w.__jmInstallPrompt || ios), ios };
}

function showIosHelp() {
  const ua = navigator.userAgent || '';
  // Apps like WhatsApp, Facebook or Instagram open links in their own window, which cannot add to the home screen.
  const inAppWindow = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok/i.test(ua);
  if (inAppWindow) {
    Alert.alert(
      "Installer l'application",
      "Ouvrez d'abord jmservices.io dans Safari (menu « … » → « Ouvrir dans Safari »), puis touchez de nouveau « Installer l'application ».",
    );
    return;
  }
  Alert.alert(
    "Installer sur l'iPhone",
    "1. Touchez le bouton Partager (le carré avec une flèche vers le haut), en bas de Safari.\n\n"
      + "2. Choisissez « Sur l'écran d'accueil ».\n\n"
      + "3. Touchez « Ajouter ».\n\n"
      + "JM Services apparaît alors avec les autres applications et s'ouvre en plein écran.",
  );
}

export function useInstallApp() {
  const [state, setState] = useState(readState);

  useEffect(() => {
    if (!isWeb) return;
    const update = () => setState(readState());
    window.addEventListener('jm-install-change', update);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    media?.addEventListener?.('change', update);
    update();
    return () => {
      window.removeEventListener('jm-install-change', update);
      media?.removeEventListener?.('change', update);
    };
  }, []);

  const install = useCallback(async () => {
    if (!isWeb) return;
    const w = window as InstallWindow;
    const prompt = w.__jmInstallPrompt;
    if (prompt) {
      // Chrome lets its window be opened only once per proposal.
      w.__jmInstallPrompt = null;
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        // The window could not open: nothing else to do, Chrome proposes it again later.
      }
      setState(readState());
      return;
    }
    if (state.ios) showIosHelp();
  }, [state.ios]);

  return { ...state, install };
}
