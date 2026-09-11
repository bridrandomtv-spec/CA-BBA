// Contexte d'authentification — logout toujours nettoyant.
// L'ancienne version n'appelait setUserData(null) que si fetch ne rejetait
// pas : hors ligne, l'utilisateur restait « connecté » avec une session morte
// et chaque écran enchaînait les 401. Depuis le correctif token_version,
// /logout est authentifié : une session déjà révoquée répond 401 — c'est
// précisément le cas où l'état local doit être nettoyé.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface UserData {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin' | 'scanner';
  createdAt: string;
}

interface AuthContextType {
  currentUser: UserData | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setUserData(data.user);
      } else {
        setUserData(null);
      }
    } catch {
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (error) {
      console.error('[CABBA] logout : requête échouée, état local nettoyé quand même.', error);
    } finally {
      setUserData(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser: userData, userData, loading, logout, refreshUser: fetchUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
