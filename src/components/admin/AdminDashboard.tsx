// لوحة الإدارة — version corrigée :
//  1. MODULE INATTEIGNABLE : `activeView === 'memberships'` rendait
//     AdminMemberships mais AUCUNE entrée du menu ne portait cet id — la
//     gestion des adhésions (cartes QR, statuts) était inaccessible. Rétablie.
//  2. Sondages : entrée réelle (AdminPolls) — 'community' et 'settings'
//     restent les seuls modules « prévus ».
//  3. Chaîne if/else non typée → mapping direct vérifié par TypeScript.
//  4. `alert()` → notification inline.
//  5. `min-h-screen` dans une colonne déjà bornée → `min-h-full`.
import { useState } from 'react';
import {
  Users, Newspaper, Trophy, MessageSquare, Music, CreditCard,
  Video, ShoppingBag, ShieldAlert, Settings, BarChart3, ListChecks, Heart, Ticket, Wallet, Handshake, ScrollText, Landmark, GraduationCap, Bus, Award
} from 'lucide-react';
import AdminNews from './AdminNews';
import AdminMatches from './AdminMatches';
import AdminUsers from './AdminUsers';
import AdminChants from './AdminChants';
import AdminVideos from './AdminVideos';
import AdminStore from './AdminStore';
import AdminMemberships from './AdminMemberships';
import AdminAnalytics from './AdminAnalytics';
import AdminPolls from './AdminPolls';
import AdminSupport from './AdminSupport';
import AdminTickets from './AdminTickets';
import AdminAccounting from './AdminAccounting';
import AdminSponsors from './AdminSponsors';
import AdminAudit from './AdminAudit';
import AdminMuseum from './AdminMuseum';
import AdminAcademy from './AdminAcademy';
import AdminTrips from './AdminTrips';
import AdminPayments from './AdminPayments';
import AdminLoyalty from './AdminLoyalty';

type AdminView = 'menu' | 'news' | 'matches' | 'users' | 'chants' | 'videos' | 'store' | 'memberships' | 'analytics' | 'polls' | 'support' | 'tickets' | 'accounting' | 'sponsors' | 'audit' | 'museum' | 'academy' | 'trips' | 'payments' | 'loyalty';

interface AdminModule {
  id: AdminView | 'planned';
  key: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<AdminView>('menu');
  const [notice, setNotice] = useState<string | null>(null);

  const adminModules: AdminModule[] = [
    { id: 'news', key: 'news', title: 'إدارة الأخبار', icon: <Newspaper size={20} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'matches', key: 'matches', title: 'إدارة المباريات', icon: <Trophy size={20} />, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { id: 'users', key: 'users', title: 'إدارة المستخدمين', icon: <Users size={20} />, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'memberships', key: 'memberships', title: 'إدارة العضويات', icon: <CreditCard size={20} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'store', key: 'store', title: 'إدارة المتجر', icon: <ShoppingBag size={20} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'chants', key: 'chants', title: 'إدارة الأهازيج', icon: <Music size={20} />, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { id: 'videos', key: 'videos', title: 'إدارة الفيديوهات', icon: <Video size={20} />, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'polls', key: 'polls', title: 'إدارة الاستطلاعات', icon: <ListChecks size={20} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'support', key: 'support', title: 'إدارة صندوق الدعم', icon: <Heart size={20} />, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'tickets', key: 'tickets', title: 'التذاكر والمراقبة', icon: <Ticket size={20} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'accounting', key: 'accounting', title: 'المحاسبة والتقارير', icon: <Wallet size={20} />, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { id: 'sponsors', key: 'sponsors', title: 'شركاء النادي', icon: <Handshake size={20} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'audit', key: 'audit', title: 'سجل التدقيق والتصدير', icon: <ScrollText size={20} />, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'museum', key: 'museum', title: 'المتحف والبطولات', icon: <Landmark size={20} />, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { id: 'academy', key: 'academy', title: 'مدرسة الكرة', icon: <GraduationCap size={20} />, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { id: 'trips', key: 'trips', title: 'تنقلات الأنصار', icon: <Bus size={20} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'loyalty', key: 'loyalty', title: 'نقاط الوفاء', icon: <Award size={20} />, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { id: 'payments', key: 'payments', title: 'المدفوعات والتحصيل', icon: <CreditCard size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { id: 'analytics', key: 'analytics', title: 'التحليلات', icon: <BarChart3 size={20} />, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { id: 'planned', key: 'community', title: 'إدارة المجتمع', icon: <MessageSquare size={20} />, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'planned', key: 'settings', title: 'إعدادات النظام', icon: <Settings size={20} />, color: 'text-zinc-400', bg: 'bg-zinc-800' },
  ];

  const openModule = (module: AdminModule) => {
    if (module.id === 'planned') {
      setNotice('هذه الوحدة قيد التطوير');
      return;
    }
    setNotice(null);
    setActiveView(module.id);
  };

  return (
    <div className="w-full min-h-full bg-zinc-950 p-4 pb-24 animate-in fade-in" dir="rtl">
      <div className="flex items-center gap-3 mb-6 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
        <ShieldAlert size={28} className="text-yellow-500" />
        <div>
          <h2 className="text-xl font-bold text-white">لوحة الإدارة</h2>
          <p className="text-xs text-zinc-400">تحكم كامل في التطبيق - منطقة خطرة</p>
        </div>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="mb-4 p-3 rounded-xl border text-sm font-bold bg-zinc-800/60 border-zinc-700 text-zinc-300 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      {activeView === 'menu' && (
        <div className="grid grid-cols-2 gap-3">
          {adminModules.map((module) => (
            <button
              key={module.key}
              onClick={() => openModule(module)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors aspect-square"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${module.bg} ${module.color}`}>
                {module.icon}
              </div>
              <span className="text-sm font-bold text-white">{module.title}</span>
            </button>
          ))}
        </div>
      )}

      {activeView === 'news' && <AdminNews onBack={() => setActiveView('menu')} />}
      {activeView === 'matches' && <AdminMatches onBack={() => setActiveView('menu')} />}
      {activeView === 'users' && <AdminUsers onBack={() => setActiveView('menu')} />}
      {activeView === 'chants' && <AdminChants onBack={() => setActiveView('menu')} />}
      {activeView === 'videos' && <AdminVideos onBack={() => setActiveView('menu')} />}
      {activeView === 'store' && <AdminStore onBack={() => setActiveView('menu')} />}
      {activeView === 'memberships' && <AdminMemberships onBack={() => setActiveView('menu')} />}
      {activeView === 'polls' && <AdminPolls onBack={() => setActiveView('menu')} />}
      {activeView === 'support' && <AdminSupport onBack={() => setActiveView('menu')} />}
      {activeView === 'tickets' && <AdminTickets onBack={() => setActiveView('menu')} />}
      {activeView === 'accounting' && <AdminAccounting onBack={() => setActiveView('menu')} />}
      {activeView === 'sponsors' && <AdminSponsors onBack={() => setActiveView('menu')} />}
      {activeView === 'audit' && <AdminAudit onBack={() => setActiveView('menu')} />}
      {activeView === 'museum' && <AdminMuseum onBack={() => setActiveView('menu')} />}
      {activeView === 'academy' && <AdminAcademy onBack={() => setActiveView('menu')} />}
      {activeView === 'trips' && <AdminTrips onBack={() => setActiveView('menu')} />}
      {activeView === 'loyalty' && <AdminLoyalty onBack={() => setActiveView('menu')} />}
      {activeView === 'payments' && <AdminPayments onBack={() => setActiveView('menu')} />}
      {activeView === 'analytics' && <AdminAnalytics onBack={() => setActiveView('menu')} />}
    </div>
  );
}
