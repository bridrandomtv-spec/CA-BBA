// إحصائيات الموسم — données RÉELLES :
//  - vue d'ensemble et camembet : classement synchronisé (team-summary),
//    sinon calcul sur les 30 derniers matchs terminés ;
//  - buts par journée : mêmes matchs, ordre chronologique ;
//  - distribution des buts par tranche de 15 min : agrégat SQL serveur
//    (/api/football/goals-by-minute, pénaltys manqués et CSC exclus).
// L'ancien composant déclarait trois `const …Data: any[] = []` : des axes
// vides rendus en permanence, perçus comme un bug. Chaque section n'est
// désormais rendue que si ses données existent.
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { fetchTeamSummary, chronological, type TeamSummary } from '../lib/teamSummary';

const MINUTE_BUCKETS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90', '90+'];

export default function SeasonStats() {
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [goalsByMinute, setGoalsByMinute] = useState<Array<{ bucket: string; goals: number }>>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchTeamSummary().then((data) => {
      if (!cancelled) setSummary(data);
    });

    fetch('/api/football/goals-by-minute', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { goals: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.goals)) setGoalsByMinute(data.goals);
      })
      .catch((error) => console.error('[CABBA] goals by minute:', error));

    return () => { cancelled = true; };
  }, []);

  const matches = summary?.matches ?? [];
  const standing = summary?.standings ?? null;

  // Vue d'ensemble : le classement fait foi s'il existe, sinon les 30 matchs.
  const goalsFor = standing?.goalsFor ?? matches.reduce((sum, match) => sum + match.goalsFor, 0);
  const goalsAgainst = standing?.goalsAgainst ?? matches.reduce((sum, match) => sum + match.goalsAgainst, 0);
  const cleanSheets = matches.filter((match) => match.goalsAgainst === 0).length;

  // Camembet des résultats : classement prioritaire, rencontres sinon.
  const resultsData = (standing
    ? [
        { name: 'انتصارات', value: standing.win, color: '#eab308' },
        { name: 'تعادلات', value: standing.draw, color: '#52525b' },
        { name: 'هزائم', value: standing.lose, color: '#ef4444' },
      ]
    : [
        { name: 'انتصارات', value: matches.filter((match) => match.result === 'W').length, color: '#eab308' },
        { name: 'تعادلات', value: matches.filter((match) => match.result === 'D').length, color: '#52525b' },
        { name: 'هزائم', value: matches.filter((match) => match.result === 'L').length, color: '#ef4444' },
      ]
  ).filter((entry) => entry.value > 0);

  const goalsByMatchData = chronological(matches).map((match) => ({
    match: match.date.slice(5),
    goalsScored: match.goalsFor,
    goalsConceded: match.goalsAgainst,
  }));

  // Tranches dans l'ordre chronologique, zéros inclus (un histogramme troué
  // fausserait la lecture).
  const goalsByMinuteData = MINUTE_BUCKETS.map((bucket) => ({
    time: bucket,
    goals: goalsByMinute.find((row) => row.bucket === bucket)?.goals ?? 0,
  }));
  const hasMinuteData = goalsByMinuteData.some((row) => row.goals > 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-2xl font-black text-white mb-1">{summary === null ? '…' : goalsFor}</span>
          <span className="text-[10px] text-zinc-400 font-bold text-center">أهداف مسجلة</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-2xl font-black text-white mb-1">{summary === null ? '…' : goalsAgainst}</span>
          <span className="text-[10px] text-zinc-400 font-bold text-center">أهداف مستقبلة</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <span className="text-2xl font-black text-white mb-1">{summary === null ? '…' : cleanSheets}</span>
          <span className="text-[10px] text-zinc-400 font-bold text-center">شباك نظيفة</span>
        </div>
      </div>

      {/* Results Pie Chart */}
      {resultsData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
            <PieChartIcon size={16} className="text-yellow-500" />
            نتائج الموسم
          </h3>
          <div className="h-[200px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={resultsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {resultsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', textAlign: 'right' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Goals Over Time (Line Chart) */}
      {goalsByMatchData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-yellow-500" />
            الأهداف حسب الجولة
          </h3>
          <div className="h-[200px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={goalsByMatchData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="match" stroke="#71717a" fontSize={10} tickMargin={10} />
                <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', textAlign: 'right' }}
                  labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" name="مسجلة" dataKey="goalsScored" stroke="#eab308" strokeWidth={3} dot={{ r: 4, fill: '#eab308' }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="مستقبلة" dataKey="goalsConceded" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Goal Distribution (Bar Chart) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-yellow-500" />
          توزيع الأهداف في الدقائق
        </h3>
        {hasMinuteData ? (
          <div className="h-[200px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goalsByMinuteData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickMargin={10} />
                <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#27272a' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#eab308', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar name="الأهداف" dataKey="goals" fill="#eab308" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-zinc-500 py-8 border border-zinc-800 border-dashed rounded-xl text-xs">
            توزيع الأهداف حسب الدقائق سيتوفر مع مزامنة أحداث المباريات
          </div>
        )}
      </div>
    </div>
  );
}
