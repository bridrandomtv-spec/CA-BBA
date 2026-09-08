// Comparaison statistique — données RÉELLES (JSONB match_statistics,
// synchronisées depuis API-Football) via la vue consolidée
// /api/matches/:id/center.
// L'ancien composant déclarait `const data: any[] = []` : état vide permanent.
// Les deux barres portent les NOMS D'ÉQUIPES réels (aucune hypothèse sur le
// côté où joue CABBA n'est nécessaire ici).
import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { resolveFeaturedMatchId } from '../lib/featuredMatch';

interface MatchStatsVisualizationProps {
  /** Rencontre à afficher ; à défaut, la plus pertinente est résolue. */
  matchId?: string;
}

/** Traductions des types de statistiques API-Football ; l'ordre fixe celui du graphique. */
const STAT_LABELS: Array<[string, string]> = [
  ['Ball Possession', 'الاستحواذ'],
  ['Total Shots', 'مجموع التسديدات'],
  ['Shots on Goal', 'تسديدات على المرمى'],
  ['Shots off Goal', 'تسديدات خارج المرمى'],
  ['Blocked Shots', 'تسديدات محجوبة'],
  ['Corner Kicks', 'الركنيات'],
  ['Fouls', 'الأخطاء'],
  ['Offsides', 'التسلل'],
  ['Yellow Cards', 'البطاقات الصفراء'],
  ['Red Cards', 'البطاقات الحمراء'],
  ['Goalkeeper Saves', 'تصديات الحارس'],
  ['Total passes', 'مجموع التمريرات'],
  ['Passes accurate', 'التمريرات الدقيقة'],
  ['expected_goals', 'الأهداف المتوقعة (xG)'],
];

/** API-Football renvoie des nombres ou des chaînes ('58%', '12.3') : normalisation. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = parseFloat(value.replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

interface CenterPayload {
  match: {
    homeTeam: string;
    awayTeam: string;
    homeTeamApiId: number | null;
    awayTeamApiId: number | null;
  };
  statistics: Array<{ team_api_id: number; statistics: unknown }>;
}

export default function MatchStatsVisualization({ matchId }: MatchStatsVisualizationProps) {
  const [rows, setRows] = useState<Array<Record<string, string | number>>>([]);
  const [teamNames, setTeamNames] = useState<{ home: string; away: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const targetId = matchId ?? (await resolveFeaturedMatchId());
      if (!targetId) return;

      const res = await fetch(`/api/matches/${encodeURIComponent(targetId)}/center`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`center → ${res.status}`);
      const center = (await res.json()) as CenterPayload;

      const homeStats = center.statistics.find((entry) => entry.team_api_id === center.match.homeTeamApiId);
      const awayStats = center.statistics.find((entry) => entry.team_api_id === center.match.awayTeamApiId);
      if (!homeStats || !awayStats) return;

      const toValueMap = (raw: unknown): Map<string, number> => {
        const map = new Map<string, number>();
        if (Array.isArray(raw)) {
          for (const entry of raw as Array<{ type?: unknown; value?: unknown }>) {
            if (typeof entry?.type === 'string') map.set(entry.type, toNumber(entry.value));
          }
        }
        return map;
      };
      const homeMap = toValueMap(homeStats.statistics);
      const awayMap = toValueMap(awayStats.statistics);

      // Noms d'équipes comme clés de données : deux équipes homonymes
      // casseraient le graphique, d'où le suffixe de sécurité.
      const home = center.match.homeTeam || 'الفريق المضيف';
      const away = center.match.awayTeam === home
        ? `${center.match.awayTeam} (2)`
        : (center.match.awayTeam || 'الفريق الضيف');

      const built: Array<Record<string, string | number>> = [];
      for (const [type, label] of STAT_LABELS) {
        if (!homeMap.has(type) && !awayMap.has(type)) continue;
        built.push({ name: label, [home]: homeMap.get(type) ?? 0, [away]: awayMap.get(type) ?? 0 });
      }

      setRows(built);
      setTeamNames({ home, away });
    } catch (error) {
      console.error('[CABBA] match statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm w-full h-[300px] flex items-center justify-center">
        <span className="text-zinc-500 font-bold text-sm animate-pulse">جاري تحميل الإحصائيات...</span>
      </div>
    );
  }

  if (rows.length === 0 || !teamNames) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm w-full h-[300px] flex items-center justify-center">
        <span className="text-zinc-500 font-bold text-sm">البيانات غير متوفرة حالياً</span>
      </div>
    );
  }

  // La hauteur suit le nombre de statistiques : un graphique vertical de 14
  // lignes dans 300 px fixes était illisible.
  const chartHeight = Math.max(300, rows.length * 34 + 60);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm w-full">
      <h3 className="font-bold text-white text-sm mb-4 text-center">مقارنة الإحصائيات (رسم بياني)</h3>
      <div style={{ height: chartHeight }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis type="number" stroke="#a1a1aa" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={130} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '0.5rem', color: '#fff' }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              cursor={{ fill: '#27272a' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey={teamNames.home} fill="#eab308" radius={[0, 4, 4, 0]} />
            <Bar dataKey={teamNames.away} fill="#52525b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
