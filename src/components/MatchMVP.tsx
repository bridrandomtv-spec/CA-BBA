// Vote « homme du match » — RÉEL et persisté (migration 015).
//
// Findings corrigés :
//  1. `initialCandidates = []` + votes dans un useState : le « رجل المباراة »
//     du README n'agrégeait RIEN. Candidats = titulaires réels du match
//     (match_lineups), votes en base.
//  2. `alert("تم نسخ الرابط!")` MENTAIT : rien n'était copié. Vrai
//     navigator.clipboard + Web Share API avec URL deep-link (/#/match).
//  3. Composant sans match ciblé : prop `matchId` optionnelle (MatchCenter
//     peut passer `selectedId`), sinon résolution via lib/featuredMatch.
import { useCallback, useEffect, useState } from 'react';
import { Trophy, Loader2, Share2, Check } from 'lucide-react';
import { resolveFeaturedMatchId } from '../lib/featuredMatch';

interface MVPCandidate {
  playerApiId: number;
  playerName: string;
  number: number | null;
  position: string | null;
  teamApiId: number | null;
  votes: number;
  isMyVote: boolean;
}

interface MVPMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeTeamApiId: number | null;
  awayTeamApiId: number | null;
}

const POSITION_LABELS: Record<string, string> = {
  G: 'حارس', D: 'دفاع', M: 'وسط', A: 'هجوم',
};

export default function MatchMVP({ matchId }: { matchId?: string }) {
  const [match, setMatch] = useState<MVPMatch | null>(null);
  const [candidates, setCandidates] = useState<MVPCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async (targetId?: string) => {
    try {
      const resolvedId = targetId ?? matchId ?? (await resolveFeaturedMatchId());
      if (!resolvedId) return;
      const res = await fetch(`/api/matches/${encodeURIComponent(resolvedId)}/mvp`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`mvp → ${res.status}`);
      const data = await res.json();
      setMatch(data.match ?? null);
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
    } catch (error) {
      console.error('[CABBA] mvp:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { void load(); }, [load]);

  const handleVote = async (candidate: MVPCandidate) => {
    if (!match) return;
    if (match.status !== 'live' && match.status !== 'finished') {
      setNotice('التصويت متاح أثناء المباراة وبعدها فقط.');
      return;
    }
    setVoting(candidate.playerApiId);
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(match.id)}/mvp/vote`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerApiId: candidate.playerApiId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر تسجيل التصويت');
      setNotice('تم تسجيل تصويتك! 🟡⚫');
      await load(match.id);
    } catch (error) {
      console.error('[CABBA] mvp vote:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر تسجيل التصويت');
    } finally {
      setVoting(null);
    }
  };

  // Partage honnête : Web Share si disponible, sinon VRAIE copie presse-
  // papiers avec confirmation — l'ancien alert() annonçait une copie jamais
  // effectuée.
  const handleShare = async () => {
    const url = `${window.location.origin}/#/match`;
    const shareData = {
      title: 'صوّت لرجل المباراة — CABBA',
      text: 'صوّت لأفضل لاعب في مباراة الكابا!',
      url,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* partage annulé : repli copie */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice('تم نسخ الرابط!');
    } catch {
      setNotice('تعذر نسخ الرابط.');
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!match || candidates.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <Trophy size={32} className="text-zinc-600 mx-auto mb-3" />
        <h4 className="font-bold text-zinc-400 mb-1">رجل المباراة</h4>
        <p className="text-xs text-zinc-500">
          سيتوفر التصويت مع نشر تشكيلة المباراة (تُزامَن تلقائياً قبل انطلاق المباريات المغطاة).
        </p>
      </div>
    );
  }

  const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  const voteOpen = match.status === 'live' || match.status === 'finished';
  const teamOf = (candidate: MVPCandidate) =>
    candidate.teamApiId === match.homeTeamApiId ? match.homeTeam : match.awayTeam;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-right-4" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-yellow-500" />
          <h3 className="font-bold text-white text-sm">رجل المباراة</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 font-bold">{totalVotes} صوت</span>
          <button
            onClick={() => void handleShare()}
            aria-label="مشاركة التصويت"
            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="mb-3 p-2.5 rounded-xl border text-xs font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      <div className="space-y-2">
        {candidates.map((candidate) => {
          const percent = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
          return (
            <button
              key={candidate.playerApiId}
              onClick={() => void handleVote(candidate)}
              disabled={!voteOpen || voting !== null}
              className={`w-full relative overflow-hidden rounded-xl border p-3 text-right transition-colors disabled:cursor-default ${
                candidate.isMyVote
                  ? 'border-yellow-500/50 bg-yellow-500/5'
                  : 'border-zinc-800 bg-zinc-800/40 hover:border-zinc-700'
              }`}
            >
              {/* Barre de progression en fond : lecture immédiate du rapport de forces. */}
              <div
                className="absolute inset-y-0 right-0 bg-yellow-500/10 transition-all duration-500"
                style={{ width: `${percent}%` }}
                aria-hidden="true"
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {candidate.isMyVote && <Check size={14} className="text-yellow-500 shrink-0" aria-label="تصويتي" />}
                  {voting === candidate.playerApiId && <Loader2 size={14} className="animate-spin text-zinc-400 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {candidate.number ? `${candidate.number}. ` : ''}{candidate.playerName}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {teamOf(candidate)}{candidate.position ? ` · ${POSITION_LABELS[candidate.position] ?? candidate.position}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-yellow-500 shrink-0">{percent}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {!voteOpen && (
        <p className="text-[10px] text-zinc-600 mt-3 text-center">يفتح التصويت مع انطلاق المباراة.</p>
      )}
    </div>
  );
}
