// استطلاعات الجماهير — sondages RÉELS (migration 016, /api/polls).
// L'écran n'avait AUCUN backend : état vide permanent. Désormais :
//  - ouvert + pas encore voté → options cliquables ;
//  - voté ou fermé → résultats en barres de pourcentage (mon choix marqué) ;
//  - vote modifiable tant que le sondage est ouvert (upsert serveur).
import { useCallback, useEffect, useState } from 'react';
import { BarChart2, Check, Loader2 } from 'lucide-react';

interface PollOption {
  id: string;
  label: string;
  votes: number;
  isMyVote: boolean;
}

interface Poll {
  id: string;
  question: string;
  status: 'open' | 'closed';
  createdAt: string;
  options: PollOption[];
}

export default function FanPolls() {
  const [polls, setPolls] = useState<Poll[] | null>(null); // null = chargement
  const [votingId, setVotingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/polls', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`polls → ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setPolls(Array.isArray(data?.polls) ? data.polls : []);
    } catch (error) {
      console.error('[CABBA] polls:', error);
      setPolls([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleVote = async (poll: Poll, optionId: string) => {
    if (poll.status !== 'open') return;
    setVotingId(optionId);
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(poll.id)}/vote`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر تسجيل التصويت');

      // Comptes renvoyés par le serveur : aucune agrégation locale.
      const freshCounts: Array<{ id: string; votes: number }> = Array.isArray(data.options) ? data.options : [];
      setPolls((prev) =>
        (prev ?? []).map((item) =>
          item.id === poll.id
            ? {
                ...item,
                options: item.options.map((option) => ({
                  ...option,
                  votes: freshCounts.find((row) => row.id === option.id)?.votes ?? option.votes,
                  isMyVote: option.id === optionId,
                })),
              }
            : item,
        ),
      );
    } catch (error) {
      console.error('[CABBA] poll vote:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر تسجيل التصويت');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2 mt-4">
        <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
          <BarChart2 size={16} />
        </div>
        <h3 className="font-bold text-white text-lg">استطلاعات الجماهير</h3>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="p-3 rounded-xl border text-xs font-bold bg-red-500/10 border-red-500/30 text-red-400 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      {polls === null ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex justify-center">
          <Loader2 size={24} className="animate-spin text-yellow-500" />
        </div>
      ) : polls.length > 0 ? (
        polls.map((poll) => {
          const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
          const hasVoted = poll.options.some((option) => option.isMyVote);
          const showResults = hasVoted || poll.status === 'closed';

          return (
            <div key={poll.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h4 className="font-bold text-white text-sm leading-snug">{poll.question}</h4>
                {poll.status === 'closed' && (
                  <span className="shrink-0 text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-bold">مغلق</span>
                )}
              </div>

              <div className="space-y-2">
                {poll.options.map((option) => {
                  const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                  const clickable = poll.status === 'open' && !showResults;
                  return (
                    <button
                      key={option.id}
                      onClick={() => void handleVote(poll, option.id)}
                      disabled={!clickable || votingId !== null}
                      aria-pressed={option.isMyVote}
                      className={`w-full relative overflow-hidden rounded-xl border p-3 text-right transition-colors ${
                        option.isMyVote
                          ? 'border-yellow-500/50 bg-yellow-500/5'
                          : clickable
                            ? 'border-zinc-700 bg-zinc-800/40 hover:border-yellow-500/40'
                            : 'border-zinc-800 bg-zinc-800/40 cursor-default'
                      }`}
                    >
                      {showResults && (
                        <div
                          className="absolute inset-y-0 right-0 bg-yellow-500/10 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          {option.isMyVote && <Check size={14} className="text-yellow-500 shrink-0" aria-label="تصويتي" />}
                          {votingId === option.id && <Loader2 size={14} className="animate-spin text-yellow-500 shrink-0" />}
                          <span className="text-sm text-white font-medium truncate">{option.label}</span>
                        </span>
                        {showResults && (
                          <span className="text-xs font-black text-yellow-500 shrink-0">{percent}%</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-zinc-500 font-bold">{totalVotes} صوت</span>
                {poll.status === 'open' && hasVoted && (
                  <span className="text-[10px] text-zinc-600">يمكنك تغيير تصويتك حتى الإغلاق</span>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <BarChart2 size={48} className="text-zinc-700 mb-4" />
          <h4 className="font-bold text-zinc-400">لا توجد استطلاعات حالياً</h4>
          <p className="text-xs text-zinc-500 mt-2">السبر القادم سيكون متاحاً قريباً.</p>
        </div>
      )}
    </div>
  );
}
