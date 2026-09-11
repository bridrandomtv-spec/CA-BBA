// Accueil — données RÉELLES : prochain match (/api/matches), actualités
// (/api/news) et classement (/api/football/team-summary). L'ancien composant
// affichait « البيانات غير متوفرة » en dur alors que les routes PostgreSQL
// existent. Les trois chargements sont indépendants (Promise.allSettled).
import SponsorsStrip from './SponsorsStrip';
import { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Calendar, ChevronLeft, History, MapPin , Landmark} from 'lucide-react';
import { Match, NewsItem } from '../types';
import { fetchTeamSummary, EMPTY_TEAM_SUMMARY, type TeamSummary } from '../lib/teamSummary';
import TeamStats from './TeamStats';
import ClubHistory from './ClubHistory';
import WeatherWidget from './WeatherWidget';
import FanPolls from './FanPolls';
import FanGallery from './FanGallery';

interface HomeProps {
  onNavigate?: (tab: any) => void;
}

/**
 * Les consommateurs de /api/matches ne s'accordent pas sur la forme de la
 * réponse : MatchCalendar lit un tableau brut, Profile lit `data.matches`.
 * Plutôt que de choisir, on accepte les deux — un seul endroit pour le faire.
 */
function toMatchArray(payload: unknown): Match[] {
  if (Array.isArray(payload)) return payload as Match[];
  if (payload && typeof payload === 'object') {
    const nested = (payload as { matches?: unknown }).matches;
    if (Array.isArray(nested)) return nested as Match[];
  }
  return [];
}

function toNewsArray(payload: unknown): NewsItem[] {
  if (Array.isArray(payload)) return payload as NewsItem[];
  if (payload && typeof payload === 'object') {
    const nested = (payload as { news?: unknown }).news;
    if (Array.isArray(nested)) return nested as NewsItem[];
  }
  return [];
}

/**
 * Le type Match transporte `date` et `time` séparés. Une chaîne non
 * interprétable renvoie MAX_SAFE_INTEGER : le match retombe en fin de tri
 * plutôt que de produire un `NaN` qui corromprait la comparaison.
 */
function matchTimestamp(match: Match): number {
  const parsed = new Date(`${match.date}T${match.time}`);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

interface SupportCampaign {
  id: string;
  title: string;
  goal: number;
  raised: number;
  donationsCount: number;
  bankInfo: string | null;
  active: boolean;
}

export default function Home({ onNavigate }: HomeProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary>(EMPTY_TEAM_SUMMARY);
  const [campaign, setCampaign] = useState<SupportCampaign | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Les trois requêtes sont indépendantes : un échec de /api/news ne doit
      // pas priver l'écran du prochain match, et inversement.
      const [matchesResult, newsResult, summaryResult, campaignResult] = await Promise.allSettled([
        fetch('/api/matches', { credentials: 'same-origin' }).then(async (res) => {
          if (!res.ok) throw new Error(`/api/matches → ${res.status}`);
          return toMatchArray(await res.json());
        }),
        fetch('/api/news', { credentials: 'same-origin' }).then(async (res) => {
          if (!res.ok) throw new Error(`/api/news → ${res.status}`);
          return toNewsArray(await res.json());
        }),
        fetchTeamSummary(),
        // Campagne du صندوق : null si aucune campagne active (le bloc
        // disparaît alors entièrement de l'accueil).
        fetch('/api/support/campaign', { credentials: 'same-origin' })
          .then(async (res) => (res.ok ? res.json() : null))
          .then((data) => (data && data.campaign ? data.campaign : null)),
      ]);

      if (cancelled) return;

      if (matchesResult.status === 'fulfilled') {
        setMatches(matchesResult.value);
      } else {
        console.error('[CABBA] home / matches :', matchesResult.reason?.message ?? matchesResult.reason);
      }

      if (newsResult.status === 'fulfilled') {
        setNews(newsResult.value);
      } else {
        console.error('[CABBA] home / news :', newsResult.reason?.message ?? newsResult.reason);
      }

      if (summaryResult.status === 'fulfilled') {
        setTeamSummary(summaryResult.value);
      }

      if (campaignResult.status === 'fulfilled') {
        setCampaign(campaignResult.value as SupportCampaign | null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Match en direct prioritaire ; sinon le prochain match programmé. La marge
  // de 2 h évite qu'une rencontre dont le statut n'a pas encore été
  // synchronisé par le worker football disparaisse juste après le coup d'envoi.
  const liveMatch = matches.find((match) => match.status === 'live') ?? null;
  const upcomingMatch = matches
    .filter((match) => match.status === 'scheduled' && matchTimestamp(match) >= Date.now() - 2 * 60 * 60 * 1000)
    .sort((a, b) => matchTimestamp(a) - matchTimestamp(b))[0] ?? null;
  const featuredMatch = liveMatch ?? upcomingMatch;

  if (showHistory) {
    return <ClubHistory onBack={() => setShowHistory(false)} />;
  }

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">

      {/* Welcome Banner / Next Match Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
        <div className="p-5 relative z-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded font-bold uppercase tracking-wider">
              {featuredMatch?.status === 'live' ? 'المباراة المباشرة' : 'المباراة القادمة'}
            </span>
          </div>

          {featuredMatch ? (
            <div className="text-center mb-4">
              <p className="text-[10px] text-zinc-400 font-semibold mb-3">{featuredMatch.competition}</p>
              <div className="flex items-center justify-center gap-3">
                <span className="font-black text-white text-lg leading-tight">{featuredMatch.homeTeam}</span>
                <span
                  className={`text-sm font-black px-3 py-1.5 rounded-lg flex-none ${
                    featuredMatch.status === 'live'
                      ? 'bg-red-500/20 text-red-400 animate-pulse'
                      : 'bg-zinc-800 text-yellow-500 border border-yellow-500/20'
                  }`}
                >
                  {featuredMatch.status === 'live'
                    ? `${featuredMatch.homeScore} - ${featuredMatch.awayScore}`
                    : 'ضد'}
                </span>
                <span className="font-black text-white text-lg leading-tight">{featuredMatch.awayTeam}</span>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-zinc-500" />
                  {featuredMatch.date} — {featuredMatch.time}
                </span>
                {featuredMatch.stadium && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-zinc-500" />
                    {featuredMatch.stadium}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-500 py-6 text-sm font-bold border border-zinc-800 border-dashed rounded-xl mb-4">
              البيانات غير متوفرة
            </div>
          )}

          <button onClick={() => onNavigate && onNavigate('match')} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
            مركز المباراة
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>

      {/* Quick Stats — classement synchronisé depuis API-Football */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center hover:border-yellow-500/30 transition-colors">
          <Trophy size={24} className="text-zinc-600 mb-2" />
          <span className="text-lg font-black text-white block">
            {teamSummary.standings ? teamSummary.standings.rank : '-'}
          </span>
          <span className="text-xs text-zinc-400 font-medium">الترتيب الحالي</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center hover:border-yellow-500/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-zinc-800 text-yellow-500 flex items-center justify-center mb-2 font-bold">
            {teamSummary.standings ? teamSummary.standings.rank : '-'}
          </div>
          <span className="text-lg font-black text-white block">
            {teamSummary.standings ? teamSummary.standings.points : '-'}
          </span>
          <span className="text-xs text-zinc-400 font-medium">النقاط</span>
        </div>
      </div>

      <TeamStats />

      <WeatherWidget />

      <FanPolls />

      <FanGallery />

      {/* المتحف — accès à la mémoire du club */}
      <button onClick={() => onNavigate?.('museum')}
        className="w-full bg-zinc-900 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3 text-right hover:border-yellow-500/60 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
          <Landmark size={20} className="text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">متحف النادي</p>
          <p className="text-zinc-500 text-[10px]">بطولات، أساطير وأحداث منذ 1931</p>
        </div>
        <ChevronLeft size={16} className="text-zinc-600 flex-shrink-0" />
      </button>

      {/* History Navigation Card */}
      <div
        onClick={() => setShowHistory(true)}
        className="bg-zinc-900 border border-zinc-800 hover:border-yellow-500/50 rounded-2xl p-4 shadow-lg flex items-center justify-between cursor-pointer group transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-colors">
            <History size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">تاريخ النادي</h3>
            <p className="text-xs text-zinc-400">عراقة وأمجاد الجراد الأصفر</p>
          </div>
        </div>
        <ChevronLeft size={20} className="text-zinc-500 group-hover:text-white transition-colors" />
      </div>

      {/* صندوق دعم النادي — campagne réelle gérée depuis لوحة الإدارة.
          Aucune campagne active : le bloc disparaît entièrement (plus de
          boîte morte héritée du code d'origine). */}
      {campaign && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-3 gap-2">
              <h3 className="font-bold text-lg text-white">صندوق دعم النادي</h3>
              <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded font-bold truncate max-w-[60%]">
                {campaign.title}
              </span>
            </div>

            {campaign.goal > 0 && (
              <>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>{campaign.raised.toLocaleString('ar-DZ')} د.ج مجموعة</span>
                  <span>الهدف {campaign.goal.toLocaleString('ar-DZ')} د.ج</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-3" role="progressbar"
                  aria-valuenow={campaign.raised} aria-valuemin={0} aria-valuemax={campaign.goal}>
                  <div
                    className="h-full bg-gradient-to-l from-yellow-400 to-yellow-600 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))}%` }}
                  />
                </div>
              </>
            )}

            {campaign.bankInfo && (
              <p className="text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 whitespace-pre-line leading-relaxed">
                {campaign.bankInfo}
              </p>
            )}

            <p className="text-[10px] text-zinc-600 mt-2">
              {campaign.donationsCount.toLocaleString('ar-DZ')} عملية موثقة · تحديث من إدارة النادي
            </p>
          </div>
        </div>
      )}

      {/* شركاء النادي — sponsors actifs gérés depuis لوحة الإدارة */}
      <SponsorsStrip />

      {/* News Section — alimentée par /api/news (PostgreSQL) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-white">آخر الأخبار</h3>
        </div>

        <div className="space-y-3">
          {news.length > 0 ? news.map((item) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 hover:border-yellow-500/30 transition-colors rounded-xl p-4 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-lg bg-black flex-none flex items-center justify-center border border-zinc-800 overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-yellow-500/50 font-bold">C</div>
                )}
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-yellow-500 font-semibold tracking-wider mb-1 block">
                  أخبار النادي
                </span>
                <h4 className="font-bold text-sm text-white mb-1 line-clamp-1">{item.title}</h4>
                <p className="text-xs text-zinc-400 line-clamp-1">{item.content}</p>
                <span className="text-[10px] text-zinc-500 mt-2 block">{item.date}</span>
              </div>
            </div>
          )) : (
            <div className="text-center text-zinc-500 py-6 border border-zinc-800 border-dashed rounded-xl text-xs">
              لا توجد أخبار حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
