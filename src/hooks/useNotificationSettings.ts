import { useCallback, useEffect, useState } from 'react';
import { readJSON, STORAGE_KEYS, writeJSON } from '../lib/storage';

/**
 * Réglages de notifications — schéma unique pour toute l'application.
 *
 * Avant ce hook, trois composants écrivaient la même clé localStorage
 * (`cabba-notifications`) avec trois formes différentes :
 *   - NotificationSettings : { goals, breakingNews, matches }
 *   - NotificationCenter   : { matches, teamNews, finalScores }
 *   - MatchAlert lisait     : matches, teamNews, finalScores
 * Résultat : les interrupteurs « أهداف » et « الأخبار العاجلة » de l'écran
 * العضوية n'avaient aucun effet, et les deux écrans de réglages affichaient des
 * états contradictoires pour la même préférence.
 *
 * `breakingNews` et `teamNews` désignaient la même chose : ils sont fusionnés
 * sous `teamNews`, avec migration de l'ancienne valeur.
 */
export interface NotificationSettings {
  /** أهداف المباريات — إشعار فوري عند تسجيل هدف */
  goals: boolean;
  /** مواعيد المباريات — تذكير قبل بداية المباراة */
  matches: boolean;
  /** الأخبار العاجلة — صفقات وقرارات الإدارة */
  teamNews: boolean;
  /** نهاية المباراة — النتيجة النهائية */
  finalScores: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  goals: true,
  matches: false,
  teamNews: true,
  finalScores: false,
};

/** Émis après chaque écriture, pour que toutes les vues montées se resynchronisent. */
export const NOTIFICATIONS_UPDATED_EVENT = 'cabba-notifications-updated';
/** Émis par le centre de notifications pour déclencher une alerte de test. */
export const TRIGGER_NOTIFICATION_EVENT = 'cabba-trigger-notification';

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Normalise et migre ce qui se trouve en stockage vers le schéma courant. */
export function normalizeSettings(raw: unknown): NotificationSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_NOTIFICATION_SETTINGS };

  const value = raw as Record<string, unknown>;
  const legacyNews = value.breakingNews;

  return {
    goals: asBoolean(value.goals, DEFAULT_NOTIFICATION_SETTINGS.goals),
    matches: asBoolean(value.matches, DEFAULT_NOTIFICATION_SETTINGS.matches),
    teamNews: asBoolean(
      value.teamNews,
      asBoolean(legacyNews, DEFAULT_NOTIFICATION_SETTINGS.teamNews),
    ),
    finalScores: asBoolean(value.finalScores, DEFAULT_NOTIFICATION_SETTINGS.finalScores),
  };
}

export function readNotificationSettings(): NotificationSettings {
  return normalizeSettings(readJSON<unknown>(STORAGE_KEYS.notifications, null));
}

export function writeNotificationSettings(settings: NotificationSettings): void {
  writeJSON(STORAGE_KEYS.notifications, settings);
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

/**
 * Source de vérité partagée. Tout composant qui l'utilise reste synchronisé
 * avec les autres, y compris entre onglets du navigateur.
 */
export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(readNotificationSettings);

  useEffect(() => {
    const sync = () => setSettings(readNotificationSettings());

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, sync);
    // `storage` couvre les modifications faites dans un autre onglet.
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleSetting = useCallback((key: keyof NotificationSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeNotificationSettings(next);
      return next;
    });
  }, []);

  return { settings, toggleSetting };
}
