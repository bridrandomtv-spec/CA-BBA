// Événements du match en direct — données RÉELLES (match_events synchronisés
// depuis API-Football via la vue consolidée /api/matches/:id/center).
//
// L'ancienne version servait un fil FIGÉ et INVENTÉ (but de « ياسين » à la
// 65e, remplacements nommés) à tous les visiteurs, quel que soit le match :
// un supporter pouvait lire un but qui n'existait pas.
import { useCallback, useEffect, useState } from 'react';
import { Goal, AlertCircle, Repeat, Monitor, Clock } from 'lucide-react';
import { resolveFeaturedMatchId } from '../lib/featuredMatch';

interface CenterEvent {
  minute: number | null;
  extra_minute: number | null;
  type: string | null;
  detail: string | null;
  comments: string | null;
  team_api_id: number | null;
  player_name: string | null;
  assist_player_name: string | null;
}

interface CenterMatch {
  homeTeam: string;
  awayTeam: string;
  homeTeamApiId: number | null;
  awayTeamApiId: number | null;
}

type EventKind = 'goal' | 'goal-against' | 'miss' | 'yellow' | 'red' | 'sub' | 'var' | 'info';

interface DisplayEvent {
  key: string;
  minuteLabel: string;
  kind: EventKind;
  text: string;
  side: 'home' | 'away' | 'info';
}

function buildEvent(event: CenterEvent, match: CenterMatch, index: number): DisplayEvent {
  const minuteLabel = `${event.minute ?? '?'}'${event.extra_minute ? `+${event.extra_minute}` : ''}`;
  const player = event.player_name ? ` ${event.player_name}` : '';
  const side: DisplayEvent['side'] =
    event.team_api_id === match.homeTeamApiId ? 'home'
      : event.team_api_id === match.awayTeamApiId ? 'away'
        : 'info';

  let kind: EventKind = 'info';
  let text = event.comments || event.detail || 'حدث في المباراة';

  if (event.type === 'Goal') {
    if (event.detail === 'Missed Penalty') {
      kind = 'miss';
      text = `ضربة جزاء ضائعة${player}`;
    } else if (event.detail === 'Own Goal') {
      kind = 'goal-against';
      text = `هدف عكسي${player}`;
    } else {
      kind = 'goal';
      const assist = event.assist_player_name ? ` — صناعة: ${event.assist_player_name}` : '';
      const penalty = event.detail === 'Penalty' ? ' (ضربة جزاء)' : '';
      text = `جوووول!${player}${penalty}${assist}`;
    }
  } else if (event.type === 'Card') {
    const red = /red/i.test(event.detail ?? '');
    kind = red ? 'red' : 'yellow';
    text = `${red ? 'بطاقة حمراء' : 'بطاقة صفراء'}${player}`;
  } else if (event.type === 'subst') {
    kind = 'sub';
    // Convention API-Football : player = entrant, assist = sortant.
    text = `تبديل: دخول ${event.player_name ?? '?'} وخروج ${event.assist_player_name ?? '?'}`;
  } else if (event.type === 'Var') {
    kind = 'var';
    text = `تقنية الفيديو: ${event.comments ?? event.detail ?? ''}`;
  }

  return { key: `${index}-${event.minute}-${event.type}-${event.player_name ?? ''}`, minuteLabel, kind, text, side };
}

const KIND_ICON: Record<EventKind, React.ReactNode> = {
  goal: <Goal size={16} className="text-yellow-500" />,
  'goal-against': <Goal size={16} className="text-red-400" />,
  miss: <AlertCircle size={16} className="text-red-400" />,
  yellow: <div className="w-3 h-4 bg-yellow-500 rounded-sm" />,
  red: <div className="w-3 h-4 bg-red-500 rounded-sm" />,
  sub: <Repeat size={16} className="text-blue-400" />,
  var: <Monitor size={16} className="text-zinc-400" />,
  info: <Clock size={16} className="text-zinc-500" />,
};

export default function InGameNotifications({ matchId }: { matchId?: string }) {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const resolvedId = matchId ?? (await resolveFeaturedMatchId());
      if (!resolvedId) return;
      const res = await fetch(`/api/matches/${encodeURIComponent(resolvedId)}/center`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`center → ${res.status}`);
      const data = await res.json();
      const match = data.match as CenterMatch;
      const rows = Array.isArray(data.events) ? (data.events as CenterEvent[]) : [];
      // /center renvoie les événements en ordre chronologique ; le fil
      // s'affiche du plus récent au plus ancien.
      setEvents([...rows].reverse().map((event, index) => buildEvent(event, match, index)));
    } catch (error) {
      console.error('[CABBA] in-game events:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-right-4">
      <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
        <AlertCircle size={16} className="text-yellow-500" />
        أحداث المباراة
      </h3>

      {loading ? (
        <div className="py-8 flex justify-center">
          <Clock size={20} className="animate-pulse text-zinc-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center text-zinc-500 py-8 border border-zinc-800 border-dashed rounded-xl text-xs">
          لا توجد أحداث موثقة لهذه المباراة حالياً.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.key}
              className={`flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40 border-r-4 ${
                event.side === 'home' ? 'border-r-yellow-500'
                  : event.side === 'away' ? 'border-r-zinc-500'
                    : 'border-r-transparent'
              }`}
            >
              <span className="text-xs font-black text-white min-w-[44px] pt-0.5" dir="ltr">
                {event.minuteLabel}
              </span>
              <span className="pt-0.5 shrink-0">{KIND_ICON[event.kind]}</span>
              <p className={`text-sm leading-relaxed ${event.kind === 'goal' ? 'font-bold text-yellow-500' : 'text-zinc-300'}`}>
                {event.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
