/**
 * Rôles utilisateur disponibles
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VENDEUR = 'VENDEUR',
  AFFILIER = 'AFFILIER',
}

/**
 * Utilisateur renvoyé par le backend
 */
export interface User {
  trackingId: string;
  nom: string;
  prenom: string;
  username: string;
  // A client may sign up with a phone number only, or with an email only.
  email: string | null;
  telephone: string | null;
  image?: string | null;
  role: UserRole;
  active: boolean;
  googleId?: string | null;
  appleId?: string | null;
  provider?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Sign-in with an email address or a phone number (international form, e.g. +22890000000).
export interface LoginRequest {
  email?: string;
  telephone?: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  token: string;
  user: User;
}

export interface CreateUserDto {

  nom: string;


  prenom: string;


  username?: string;

  // Email or telephone: at least one.
  email?: string;

  // Optional for Sign in with Apple: Apple already authenticates the account.
  password?: string;


  telephone?: string;


  role?: string;


  active?: boolean;


  googleId?: string;
  appleId?: string;
  identityToken?: string;

  provider?: string;
}
