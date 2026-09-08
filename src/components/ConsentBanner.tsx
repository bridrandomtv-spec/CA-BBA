// Bandeau de consentement analytics (RGPD), en arabe et RTL.
//  - Ni « accepté par défaut » ni case pré-cochée : le refus est aussi
//    simple que l'acceptation (deux boutons équivalents, RGPD art. 7).
//  - Positionné au-dessus de la BottomNav, dans la colonne de contenu.
//  - Un seul écran à la fois : App ne le monte pas pendant l'onboarding.
import { useState } from 'react';
import { BarChart3, X } from 'lucide-react';
import { getAnalyticsConsent, setAnalyticsConsent, type ConsentChoice } from '../lib/consent';

export default function ConsentBanner() {
  // Lu à l'initialisation : si un choix existe déjà, le bandeau ne monte jamais.
  const [visible, setVisible] = useState(() => getAnalyticsConsent() === null);

  if (!visible) return null;

  const decide = (choice: ConsentChoice) => {
    setAnalyticsConsent(choice);
    setVisible(false);
  };

  return (
    <div
      className="absolute bottom-16 inset-x-0 z-30 p-3"
      dir="rtl"
      role="dialog"
      aria-modal="false"
      aria-label="الموافقة على الإحصائيات"
    >
      <div className="bg-zinc-900 border border-yellow-500/30 rounded-2xl p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex-none rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <BarChart3 size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-white font-semibold leading-snug">
              الإحصائيات المجهولة
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
              نستخدم إحصائيات مجهولة تماماً (بدون عنوان IP أو هوية) لتحسين التطبيق.
              لن يتم إرسال أي بيانات ما لم توافق. يمكنك تغيير رأيك في أي وقت من الملف الشخصي.
            </p>
          </div>
          <button
            onClick={() => decide('denied')}
            aria-label="إغلاق ورفض"
            className="flex-none text-zinc-500 hover:text-zinc-300 p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          {/* Les deux boutons ont le même poids visuel de taille ; l'acceptation
              garde l'accent jaune de la marque sans être plus proéminente. */}
          <button
            onClick={() => decide('granted')}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-2.5 rounded-xl transition-colors"
          >
            موافق
          </button>
          <button
            onClick={() => decide('denied')}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            لا، شكراً
          </button>
        </div>
      </div>
    </div>
  );
}
