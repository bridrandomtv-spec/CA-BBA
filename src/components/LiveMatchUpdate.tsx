import { useState, useEffect } from 'react';
import { Clock, Activity, AlertCircle, Goal, Flag } from 'lucide-react';



interface Commentary {
  id: string;
  minute: number;
  text: string;
  type: 'neutral' | 'attack' | 'goal' | 'card' | 'corner' | 'foul';
  team?: 'home' | 'away';
  createdAt: number;
}

export default function LiveMatchUpdate({ matchId }: { matchId?: string }) {
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchUpdates = async () => {
      try {
        const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/updates`, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          setCommentaries(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching match updates:", error);
      } finally {
        setLoading(false);
      }
    };

    // Polling conscient de la visibilité : l'intervalle de 30 s tournait
    // onglet masqué — sur une PWA mobile, batterie et data consommées pour
    // un fil que personne ne regarde (le flux score/statistiques, lui, passe
    // déjà par SSE avec la même politique dans MatchCenter).
    const start = () => {
      if (interval) return;
      interval = setInterval(fetchUpdates, 30000);
      void fetchUpdates();
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start(); // fetch immédiat : rattrape les commentaires manqués.
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [matchId]);

  const getIcon = (type: Commentary['type']) => {
    switch (type) {
      case 'goal': return <Goal size={16} className="text-yellow-500" />;
      case 'card': return <div className="w-3 h-4 bg-yellow-500 rounded-sm"></div>;
      case 'corner': return <Flag size={16} className="text-zinc-400" />;
      case 'foul': return <AlertCircle size={16} className="text-red-400" />;
      case 'attack': return <Activity size={16} className="text-blue-400" />;
      default: return <Clock size={16} className="text-zinc-500" />;
    }
  };

  const getBorderColor = (team?: 'home' | 'away') => {
    if (team === 'home') return 'border-r-yellow-500';
    if (team === 'away') return 'border-r-zinc-500';
    return 'border-r-transparent';
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm animate-in fade-in flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/50 flex-shrink-0">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Activity size={16} className={commentaries.length > 0 ? "text-red-500 animate-pulse" : "text-zinc-500"} />
          تغطية المباراة
        </h3>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
        style={{ direction: 'rtl' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-zinc-500 text-sm">جاري التحميل...</span>
          </div>
        ) : commentaries.length > 0 ? (
          commentaries.map((item, i) => (
            <div 
              key={item.id} 
              className={`bg-zinc-800/30 p-3 rounded-lg border-r-4 ${getBorderColor(item.team)} transition-all duration-500`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 min-w-[40px] pt-1 shrink-0">
                  <span className="text-xs font-black text-white">{item.minute}'</span>
                  {getIcon(item.type)}
                </div>
                <p className={`text-sm leading-relaxed ${item.type === 'goal' ? 'font-bold text-yellow-500' : 'text-zinc-300'}`}>
                  {item.text}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <Activity size={32} className="text-zinc-700" />
            <p className="text-zinc-500 text-sm">لا توجد تغطية حية لهذه المباراة حالياً.</p>
          </div>
        )}
      </div>
    </div>
  );
}
