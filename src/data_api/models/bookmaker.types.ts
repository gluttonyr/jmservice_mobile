export interface Bookmaker {
  trackingId: string;
  /** Sent to the API as `bookmaker` when creating a transaction, e.g. "1XBET". */
  code: string;
  nom: string;
  imageUrl?: string | null;
  active: boolean;
  ordre: number;
  /** False = listed as "Bientôt", cannot be chosen yet. */
  disponible: boolean;
}

/** Used when the server has no bookmaker list (older backend or offline): the app works as before, 1XBET only. */
export const DEFAULT_BOOKMAKER: Bookmaker = {
  trackingId: 'default-1xbet',
  code: '1XBET',
  nom: '1XBET',
  imageUrl: null,
  active: true,
  ordre: 1,
  disponible: true,
};
