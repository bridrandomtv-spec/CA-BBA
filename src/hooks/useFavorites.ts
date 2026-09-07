import { useCallback, useEffect, useState } from 'react';
import { readJSON, STORAGE_KEYS, writeJSON } from '../lib/storage';

const FAVORITES_UPDATED_EVENT = 'favoritesUpdated';

function readFavorites(): string[] {
  const value = readJSON<unknown>(STORAGE_KEYS.favorites, null);
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string');
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    window.addEventListener(FAVORITES_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleFavorite = useCallback((matchId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(matchId)
        ? prev.filter((id) => id !== matchId)
        : [...prev, matchId];
      writeJSON(STORAGE_KEYS.favorites, next);
      window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (matchId: string) => favorites.includes(matchId),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite };
}
