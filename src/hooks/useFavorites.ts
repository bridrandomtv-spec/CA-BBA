// Favoris — effets de bord hors de l'updater setState.
// L'ancien toggleFavorite appelait writeJSON + dispatchEvent DANS l'updater :
// React exige des updaters purs (StrictMode les invoque deux fois). Le chemin
// de synchro (autre onglet / autre composant) ne ré-écrit JAMAIS — aucun
// ping-pong d'events `storage` entre onglets.
import { useCallback, useEffect, useRef, useState } from 'react';
import { readJSON, STORAGE_KEYS, writeJSON } from '../lib/storage';

const FAVORITES_UPDATED_EVENT = 'favoritesUpdated';

function readFavorites(): string[] {
  const value = readJSON<unknown>(STORAGE_KEYS.favorites, null);
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string');
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  // Miroir synchrone de l'état : toggleFavorite calcule `next` à partir de la
  // dernière valeur connue même si plusieurs toggles ont lieu avant un rendu.
  const favoritesRef = useRef(favorites);

  const applyFavorites = useCallback((next: string[]) => {
    favoritesRef.current = next;
    setFavorites(next);
  }, []);

  useEffect(() => {
    // Synchro passive : lecture seule. Ne jamais écrire ici — un onglet qui
    // réécrit la valeur qu'il vient de recevoir déclencherait un nouveau
    // `storage` event chez l'autre (boucle entre onglets).
    const sync = () => applyFavorites(readFavorites());
    window.addEventListener(FAVORITES_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [applyFavorites]);

  const toggleFavorite = useCallback((matchId: string) => {
    const current = favoritesRef.current;
    const next = current.includes(matchId)
      ? current.filter((id) => id !== matchId)
      : [...current, matchId];

    // Écriture + diffusion hors rendu : dans le gestionnaire d'événement,
    // une seule fois par clic.
    applyFavorites(next);
    writeJSON(STORAGE_KEYS.favorites, next);
    window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
  }, [applyFavorites]);

  const isFavorite = useCallback(
    (matchId: string) => favorites.includes(matchId),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite };
}
