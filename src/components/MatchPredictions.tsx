// توقع النتيجة — jeu de pronostics RÉEL (migration 014, /api/predictions).
// L'ancien composant affichait un placeholder « النظام قيد التطوير » depuis
// l'origine alors que le README promettait « لعبة التوقعات ».
// Pronostics modifiables jusqu'au coup d'envoi, 50 points par score exact,
// classement top 10 + fiche personnelle.
import { useCallback, useEffect, useState } from 'react';
import { Target, Trophy, Info, Loader2 } from 'lucide-react';

interface UpcomingMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  date: string;
  time: string;
  myHome: number | null;
  myAway: number | null;
}

interface LeaderRow {
  displayName: string;
  predictions: number;
  correct: number;
  points: number;
}

interface Overview {
  pointsPerExactScore: number;
  upcoming: UpcomingMatch[];
  leaderboard: LeaderRow[];
  me: { rank: number | null; points: number; correct: number; predictions: number };
}

export default function MatchPredictions() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`predictions → ${res.status}`);
      const data = (await res.json()) as Overview;
      setOverview(data);
      // Brouillons pré-remplis avec les pronostics existants (modifiables
      // tant que le match est 'scheduled').
      setDrafts(Object.fromEntries(
        data.upcoming
          .filter((match) => match.myHome !== null && match.myAway !== null)
          .map((match) => [match.id, { home: String(match.myHome), away: String(match.myAway) }]),
      ));
    } catch (error) {
      console.error('[CABBA] predictions:', error);
      setOverview(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handlePredict = async (match: UpcomingMatch) => {
    const draft = drafts[match.id];
    const home = Number(draft?.home);
    const away = Number(draft?.away);
    if (!draft || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || home > 30 || away < 0 || away > 30) {
      setNotice('أدخل نتيجة صحيحة بين 0 و30 لكل فريق.');
      return;
    }
    setSavingId(match.id);
    try {
      const res = await fetch(`/api/predictions/${encodeURIComponent(match.id)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeScore: home, awayScore: away }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر تسجيل التوقع');
      setNotice('تم تسجيل توقعك! 🟡⚫');
      await load();
    } catch (error) {
      console.error('[CABBA] prediction:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر تسجيل التوقع');
    } finally {
      setSavingId(null);
    }
  };

  if (overview === null) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <Info size={32} className="text-yellow-500 mx-auto mb-3" />
          <h4 className="font-bold text-white mb-2">نظام التوقعات غير متاح حالياً</h4>
          <p className="text-sm text-zinc-400">تحقق من اتصالك أو حاول لاحقاً.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      {/* Fiche personnelle */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-around text-center">
        <div>
          <p className="text-xl font-black text-yellow-500">{overview.me.points}</p>
          <p className="text-[10px] text-zinc-400 font-bold">النقاط</p>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div>
          <p className="text-xl font-black text-white">{overview.me.correct}</p>
          <p className="text-[10px] text-zinc-400 font-bold">توقعات صحيحة</p>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div>
          <p className="text-xl font-black text-white">{overview.me.rank ?? '-'}</p>
          <p className="text-[10px] text-zinc-400 font-bold">الترتيب</p>
        </div>
      </div>

      {/* Pronostics */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>

        <div className="relative z-10 flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
            <Target size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">توقع النتيجة</h3>
            <p className="text-xs text-zinc-400">اربح {overview.pointsPerExactScore} نقطة للتوقع الصحيح</p>
          </div>
        </div>

        {notice && (
          <div role="status" aria-live="polite" className="relative z-10 mb-4 p-3 rounded-xl border text-xs font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-in fade-in duration-200">
            {notice}
          </div>
        )}

        {overview.upcoming.length === 0 ? (
          <div className="relative z-10 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 text-center">
            <Info size={32} className="text-zinc-500 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">لا توجد مباريات قادمة مفتوحة للتوقع حالياً.</p>
          </div>
        ) : (
          <div className="relative z-10 space-y-3">
            {overview.upcoming.map((match) => {
              const draft = drafts[match.id] ?? { home: '', away: '' };
              const alreadyPredicted = match.myHome !== null;
              return (
                <div key={match.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-zinc-400 font-bold">{match.competition}</span>
                    <span className="text-[10px] text-zinc-500" dir="ltr">{match.date} · {match.time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 text-sm font-bold text-white text-center leading-tight">{match.homeTeam}</span>
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        inputMode="numeric"
                        value={draft.home}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [match.id]: { ...draft, home: e.target.value } }))}
                        aria-label={`النتيجة المتوقعة لـ ${match.homeTeam}`}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-700 rounded-xl text-center text-white font-black text-lg outline-none focus:border-yellow-500"
                      />
                      <span className="text-zinc-500 font-black">-</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        inputMode="numeric"
                        value={draft.away}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [match.id]: { ...draft, away: e.target.value } }))}
                        aria-label={`النتيجة المتوقعة لـ ${match.awayTeam}`}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-700 rounded-xl text-center text-white font-black text-lg outline-none focus:border-yellow-500"
                      />
                    </div>
                    <span className="flex-1 text-sm font-bold text-white text-center leading-tight">{match.awayTeam}</span>
                  </div>
                  <button
                    onClick={() => void handlePredict(match)}
                    disabled={savingId === match.id || !draft.home || !draft.away}
                    className="w-full mt-3 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {savingId === match.id && <Loader2 size={14} className="animate-spin" />}
                    {alreadyPredicted ? 'تعديل التوقع' : 'توقع النتيجة'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
              <Trophy size={20} />
            </div>
            <h3 className="font-bold text-white text-md">لوحة الصدارة</h3>
          </div>
        </div>

        {overview.leaderboard.length === 0 ? (
          <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-500">لا توجد بيانات حالياً. كن أول من يسجل توقعات صحيحة!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {overview.leaderboard.map((row, index) => (
              <div
                key={`${row.displayName}-${index}`}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  index === 0
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-zinc-800/40 border-zinc-700/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                    index === 0 ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-300'
                  }`}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{row.displayName}</p>
                    <p className="text-[10px] text-zinc-500">{row.correct} توقع صحيح من {row.predictions}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-yellow-500">{row.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
