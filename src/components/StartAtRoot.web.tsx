import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';

// Website: every visit starts at "/" (the animated splash), whatever page address was opened or reloaded.
// Same behaviour as nginx in production (nginx.web.conf sends any page URL back to "/"); it also applies
// to the Expo dev server, which serves every URL directly. The splash then picks the right space
// (client or admin) from the session, since both homes share the URL /home.
// Left alone: the Google / Apple sign-in popup and any address carrying parameters (auth callbacks).
const openedAt = typeof window !== 'undefined' ? window.location : null;
const startsElsewhere = !!openedAt
  && openedAt.pathname !== '/'
  && !window.opener
  && !openedAt.search
  && !openedAt.hash;

export function StartAtRoot() {
  const navigationKey = useRootNavigationState()?.key;
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !startsElsewhere || !navigationKey) return;
    done.current = true;
    router.replace('/');
  }, [navigationKey]);
  return null;
}
