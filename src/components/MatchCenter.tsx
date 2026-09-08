import { useEffect, useMemo, useState, useRef} from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Goal,
  MapPin,
  RefreshCw,
  Shield,
  Square,
  Users,
  X,
} from 'lucide-react';
import { Match } from '../types';

type MatchEvent = {
  id: string;
  minute: number | null;
  extra_minute: number | null;
  type: string | null;
  detail: string | null;
  comments: string | null;
  team_api_id: number | null;
  player_api_id: number | null;
  player_name: string | null;
  assist_player_name: string | null;
  created_at: string;
};

type Lineup = {
  id: string;
  team_api_id: number;
  player_api_id: number;
  player_name: string | null;
  number: number | null;
  position: string | null;
  grid: string | null;
  starter: boolean;
};

type MatchStatistic = {
  id: string;
  team_api_id: number;
  statistics: Array<{ type?: string; value?: string | number | null }>;
  updated_at: string;
};

type CenterSnapshot = {
  match: Match & {
    homeTeamApiId?: number | null;
    awayTeamApiId?: number | null;
    homeLogoUrl?: string | null;
    awayLogoUrl?: string | null;
    apiLastSyncedAt?: string | null;
  };
  events: MatchEvent[];
  lineups: Lineup[];
  statistics: MatchStatistic[];
};

const eventLabel = (event: MatchEvent) => {
  const type = event.type?.toLowerCase();
  const detail = event.detail?.toLowerCase();
  if (type === 'goal') return detail?.includes('missed') ? 'فرصة ضائعة' : 'هدف';
  if (type === 'card') return detail?.includes('red') ? 'بطاقة حمراء' : 'بطاقة صفراء';
  if (type === 'subst') return 'تبديل';
  if (type === 'var') return 'VAR';
  if (type === 'foul') return 'خطأ';
  if (type === 'corner') return 'ركنية';
  return event.detail || event.type || 'حدث';
};

const eventIcon = (event: MatchEvent) => {
  const type = event.type?.toLowerCase();
  const detail = event.detail?.toLowerCase();
  if (type === 'goal') return <Goal size={16} className="text-yellow-400" />;
  if (type === 'card') return <Square size={15} className={detail?.includes('red') ? 'fill-red-500 text-red-500' : 'fill-yellow-400 text-yellow-400'} />;
  if (type === 'subst') return <RefreshCw size={15} className="text-blue-400" />;
  if (type === 'var') return <AlertTriangle size={15} className="text-purple-400" />;
  return <Activity size={15} className="text-zinc-500" />;
};

const formatMinute = (minute: number | null, extra: number | null) => {
  if (minute == null) return '—';
  return `${minute}${extra ? `+${extra}` : ''}'`;
};

const statValue = (stats: MatchStatistic[], teamId: number, type: string) => {
  const row = stats.find((item) => item.team_api_id === teamId);
  const value = row?.statistics?.find((item) => item.type?.toLowerCase() === type.toLowerCase())?.value;
  return value == null ? '—' : String(value);
};

export default function MatchCenter() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'results'>('upcoming');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState<CenterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedMatch = useMemo(() => matches.find((m) => m.id === selectedId) ?? null, [matches, selectedId]);
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled' || m.status === 'live');
  const results = matches.filter((m) => m.status === 'finished' || m.status === 'postponed' || m.status === 'cancelled');

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error('تعذر تحميل المباريات');
      const data = await res.json();
      setMatches(data);
    } catch (error) {
      console.error('[CABBA] matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCenter = async (id: string, showLoader = true) => {
    if (showLoader) setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/matches/${id}/center`, { cache: 'no-store' });
      if (!res.ok) throw new Error('تعذر تحميل تفاصيل المباراة');
      setCenter(await res.json());
    } catch (error) {
      console.error('[CABBA] match center:', error);
      setDetailError('تعذر تحميل تفاصيل المباراة حالياً.');
    } finally {
      if (showLoader) setDetailLoading(false);
    }
  };

  useEffect(() => { void fetchMatches(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    void fetchCenter(selectedId);
  }, [selectedId]);

  // ---- Correctifs SSE (audit) ----
  // 1. ORAGE DE RECONNEXIONS : les deps incluaient `selectedId` ET la clé de
  //    TOUS les matchs : chaque sélection d'un match — et chaque tick de
  //    score — fermait et rouvrait TOUS les flux EventSource. La clé ne porte
  //    plus que sur l'ensemble trié des ids des matchs live, et selectedId
  //    passe par une ref.
  // 2. ÉCHECS NON BORNÉS : EventSource se reconnecte seul, mais en boucle
  //    infinie si le serveur échoue durablement. Plafond : 5 échecs
  //    consécutifs → fermeture, puis UNE tentative retardée de 30 s.
  // 3. ARRIÈRE-PLAN : PWA mobile = batterie/data. Flux fermés onglet masqué,
  //    rouverts au retour — le serveur renvoie un event 'initial' à chaque
  //    ouverture, les scores se resynchronisent sans polling.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const liveStreamKey = useMemo(
    () =>
      matches
        .filter((m) => m.status === 'live' && m.apiFixtureId)
        .map((m) => m.id)
        .sort()
        .join('|'),
    [matches],
  );

  // A single SSE connection per live fixture. EventSource reconnects by itself;
  // there is deliberately no browser polling.
  useEffect(() => {
    const liveIds = liveStreamKey ? liveStreamKey.split('|') : [];
    if (liveIds.length === 0) return;

    let disposed = false;
    const sources = new Map<string, EventSource>();
    const failures = new Map<string, number>();
    const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const MAX_CONSECUTIVE_FAILURES = 5;
    const RETRY_DELAY_MS = 30_000;

    const closeStream = (matchId: string) => {
      sources.get(matchId)?.close();
      sources.delete(matchId);
    };

    const openStream = (matchId: string) => {
      if (disposed || sources.has(matchId)) return;

      const source = new EventSource(`/api/matches/${encodeURIComponent(matchId)}/stream`);
      sources.set(matchId, source);

      source.addEventListener('open', () => failures.set(matchId, 0));

      source.addEventListener('match', (raw) => {
        failures.set(matchId, 0);
        try {
          const payload = JSON.parse((raw as MessageEvent).data) as { match: any; reason: string };
          const data = payload.match;
          setMatches((current) => current.map((item) => item.id === matchId ? {
            ...item,
            homeScore: Number(data.home_score ?? item.homeScore),
            awayScore: Number(data.away_score ?? item.awayScore),
            status: data.status ?? item.status,
            elapsedMinute: data.elapsed_minute ?? null,
            extraMinute: data.extra_minute ?? null,
            apiStatus: data.api_status ?? null,
          } : item));
          // selectedId via ref : sélectionner un match ne recrée plus les flux.
          if (selectedIdRef.current === matchId && payload.reason !== 'initial') {
            void fetchCenter(matchId, false);
          }
        } catch (error) {
          console.error('[CABBA] invalid SSE payload:', error);
        }
      });

      source.addEventListener('error', () => {
        const count = (failures.get(matchId) ?? 0) + 1;
        failures.set(matchId, count);
        if (count < MAX_CONSECUTIVE_FAILURES) return; // EventSource se reconnecte seul.

        closeStream(matchId);
        failures.set(matchId, 0);
        const timer = setTimeout(() => {
          retryTimers.delete(matchId);
          if (!disposed && !document.hidden) openStream(matchId);
        }, RETRY_DELAY_MS);
        retryTimers.set(matchId, timer);
      });
    };

    const openAll = () => {
      if (!document.hidden) liveIds.forEach(openStream);
    };
    const closeAll = () => liveIds.forEach(closeStream);

    const handleVisibility = () => {
      if (document.hidden) closeAll();
      else openAll();
    };

    openAll();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      retryTimers.forEach((timer) => clearTimeout(timer));
      retryTimers.clear();
      closeAll();
    };
  }, [liveStreamKey]);

  const openMatch = (match: Match) => {
    setSelectedId(match.id);
    setActiveTab(match.status === 'finished' ? 'results' : 'upcoming');
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-bold text-white text-xl flex items-center gap-2">
            <Activity className="text-yellow-500" /> مركز المباريات
          </h2>
          <p className="text-xs text-zinc-400 mt-1">النتيجة والأحداث والإحصائيات من قاعدة بيانات CABBA في الزمن الحقيقي</p>
        </div>
        <button onClick={() => void fetchMatches()} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white" title="تحديث">
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 flex gap-1 relative z-10 overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab('upcoming')} className={`flex-1 whitespace-nowrap py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'upcoming' ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
          المباريات القادمة {upcomingMatches.length ? `(${upcomingMatches.length})` : ''}
        </button>
        <button onClick={() => setActiveTab('results')} className={`flex-1 whitespace-nowrap py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'results' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
          النتائج السابقة {results.length ? `(${results.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-500 text-sm">جاري تحميل المباريات...</div>
      ) : (
        <div className="space-y-3">
          {(activeTab === 'upcoming' ? upcomingMatches : results).map((match) => (
            <button key={match.id} onClick={() => openMatch(match)} className="w-full text-right bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-zinc-800 shadow-lg relative overflow-hidden hover:border-yellow-500/30 transition-colors">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2 text-sm font-bold text-white"><Calendar size={16} className="text-yellow-500" /> {match.date}</div>
                {match.status === 'live' ? (
                  <div className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20"><Activity size={14} className="animate-pulse" /> مباشر{match.elapsedMinute ? ` · ${match.elapsedMinute}'` : ''}</div>
                ) : match.status === 'finished' ? (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold"><CheckCircle2 size={14} /> انتهت</div>
                ) : <div className="flex items-center gap-2 text-sm font-bold text-white"><Clock3 size={16} className="text-yellow-500" /> {match.time}</div>}
              </div>
              <div className="flex justify-between items-center relative z-10 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800/50">
                <TeamBadge name={match.homeTeam} logo={(match as any).homeLogoUrl} />
                <div className="w-1/3 flex flex-col items-center justify-center">
                  {match.status === 'live' || match.status === 'finished' ? (
                    <div className="flex items-center gap-3 text-3xl font-black text-white"><span>{match.homeScore}</span><span className="text-zinc-600">-</span><span>{match.awayScore}</span></div>
                  ) : <div className="bg-black/50 px-4 py-2 rounded-xl border border-yellow-500/30 text-yellow-500 font-bold tracking-widest">VS</div>}
                </div>
                <TeamBadge name={match.awayTeam} logo={(match as any).awayLogoUrl} muted />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 relative z-10">
                <span className="flex items-center gap-2"><MapPin size={14} /> {match.stadium}</span>
                <span className="font-bold text-zinc-400">{match.competition}</span>
              </div>
            </button>
          ))}
          {(activeTab === 'upcoming' ? upcomingMatches : results).length === 0 && <p className="text-center text-zinc-500 text-sm mt-10">لا توجد مباريات حالياً</p>}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" onClick={() => setSelectedId(null)}>
          <div className="max-w-3xl mx-auto bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold"><Activity size={18} className={selectedMatch?.status === 'live' ? 'text-red-500 animate-pulse' : 'text-yellow-500'} /> تفاصيل المباراة</div>
              <button onClick={() => setSelectedId(null)} className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            {detailLoading && !center ? <div className="p-12 text-center text-zinc-500">جاري تحميل تفاصيل المباراة...</div> : detailError && !center ? <div className="p-12 text-center text-red-400">{detailError}</div> : center ? <MatchDetail center={center} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamBadge({ name, logo, muted = false }: { name: string; logo?: string | null; muted?: boolean }) {
  return <div className="text-center w-1/3">
    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center p-1 shadow-lg mb-2 ${muted ? 'bg-zinc-800 border-2 border-zinc-700' : 'bg-gradient-to-br from-yellow-400 to-yellow-600'}`}>
      {logo ? <img src={logo} alt="" className="w-full h-full object-contain rounded-full bg-zinc-950" /> : <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center font-bold text-xl text-yellow-500">{name.charAt(0)}</div>}
    </div>
    <h4 className={`font-bold text-sm ${muted ? 'text-zinc-400' : 'text-white'}`}>{name}</h4>
  </div>;
}

function MatchDetail({ center }: { center: CenterSnapshot }) {
  const { match, events, lineups, statistics } = center;
  const homeId = match.homeTeamApiId ?? null;
  const awayId = match.awayTeamApiId ?? null;
  const homeLineup = homeId ? lineups.filter((p) => p.team_api_id === homeId) : [];
  const awayLineup = awayId ? lineups.filter((p) => p.team_api_id === awayId) : [];
  const statRows = [
    'Ball Possession', 'Total Shots', 'Shots on Goal', 'Corner Kicks', 'Fouls', 'Yellow Cards', 'Red Cards',
  ];

  return <div className="p-4 space-y-5">
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-5">
      <div className="flex justify-center mb-4">
        {match.status === 'live' ? <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold animate-pulse">مباشر {match.elapsedMinute ? `· ${match.elapsedMinute}'` : ''}</span> : <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold">{match.status === 'finished' ? 'انتهت المباراة' : 'مباراة'}</span>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <TeamBadge name={match.homeTeam} logo={match.homeLogoUrl} />
        <div className="text-center"><div className="text-4xl font-black text-white">{match.homeScore} - {match.awayScore}</div><div className="text-[11px] text-zinc-500 mt-2">{match.competition}</div></div>
        <TeamBadge name={match.awayTeam} logo={match.awayLogoUrl} muted />
      </div>
      <div className="mt-5 flex items-center justify-center gap-4 text-xs text-zinc-500"><span className="flex items-center gap-1"><Calendar size={13} /> {match.date}</span><span className="flex items-center gap-1"><MapPin size={13} /> {match.stadium}</span></div>
    </div>

    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <SectionTitle icon={<Activity size={16} />} title="أحداث المباراة" />
      {events.length ? <div className="space-y-2">{[...events].reverse().map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 p-3"><div className="min-w-[44px] text-center text-xs font-black text-white">{formatMinute(event.minute, event.extra_minute)}</div><div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">{eventIcon(event)}</div><div className="flex-1 min-w-0"><div className="text-xs font-bold text-zinc-200">{eventLabel(event)}</div><div className="text-xs text-zinc-400 truncate">{event.player_name || event.comments || '—'}{event.assist_player_name ? ` · تمريرة ${event.assist_player_name}` : ''}</div></div></div>)}</div> : <EmptyState text="لا توجد أحداث متاحة لهذه المباراة." />}
    </section>

    {statistics.length > 0 && homeId && awayId && <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <SectionTitle icon={<Activity size={16} />} title="إحصائيات المباراة" />
      <div className="space-y-3">{statRows.map((label) => <div key={label} className="grid grid-cols-[1fr_80px_1fr] items-center gap-2"><div className="text-sm font-bold text-white text-right">{statValue(statistics, homeId, label)}</div><div className="text-[10px] text-zinc-500 text-center">{label}</div><div className="text-sm font-bold text-zinc-400 text-left">{statValue(statistics, awayId, label)}</div></div>)}</div>
    </section>}

    {lineups.length > 0 && <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <SectionTitle icon={<Users size={16} />} title="التشكيلات" />
      <div className="grid md:grid-cols-2 gap-4"><LineupColumn title={match.homeTeam} players={homeLineup} /><LineupColumn title={match.awayTeam} players={awayLineup} muted /></div>
    </section>}

    <div className="text-center text-[10px] text-zinc-600">آخر مزامنة: {match.apiLastSyncedAt ? new Date(match.apiLastSyncedAt).toLocaleString('ar-DZ') : 'غير متوفر'}</div>
  </div>;
}

function LineupColumn({ title, players, muted = false }: { title: string; players: Lineup[]; muted?: boolean }) {
  return <div className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-3"><div className={`font-bold text-sm mb-3 ${muted ? 'text-zinc-400' : 'text-white'}`}>{title}</div><div className="space-y-1.5">{players.map((player) => <div key={player.id} className="flex items-center gap-2 text-xs"><span className="w-7 text-center text-zinc-500">{player.number ?? '—'}</span><span className={`w-2 h-2 rounded-full ${player.starter ? 'bg-emerald-500' : 'bg-zinc-700'}`} /><span className="font-medium text-zinc-300 truncate">{player.player_name || `#${player.player_api_id}`}</span><span className="mr-auto text-zinc-600">{player.position || ''}</span></div>)}{players.length === 0 && <div className="text-xs text-zinc-600">لا توجد تشكيلة متاحة.</div>}</div></div>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-4">{icon}<span>{title}</span></h3>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-zinc-600">{text}</div>;
}
