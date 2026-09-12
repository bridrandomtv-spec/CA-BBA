/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Coquille de l'application — version d'audit consolidée :
//  - n°5  code splitting : écrans chargés à la demande (React.lazy), Home et
//         coquille restent dans le bundle principal ;
//  - n°8  deep-linking par hash (#/match…) : liens partageables + bouton
//         retour navigateur fonctionnels, sans toucher au routage Express ;
//  - n°15 coquille desktop : rail latéral ≥ md, colonne mobile inchangée
//         en dessous (aucune régression sur la cible principale) ;
//  - n°16 bandeau de consentement RGPD monté hors onboarding ;
//  - résilience : ScreenErrorBoundary par écran — un crash ne démonte plus
//         toute l'application (la coquille et la navigation survivent).
import { useState, useEffect, lazy, Suspense } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tab } from './types';
import { readString, STORAGE_KEYS, writeString } from './lib/storage';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import ConsentBanner from './components/ConsentBanner';
import {
  Bell, Bot, X,
  Home as HomeIcon, Trophy, Tv, Music, ShoppingBag, Users, User as UserIcon, ShieldAlert,
  Landmark,
  Bus,
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import ResetPassword from './components/auth/ResetPassword';
import { trackPageView } from './lib/analytics';
// Seul le nommé est importé : la limite globale vit dans main.tsx, et un
// import par défaut inutilisé casserait `noUnusedLocals` (tsconfig strict).
import { ScreenErrorBoundary } from './components/ErrorBoundary';

const MatchCenter = lazy(() => import('./components/MatchCenter'));
const CabbaTv = lazy(() => import('./components/CabbaTv'));
const ChantsLibrary = lazy(() => import('./components/ChantsLibrary'));
const Store = lazy(() => import('./components/Store'));
const Profile = lazy(() => import('./components/Profile'));
const AiAssistant = lazy(() => import('./components/AiAssistant'));
const FanCommunity = lazy(() => import('./components/FanCommunity'));
const OnboardingCarousel = lazy(() => import('./components/OnboardingCarousel'));
const MatchAlert = lazy(() => import('./components/MatchAlert'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const TicketScanner = lazy(() => import('./components/TicketScanner'));
const LegalPages = lazy(() => import('./components/LegalPages'));
const Museum = lazy(() => import('./components/Museum'));
const AcademyForm = lazy(() => import('./components/AcademyForm'));
const Trips = lazy(() => import('./components/Trips'));
import ClubLogo from './components/ClubLogo';

/** Routes par hash : `#/store` partagé ouvre directement le bon écran. */
const TAB_ROUTES: Tab[] = ['home', 'match', 'chants', 'tv', 'store', 'profile', 'community', 'admin', 'scanner', 'legal', 'museum', 'academy', 'trips'];

function tabFromHash(): Tab | null {
  const raw = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return TAB_ROUTES.includes(raw as Tab) ? (raw as Tab) : null;
}

/** Rail latéral desktop — mêmes onglets que la BottomNav, libellés ar. */
const DESKTOP_NAV: Array<{ tab: Tab; label: string; icon: LucideIcon }> = [
  { tab: 'home', label: 'الرئيسية', icon: HomeIcon },
  { tab: 'match', label: 'مركز المباريات', icon: Trophy },
  { tab: 'tv', label: 'كابا TV', icon: Tv },
  { tab: 'chants', label: 'الأهازيج', icon: Music },
  { tab: 'store', label: 'المتجر', icon: ShoppingBag },
  { tab: 'community', label: 'المجتمع', icon: Users },
  { tab: 'profile', label: 'الملف الشخصي', icon: UserIcon },
  { tab: 'museum', label: 'المتحف', icon: Landmark },
  { tab: 'trips', label: 'التنقلات', icon: Bus },
];

function ScreenFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center py-24">
      <div
        className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"
        role="status"
        aria-label="جاري التحميل"
      />
    </div>
  );
}

export default function App() {
  const { currentUser, loading: authLoading, userData, refreshUser } = useAuth();

  // Route de réinitialisation du mot de passe (lien reçu par email) :
  // rendue HORS du flux d'authentification — un supporter bloqué dehors n'a
  // pas de session. Lue une seule fois : l'URL ne change pas pendant la vie
  // d'App (le retour post-reset passe par window.location.assign('/')).
  const [isResetRoute] = useState(() => window.location.pathname.startsWith('/reset-password'));

  // Priorité au lien profond : `#/store` partagé bat la session précédente.
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    return tabFromHash() ?? (sessionStorage.getItem('activeTab') as Tab) ?? 'home';
  });

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
    const target = `#/${activeTab}`;
    if (window.location.hash !== target) {
      // pushState plutôt que location.hash : pas de saut de scroll, et le
      // bouton retour remontera la pile des onglets visités.
      window.history.pushState(null, '', target);
    }
  }, [activeTab]);

  useEffect(() => {
    trackPageView(`/` + activeTab);
  }, [activeTab]);

  // Retour navigateur (popstate) et hash modifié à la main (hashchange).
  useEffect(() => {
    const syncFromUrl = () => {
      const next = tabFromHash() ?? 'home';
      setActiveTab((current) => (current === next ? current : next));
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);

  // Événement custom conservé : les composants qui naviguent via
  // `window.dispatchEvent(new CustomEvent('navigate', …))` continuent de
  // fonctionner, l'effet ci-dessus mettra l'URL à jour.
  useEffect(() => {
    const handleNav = (e: Event) => setActiveTab((e as CustomEvent<Tab>).detail);
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
      // `#/admin` partagé par un non-admin retombe sur Home : la garde de
      // rôle reste côté rendu (et côté serveur via requireAdmin).
      case 'admin': return userData?.role === 'admin' ? <AdminDashboard /> : <Home onNavigate={setActiveTab} />;
      case 'scanner': return (userData?.role === 'admin' || userData?.role === 'scanner') ? <TicketScanner /> : <Home onNavigate={setActiveTab} />;
      case 'legal': return <LegalPages />;
      case 'museum': return <Museum />;
      case 'academy': return <AcademyForm />;
      case 'trips': return <Trips />;
      default: return <Home onNavigate={setActiveTab} />;
    }
  };

  if (isResetRoute) {
    return <ResetPassword />;
  }

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
          {/* L'ancien `onLogin={() => {}}` était un callback mort : le contexte
              Auth est la source de vérité, on rafraîchit explicitement. */}
          <Login onLogin={() => { void refreshUser(); }} />
        </div>
      </div>
    );
  }

  // L'entrée « لوحة الإدارة » n'apparaît dans le rail que pour un admin —
  // la garde de rendu et requireAdmin côté serveur restent les vraies
  // protections ; ceci n'est que de l'affichage.
  const desktopTabs = userData?.role === 'admin'
    ? [...DESKTOP_NAV, { tab: 'admin' as Tab, label: 'لوحة الإدارة', icon: ShieldAlert }]
    : DESKTOP_NAV;

  return (
    <div
      className="w-full min-h-[100dvh] bg-zinc-950 flex justify-center text-right font-sans md:items-center md:py-[4dvh] md:[background-image:radial-gradient(ellipse_at_top,rgba(234,179,8,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(234,179,8,0.05),transparent_45%)]"
      dir="rtl"
    >
      <div className="w-full max-w-md md:max-w-6xl h-[100dvh] md:h-[92dvh] md:max-h-[920px] bg-zinc-950 text-white overflow-hidden flex flex-col md:flex-row relative shadow-2xl border-x border-zinc-900/50 md:border md:border-zinc-800/80 md:rounded-[2rem] md:shadow-[0_24px_80px_rgba(0,0,0,0.6)]">

        {/* Modales pleine colonne : au-dessus du rail comme du contenu. */}
        {showOnboarding && (
          <Suspense fallback={<ScreenFallback />}>
            <OnboardingCarousel onComplete={handleOnboardingComplete} />
          </Suspense>
        )}
        {showNotifications && (
          <Suspense fallback={<ScreenFallback />}>
            <NotificationCenter onClose={() => setShowNotifications(false)} />
          </Suspense>
        )}
        <Suspense fallback={null}>
          <MatchAlert />
        </Suspense>

        {/* Rail latéral — desktop uniquement. border-l en RTL = la bordure
            côté contenu. overflow-hidden + rounded du parent suffisent au
            recadrage : aucun arrondi par enfant. */}
        <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 border-l border-zinc-900 bg-zinc-950/60 p-4" aria-label="التنقل الرئيسي">
          <div className="flex items-center gap-3 px-2 py-3 mb-4">
            <ClubLogo size={40} />
            <div className="text-right">
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">CABBA</h1>
              <p className="text-[9px] text-yellow-500 uppercase tracking-wider font-semibold">Bordj Bou Arreridj</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {desktopTabs.map(({ tab, label, icon: NavIcon }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  activeTab === tab
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <NavIcon size={18} className="shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 px-2 text-center">
            <p className="text-[10px] text-zinc-600 font-bold">الجراد الأصفر 🟡⚫</p>
          </div>
        </aside>

        {/* Zone de contenu — le `relative` ancre FAB, panneau IA et bandeau
            de consentement SANS recouvrir le rail. */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">

          {/* RGPD (n°16) : pas de bandeau pendant l'onboarding — deux modales
              plein écran au premier lancement seraient empilées. */}
          {!showOnboarding && <ConsentBanner />}

          {/* Header — identité sur mobile ; sur desktop le rail la porte et
              on garde le titre d'onglet + la cloche de notifications. */}
          <header className="flex-none bg-zinc-900 border-b border-yellow-500/20 p-4 pt-safe flex items-center justify-between z-10 shadow-md md:pt-4 md:bg-transparent md:border-zinc-900 md:shadow-none">
            <div className="flex items-center gap-3 md:hidden">
              <ClubLogo size={40} />
              <div className="text-right">
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight">CABBA</h1>
                <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Bordj Bou Arreridj</p>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm font-bold text-zinc-400">
                {desktopTabs.find((entry) => entry.tab === activeTab)?.label ?? ''}
              </p>
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
          <main className="flex-1 overflow-y-auto overflow-x-hidden relative pb-16 md:pb-6">
            {/* Mesure de lecture bornée sur desktop : les écrans internes
                s'étirent jusqu'à 3xl, jamais au-delà. */}
            <div className="w-full md:max-w-3xl md:mx-auto">
              {/* `key={activeTab}` : changer d'onglet remonte une limite
                  vierge — un écran en erreur ne contamine pas l'onglet
                  suivant, et la coquille reste utilisable. */}
              <ScreenErrorBoundary key={activeTab} onHome={() => setActiveTab('home')}>
                <Suspense fallback={<ScreenFallback />}>
                  {renderScreen()}
                </Suspense>
              </ScreenErrorBoundary>
            </div>
          </main>

          {/* AI Assistant Panel */}
          {showAi && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
              <div className="h-[80%] md:h-[70%] bg-zinc-900 rounded-t-3xl border-t border-yellow-500/30 overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(234,179,8,0.1)]">
                <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center gap-2 text-yellow-500">
                    <Bot size={20} />
                    <span className="font-bold">المساعد الذكي للكابا</span>
                  </div>
                  <button onClick={() => setShowAi(false)} className="text-zinc-400 hover:text-white bg-zinc-800 rounded-full p-1" aria-label="إغلاق المساعد">
                    <X size={20} />
                  </button>
                </div>
                <Suspense fallback={<ScreenFallback />}>
                  <AiAssistant />
                </Suspense>
              </div>
            </div>
          )}

          {/* FAB for AI */}
          {!showAi && (
            <button
              onClick={() => setShowAi(true)}
              className="absolute bottom-20 left-4 md:bottom-6 z-30 w-12 h-12 bg-yellow-500 text-black rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center hover:scale-105 transition-transform"
              aria-label="فتح المساعد الذكي"
            >
              <Bot size={24} />
            </button>
          )}

          {/* Bottom Navigation — mobile uniquement. */}
          <div className="absolute bottom-0 w-full z-20 md:hidden">
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </div>
    </div>
  );
}
