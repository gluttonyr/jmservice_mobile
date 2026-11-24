import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

// Website installed as an application (PWA, see public/manifest.webmanifest and public/sw.js).
// Android / computer: Chrome's install window (its proposal is kept by public/index.html). On a first visit
// Chrome only proposes it after the page was touched and viewed ~30 s: until then, on Android, the button
// explains Chrome's menu ⋮ → « Installer l'application ».
// iPhone: Safari cannot install from a button, the user adds the site with Share → « Sur l'écran d'accueil ».
// Nothing on the phone apps, nor once installed (opened as the application, or detected on this phone).

type InstallPrompt = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type InstallWindow = Window & { __jmInstallPrompt?: InstallPrompt | null; __jmInstalled?: boolean };

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

// The installed application seen from Chrome (manifest « related_applications », Android Chrome only).
let installedOnDevice = false;

const IN_APP_WINDOW = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|; wv\)/i;

function readState() {
  if (!isWeb) return { available: false, ios: false, android: false };
  const w = window as InstallWindow;
  const nav = navigator as Navigator & { standalone?: boolean; maxTouchPoints?: number };
  const ua = nav.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  const android = /android/i.test(ua);
  const standalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || nav.standalone === true;
  const installed = standalone || w.__jmInstalled === true || installedOnDevice;
  return { available: !installed && (!!w.__jmInstallPrompt || ios || android), ios, android };
}

function showIosHelp() {
  // Apps like WhatsApp, Facebook or Instagram open links in their own window, which cannot add to the home screen.
  if (IN_APP_WINDOW.test(navigator.userAgent || '')) {
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

function showAndroidHelp() {
  if (IN_APP_WINDOW.test(navigator.userAgent || '')) {
    Alert.alert(
      "Installer l'application",
      "Ouvrez d'abord jmservices.io dans Chrome (menu ⋮ → « Ouvrir dans Chrome »), puis touchez de nouveau « Installer l'application ».",
    );
    return;
  }
  Alert.alert(
    "Installer l'application",
    "1. Touchez le menu ⋮ en haut à droite de Chrome.\n\n"
      + "2. Choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil »).\n\n"
      + "3. Confirmez avec « Installer ».\n\n"
      + "JM Services apparaît alors avec vos autres applications et s'ouvre en plein écran.",
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
    // Already installed on this phone (site opened in Chrome rather than from its icon): no button.
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    nav.getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.length) {
          installedOnDevice = true;
          update();
        }
      })
      .catch(() => {});
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
    else if (state.android) showAndroidHelp();
  }, [state.ios, state.android]);

  return { ...state, install };
}
