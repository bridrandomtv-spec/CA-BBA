// أداء الفريق — câblé sur /api/football/team-summary.
// L'ancien composant déclarait `const data: any[] = []` : graphique et
// compteurs restaient vides pour toujours. Forme (10 derniers matchs), buts
// marqués/reçus et courbe sont calculés sur données réelles, avec repli sur
// l'état vide si API-Football n'est pas configurée.
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Goal, Target } from 'lucide-react';
import { fetchTeamSummary, chronological, type TeamSummaryMatch } from '../lib/teamSummary';

const RESULT_STYLES: Record<string, string> = {
  W: 'bg-green-500/20 text-green-400 border-green-500/30',
  D: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
  L: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const RESULT_LABELS: Record<string, string> = { W: 'ف', D: 'ت', L: 'خ' };

export default function TeamStats() {
  const [lastMatches, setLastMatches] = useState<TeamSummaryMatch[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTeamSummary().then((summary) => {
      if (!cancelled) setLastMatches(summary.matches.slice(0, 10));
    });
    return () => { cancelled = true; };
  }, []);

  // null = chargement ; [] = synchronisé mais aucune donnée (état vide).
  const loading = lastMatches === null;
  const matches = lastMatches ?? [];

  const goalsScored = matches.reduce((sum, match) => sum + match.goalsFor, 0);
  const goalsConceded = matches.reduce((sum, match) => sum + match.goalsAgainst, 0);

  const chartData = chronological(matches).map((match) => ({
    match: match.date.slice(5), // 'MM-DD'
    butsMarques: match.goalsFor,
    butsEncaisses: match.goalsAgainst,
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg overflow-hidden relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <TrendingUp size={18} className="text-yellow-500" />
          أداء الفريق
        </h3>
        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded font-bold uppercase">
          آخر 10 مباريات
        </span>
      </div>

      {loading ? (
        <div className="text-center text-zinc-500 py-10 border border-zinc-800 border-dashed rounded-xl text-xs mb-4 animate-pulse">
          جاري تحميل الإحصائيات...
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center text-zinc-500 py-10 border border-zinc-800 border-dashed rounded-xl text-xs mb-4">
          إحصائيات الفريق غير متوفرة حالياً
        </div>
      ) : (
        <>
          {/* Forme récente : du plus ancien (à droite, RTL) au plus récent. */}
          <div className="flex items-center gap-1.5 mb-4" dir="rtl" aria-label="النتائج الأخيرة">
            {chronological(matches).map((match) => (
              <span
                key={match.id}
                title={`${match.date} — ${match.opponent} (${match.goalsFor}-${match.goalsAgainst})`}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-black ${RESULT_STYLES[match.result] ?? RESULT_STYLES.D}`}
              >
                {RESULT_LABELS[match.result] ?? 'ت'}
              </span>
            ))}
          </div>

          <div className="h-[180px] w-full mb-4" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="match" stroke="#71717a" fontSize={10} tickMargin={8} />
                <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" name="مسجلة" dataKey="butsMarques" stroke="#eab308" strokeWidth={2.5} dot={{ r: 3, fill: '#eab308' }} />
                <Line type="monotone" name="مستقبلة" dataKey="butsEncaisses" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center">
            <Goal size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">أهداف مسجلة</p>
            <p className="font-black text-white text-lg">{matches.length > 0 ? goalsScored : '-'}</p>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400">أهداف مستقبلة</p>
            <p className="font-black text-white text-lg">{matches.length > 0 ? goalsConceded : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
