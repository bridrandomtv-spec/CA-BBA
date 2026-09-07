import { useState } from 'react';
import {
  Users, Newspaper, Trophy, MessageSquare, Music,
  Video, ShoppingBag, ShieldAlert, Settings, ChevronRight, BarChart3
} from 'lucide-react';
import AdminNews from './AdminNews';
import AdminMatches from './AdminMatches';
import AdminUsers from './AdminUsers';
import AdminChants from './AdminChants';
import AdminVideos from './AdminVideos';
import AdminStore from './AdminStore';
import AdminMemberships from './AdminMemberships';
import AdminAnalytics from './AdminAnalytics';

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<'menu' | 'news' | 'matches' | 'users' | 'chants' | 'videos' | 'store' | 'memberships' | 'analytics'>('menu');

  const adminModules = [
    { id: 'news', title: 'إدارة الأخبار', icon: <Newspaper size={20} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'matches', title: 'إدارة المباريات', icon: <Trophy size={20} />, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { id: 'users', title: 'إدارة المستخدمين', icon: <Users size={20} />, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'store', title: 'إدارة المتجر', icon: <ShoppingBag size={20} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'chants', title: 'إدارة الأهازيج', icon: <Music size={20} />, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { id: 'videos', title: 'إدارة الفيديوهات', icon: <Video size={20} />, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'community', title: 'إدارة المجتمع', icon: <MessageSquare size={20} />, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'analytics', title: 'التحليلات', icon: <BarChart3 size={20} />, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { id: 'settings', title: 'إعدادات النظام', icon: <Settings size={20} />, color: 'text-zinc-400', bg: 'bg-zinc-800' },
  ];

  return (
    <div className="w-full min-h-screen bg-zinc-950 p-4 pb-24 animate-in fade-in" dir="rtl">
      <div className="flex items-center gap-3 mb-6 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
        <ShieldAlert size={28} className="text-yellow-500" />
        <div>
          <h2 className="text-xl font-bold text-white">لوحة الإدارة</h2>
          <p className="text-xs text-zinc-400">تحكم كامل في التطبيق - منطقة خطرة</p>
        </div>
      </div>

      {activeView === 'menu' && (
        <div className="grid grid-cols-2 gap-3">
          {adminModules.map((module) => (
            <button
              key={module.id}
              onClick={() => {
                if (module.id === 'news') setActiveView('news');
                else if (module.id === 'matches') setActiveView('matches');
                else if (module.id === 'users') setActiveView('users');
                else if (module.id === 'chants') setActiveView('chants');
                else if (module.id === 'videos') setActiveView('videos');
                else if (module.id === 'store') setActiveView('store');
                else if (module.id === 'memberships') setActiveView('memberships');
                else if (module.id === 'analytics') setActiveView('analytics');
                else alert('هذه الوحدة قيد التطوير');
              }}
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
      {activeView === 'analytics' && <AdminAnalytics onBack={() => setActiveView('menu')} />}
    </div>
  );
}
