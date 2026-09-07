import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { X, Calendar, Newspaper, Trophy, Goal } from 'lucide-react';
import {
  NOTIFICATIONS_UPDATED_EVENT,
  TRIGGER_NOTIFICATION_EVENT,
  useNotificationSettings,
  type NotificationSettings,
} from '../hooks/useNotificationSettings';

/** Durée d'affichage d'une alerte à l'écran. */
const ALERT_DURATION_MS = 10_000;
/** Fréquence de la simulation d'alertes (données de démonstration). */
const SIMULATION_INTERVAL_MS = 60_000;

type AlertKind = 'goal' | 'match' | 'news' | 'score';

interface Alert {
  type: AlertKind;
  title: string;
  message: string;
  icon: ComponentType<{ size?: number }>;
}

/**
 * Alertes de démonstration, une par préférence activée.
 * À remplacer par de vraies notifications Push (voir README).
 */
const ALERTS: Record<keyof NotificationSettings, Alert> = {
  goals: {
    type: 'goal',
    title: 'هدف للكابا! ⚽',
    message: 'الجراد الأصفر يسجل! هدف رائع يشعل المدرجات.',
    icon: Goal,
  },
  matches: {
    type: 'match',
    title: 'تذكير بمباراة قادمة!',
    message: 'تبدأ مباراة الكابا القادمة خلال 30 دقيقة. استعد لدعم فريقك!',
    icon: Calendar,
  },
  teamNews: {
    type: 'news',
    title: 'خبر عاجل!',
    message: 'الكابا يعلن عن تعاقد جديد لتعزيز صفوف الفريق الأول.',
    icon: Newspaper,
  },
  finalScores: {
    type: 'score',
    title: 'نهاية المباراة!',
    message: 'الكابا 2 - 0 شبيبة القبائل. فوز مستحق للجراد الأصفر!',
    icon: Trophy,
  },
};

export default function MatchAlert() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const { settings } = useNotificationSettings();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  useEffect(() => {
    // Ne tirer que parmi les catégories réellement activées par l'utilisateur.
    const enabled = (Object.keys(ALERTS) as Array<keyof NotificationSettings>).filter(
      (key) => settings[key],
    );

    const showRandomAlert = () => {
      if (enabled.length === 0) {
        setAlert(null);
        return;
      }

      setAlert(ALERTS[enabled[Math.floor(Math.random() * enabled.length)]]);

      // Le timer précédent doit être annulé, sinon une nouvelle alerte hérite du
      // compte à rebours de l'ancienne et disparaît trop tôt.
      clearHideTimer();
      hideTimer.current = setTimeout(() => setAlert(null), ALERT_DURATION_MS);
    };

    // Si l'utilisateur coupe toutes les catégories, l'alerte affichée s'efface.
    if (enabled.length === 0) setAlert(null);

    window.addEventListener(TRIGGER_NOTIFICATION_EVENT, showRandomAlert);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, showRandomAlert);
    const interval = setInterval(showRandomAlert, SIMULATION_INTERVAL_MS);

    return () => {
      window.removeEventListener(TRIGGER_NOTIFICATION_EVENT, showRandomAlert);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, showRandomAlert);
      clearInterval(interval);
      clearHideTimer();
    };
    // `settings` en dépendance : sans lui, les écouteurs gardaient une copie
    // périmée des préférences (stale closure) et ignoraient tout changement.
  }, [settings]);

  if (!alert) return null;

  const AlertIcon = alert.icon;

  return (
    <div
      className="fixed top-safe pt-4 left-4 right-4 z-[100] animate-in slide-in-from-top-10 fade-in duration-500"
      role="status"
      aria-live="polite"
    >
      <div className="bg-zinc-900 border border-yellow-500/30 shadow-[0_10px_30px_rgba(234,179,8,0.2)] rounded-2xl p-4 flex items-start gap-4" dir="rtl">
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0 mt-1">
          <AlertIcon size={20} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-white text-sm mb-1">{alert.title}</h4>
          <p className="text-xs text-zinc-300 mb-2">{alert.message}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">تنبيه فوري</span>
          </div>
        </div>
        <button
          onClick={() => {
            clearHideTimer();
            setAlert(null);
          }}
          className="text-zinc-500 hover:text-white transition-colors"
          aria-label="إغلاق التنبيه"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
