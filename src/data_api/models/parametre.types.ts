export interface Parametre {
  trackingId: string;
  code: string;
  libelle: string;
  valeur: number;
  /** Text value of non-numeric parameters (e.g. CODE_PROMO). */
  valeurTexte?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Parametres = Parametre[];
