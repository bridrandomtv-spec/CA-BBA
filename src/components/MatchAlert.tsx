import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { X, Calendar, Newspaper, Trophy, Goal, Bell } from 'lucide-react';
import {
  TRIGGER_NOTIFICATION_EVENT,
  useNotificationSettings,
  type NotificationSettings,
} from '../hooks/useNotificationSettings';

/** Durée d'affichage d'une alerte à l'écran. */
const ALERT_DURATION_MS = 10_000;

export type AlertKind = 'goal' | 'match' | 'news' | 'score';

export interface Alert {
  type: AlertKind;
  title: string;
  message: string;
}

const getIconForType = (type: AlertKind) => {
  switch (type) {
    case 'goal': return Goal;
    case 'match': return Calendar;
    case 'news': return Newspaper;
    case 'score': return Trophy;
    default: return Bell;
  }
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
    const handleRealAlert = (event: Event) => {
      const customEvent = event as CustomEvent<Alert>;
      if (!customEvent.detail) return;
      
      const incomingAlert = customEvent.detail;
      
      // Filter by settings
      const typeMapping: Record<AlertKind, keyof NotificationSettings> = {
        goal: 'goals',
        match: 'matches',
        news: 'teamNews',
        score: 'finalScores'
      };
      
      const settingKey = typeMapping[incomingAlert.type];
      if (settingKey && !settings[settingKey]) {
        return; // User disabled this type
      }

      setAlert(incomingAlert);

      clearHideTimer();
      hideTimer.current = setTimeout(() => setAlert(null), ALERT_DURATION_MS);
    };

    window.addEventListener(TRIGGER_NOTIFICATION_EVENT, handleRealAlert);

    return () => {
      window.removeEventListener(TRIGGER_NOTIFICATION_EVENT, handleRealAlert);
      clearHideTimer();
    };
  }, [settings]);

  if (!alert) return null;

  const AlertIcon = getIconForType(alert.type);

  return (
    <div
      className="fixed top-safe pt-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-xl md:top-6 z-[100] animate-in slide-in-from-top-10 fade-in duration-500"
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
