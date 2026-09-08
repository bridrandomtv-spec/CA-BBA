// إعدادات الإشعارات — trois findings corrigés :
//  1. PRÉFÉRENCE MANQUANTE : le schéma partagé définit QUATRE réglages
//     (goals, matches, teamNews, finalScores) mais cet écran n'en exposait
//     que trois — impossible de désactiver les résultats finaux depuis le
//     Profil.
//  2. DÉSYNC SERVEUR : NotificationCenter synchronise chaque toggle vers les
//     préférences push, ce composant ne le faisait PAS — un supporter qui
//     désactivait « أهداف » ici continuait de recevoir les pushs de buts (le
//     filtrage local ne s'applique qu'à MatchAlert ; la décision push est
//     côté serveur, par abonnement).
//  3. ACCESSIBILITÉ : interrupteurs sans rôle ni état exposé → role="switch"
//     + aria-checked + aria-label.
import { useState } from 'react';
import { Bell, Goal, Zap, Calendar, Trophy, ChevronLeft, ChevronDown } from 'lucide-react';
import { useNotificationSettings, type NotificationSettings as Settings } from '../hooks/useNotificationSettings';
import usePushNotifications from '../hooks/usePushNotifications';

interface ToggleRowProps {
  icon: typeof Goal;
  iconClass: string;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

/** Interrupteur accessible unique — les quatre réglages partagent le rendu. */
function ToggleRow({ icon: Icon, iconClass, title, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconClass}`}>
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-white mb-0.5">{title}</p>
          <p className="text-[10px] text-zinc-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${checked ? 'bg-yellow-500' : 'bg-zinc-700'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${checked ? 'left-1' : 'right-1'}`}></div>
      </button>
    </div>
  );
}

export default function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  // Schéma partagé avec NotificationCenter et MatchAlert.
  const { settings, toggleSetting } = useNotificationSettings();
  // Les toggles sont aussi synchronisés vers les préférences push SERVEUR.
  // syncPreferences est no-op si l'appareil n'est pas abonné.
  const push = usePushNotifications();

  const handleToggle = (key: keyof Settings) => {
    const next: Settings = { ...settings, [key]: !settings[key] };
    toggleSetting(key);
    void push.syncPreferences(next);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-zinc-400" />
          <span className="text-sm text-white font-medium">إعدادات الإشعارات</span>
        </div>
        {isOpen ? <ChevronDown size={16} className="text-zinc-600" /> : <ChevronLeft size={16} className="text-zinc-600" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-zinc-800/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
          <ToggleRow
            icon={Goal}
            iconClass="bg-green-500/10 text-green-500"
            title="أهداف المباريات"
            description="إشعار فوري عند تسجيل الكابا لهدف"
            checked={settings.goals}
            onToggle={() => handleToggle('goals')}
          />

          <ToggleRow
            icon={Trophy}
            iconClass="bg-yellow-500/10 text-yellow-400"
            title="النتيجة النهائية"
            description="إشعار عند نهاية المباراة بالنتيجة النهائية"
            checked={settings.finalScores}
            onToggle={() => handleToggle('finalScores')}
          />

          <ToggleRow
            icon={Zap}
            iconClass="bg-red-500/10 text-red-500"
            title="الأخبار العاجلة"
            description="أحدث صفقات النادي وقرارات الإدارة"
            checked={settings.teamNews}
            onToggle={() => handleToggle('teamNews')}
          />

          <ToggleRow
            icon={Calendar}
            iconClass="bg-blue-500/10 text-blue-500"
            title="مواعيد المباريات"
            description="تذكير قبل بداية مباريات الفريق"
            checked={settings.matches}
            onToggle={() => handleToggle('matches')}
          />

          {/* Sans abonnement push actif, ces réglages ne filtrent que les
              alertes in-app : le rappeler évite un faux sentiment de contrôle. */}
          {!push.subscribed && (
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              لتصلك الإشعارات حتى عند إغلاق التطبيق، فعّل «إشعارات الهاتف» من مركز الإشعارات.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
