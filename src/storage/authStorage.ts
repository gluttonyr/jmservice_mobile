import * as SecureStore from '@/storage/secureStore';
import { User } from '@/data_api/models/user.types';
import { syncThemeWithAccount } from '@/constants/colors';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
let tokenCache: string | null | undefined;

export const authStorage = {
  async getToken() {
    if (tokenCache !== undefined) return tokenCache;
    tokenCache = await SecureStore.getItemAsync(TOKEN_KEY);
    return tokenCache;
  },

  async setToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    tokenCache = token;
  },

  async removeToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    tokenCache = null;
  },

  /** Profil mis en cache localement : permet de connaître le rôle de
   * l'utilisateur (et de lui afficher des données) avant même d'avoir
   * contacté le serveur au démarrage de l'app. */
  async getUser(): Promise<User | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },

  async setUser(user: User) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    // Admin: dark theme; client: the theme they chose (the website restarts if it must change).
    syncThemeWithAccount(user?.role);
  },

  async removeUser() {
    await SecureStore.deleteItemAsync(USER_KEY);
    syncThemeWithAccount(null);
  },
};
