import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parametreService } from '@/data_api/services/parametreService';

const CACHE_KEY = 'parametre:CODE_PROMO';

/**
 * Promo code set by the admin (parameter CODE_PROMO). Empty string = no code to show.
 * The last known code is cached so the screen does not wait for the network.
 */
export function usePromoCode(): string {
  const [code, setCode] = useState('');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(CACHE_KEY)
      .then((cached) => { if (active && cached) setCode(cached); })
      .catch(() => {});
    parametreService.getById('CODE_PROMO')
      .then((parametre) => {
        if (!active) return;
        const value = parametre?.valeurTexte?.trim() ?? '';
        setCode(value);
        AsyncStorage.setItem(CACHE_KEY, value).catch(() => {});
      })
      // Offline or older server: keep the cached code.
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return code;
}
