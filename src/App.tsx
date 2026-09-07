/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Tab } from './types';
import { readString, STORAGE_KEYS, writeString } from './lib/storage';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import MatchCenter from './components/MatchCenter';
import CabbaTv from './components/CabbaTv';
import ChantsLibrary from './components/ChantsLibrary';
import Store from './components/Store';
import Profile from './components/Profile';
import AiAssistant from './components/AiAssistant';
import FanCommunity from './components/FanCommunity';
import OnboardingCarousel from './components/OnboardingCarousel';
import MatchAlert from './components/MatchAlert';
import NotificationCenter from './components/NotificationCenter';
import { Bell, Bot, X } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import { trackPageView } from './lib/analytics';

import { useEffect } from 'react';

export default function App() {
  const { currentUser, loading: authLoading, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    return (sessionStorage.getItem('activeTab') as Tab) || 'home';
  });

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    trackPageView(`/` + activeTab);
  }, [activeTab]);
  
  useEffect(() => {
    const handleNav = (e: any) => setActiveTab(e.detail);
    window.addEventListener('navigate', handleNav);
    return () => window.removeEventListener('navigate', handleNav);
  }, []);
  const [showAi, setShowAi] = useState(false);
  // Lu à l'initialisation plutôt que dans un useEffect : évite que le carrousel
  // apparaisse en sautant après le premier rendu.
  const [showOnboarding, setShowOnboarding] = useState(
    () => readString(STORAGE_KEYS.onboarded) === null,
  );
  const [showNotifications, setShowNotifications] = useState(false);

  const handleOnboardingComplete = () => {
    writeString(STORAGE_KEYS.onboarded, 'true');
    setShowOnboarding(false);
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'home': return <Home onNavigate={setActiveTab} />;
      case 'match': return <MatchCenter />;
      case 'chants': return <ChantsLibrary />;
      case 'tv': return <CabbaTv />;
      case 'store': return <Store />;
      case 'profile': return <Profile />;
      case 'community': return <FanCommunity />;
      case 'admin': return userData?.role === 'admin' ? <AdminDashboard /> : <Home onNavigate={setActiveTab} />;
      default: return <Home onNavigate={setActiveTab} />;
    }
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="w-full min-h-[100dvh] bg-zinc-950 flex justify-center">
        <div className="w-full max-w-md h-[100dvh] bg-zinc-950 border-x border-zinc-900/50">
          <Login onLogin={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-zinc-950 flex justify-center text-right font-sans" dir="rtl">
      <div className="w-full max-w-md h-[100dvh] bg-zinc-950 text-white overflow-hidden flex flex-col relative shadow-2xl border-x border-zinc-900/50">
        
        {showOnboarding && <OnboardingCarousel onComplete={handleOnboardingComplete} />}
        {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
        <MatchAlert />

        {/* Header */}
        <header className="flex-none bg-zinc-900 border-b border-yellow-500/20 p-4 pt-safe flex items-center justify-between z-10 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center font-bold text-black text-xl shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              C
            </div>
            <div className="text-right">
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">CABBA</h1>
              <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Bordj Bou Arreridj</p>
            </div>
          </div>
          <button
            onClick={() => setShowNotifications(true)}
            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center relative border border-zinc-700 hover:bg-zinc-700 transition-colors"
            aria-label="مركز الإشعارات"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1"></div>
            <Bell size={16} className="text-zinc-400" />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative pb-16">
          {renderScreen()}
        </main>

        {/* AI Assistant Panel */}
        {showAi && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
            <div className="h-[80%] bg-zinc-900 rounded-t-3xl border-t border-yellow-500/30 overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(234,179,8,0.1)]">
              <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 text-yellow-500">
                  <Bot size={20} />
                  <span className="font-bold">المساعد الذكي للكابا</span>
                </div>
                <button onClick={() => setShowAi(false)} className="text-zinc-400 hover:text-white bg-zinc-800 rounded-full p-1" aria-label="إغلاق المساعد">
                  <X size={20} />
                </button>
              </div>
              <AiAssistant />
            </div>
          </div>
        )}

        {/* FAB for AI */}
        {!showAi && (
          <button
            onClick={() => setShowAi(true)}
            className="absolute bottom-20 left-4 z-30 w-12 h-12 bg-yellow-500 text-black rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="فتح المساعد الذكي"
          >
            <Bot size={24} />
          </button>
        )}

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full z-20">
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>
    </div>
  );
}
