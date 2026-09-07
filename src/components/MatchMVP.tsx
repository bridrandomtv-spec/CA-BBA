import { useState } from 'react';
import { Star, CheckCircle2, Share2 } from 'lucide-react';

interface MVPCandidate {
  id: string;
  name: string;
  number: string;
  position: string;
  votes: number;
}

const initialCandidates: MVPCandidate[] = [
  { id: '1', name: 'محمد بن يحيى', number: '10', position: 'صانع ألعاب', votes: 450 },
  { id: '2', name: 'يوسف شيبان', number: '9', position: 'مهاجم', votes: 320 },
  { id: '3', name: 'وليد عمار', number: '1', position: 'حارس مرمى', votes: 210 },
  { id: '4', name: 'عبد الله بن علي', number: '5', position: 'مدافع', votes: 85 },
];

export default function MatchMVP() {
  const [candidates, setCandidates] = useState<MVPCandidate[]>(initialCandidates);
  const [votedCandidate, setVotedCandidate] = useState<string | null>(null);

  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "صوّتت لـ MVP", text: "لقد قمت بالتصويت لأفضل لاعب في المباراة!" });
    } else {
      alert("تم نسخ الرابط!");
    }
  };

  const handleVote = (candidateId: string) => {
    if (votedCandidate) return;

    setVotedCandidate(candidateId);
    setCandidates(prev => 
      prev.map(c => 
        c.id === candidateId ? { ...c, votes: c.votes + 1 } : c
      ).sort((a, b) => b.votes - a.votes)
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-in fade-in slide-in-from-right-4 shadow-sm">
      <div className="text-center mb-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl"></div>
        <Star className="text-yellow-500 w-12 h-12 mx-auto mb-3 relative z-10 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
        <h3 className="font-bold text-white text-lg mb-2 relative z-10">نجم المباراة</h3>
        <p className="text-xs text-zinc-400 relative z-10">صوت للاعب المفضل لديك في هذه المباراة. يتم إعلان الفائز بعد النهاية.</p>
      </div>
      
      <div className="space-y-3">
        {candidates.map((candidate, index) => {
          const percentage = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
          const isVoted = votedCandidate === candidate.id;
          const rank = index + 1;
          
          return (
            <button 
              key={candidate.id}
              disabled={votedCandidate !== null}
              onClick={() => handleVote(candidate.id)}
              className={`w-full relative overflow-hidden border rounded-xl p-3 flex items-center justify-between transition-all ${
                votedCandidate
                  ? isVoted 
                    ? 'border-yellow-500 bg-yellow-500/5' 
                    : 'border-zinc-800 bg-zinc-800/20 opacity-70'
                  : 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700 hover:border-yellow-500/50'
              }`}
            >
              {votedCandidate && (
                <div 
                  className={`absolute top-0 right-0 h-full -z-10 transition-all duration-1000 ease-out ${
                    isVoted ? 'bg-yellow-500/20' : 'bg-zinc-800/50'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}
              
              <div className="flex items-center gap-3 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  rank === 1 && votedCandidate ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'bg-zinc-700 text-white'
                }`}>
                  {candidate.number}
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm block ${isVoted ? 'text-yellow-500' : 'text-white'}`}>
                    {candidate.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">{candidate.position}</span>
                </div>
              </div>
              
              <div className="relative z-10 flex items-center gap-2">
                {votedCandidate && (
                  <span className={`text-xs font-bold ${isVoted ? 'text-yellow-500' : 'text-zinc-400'}`}>
                    {percentage}%
                  </span>
                )}
                {isVoted && <CheckCircle2 size={16} className="text-yellow-500" />}
                {!votedCandidate && (
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-500 flex items-center justify-center"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {!votedCandidate && (
        <div className="mt-6 text-center text-xs text-zinc-500 bg-zinc-800/50 py-2 rounded-lg">
          اختر لاعباً للتصويت ومعرفة النتائج الحالية
        </div>
      )}
      
      {votedCandidate && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="text-center text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 py-2 rounded-lg font-bold">
            تم تسجيل تصويتك بنجاح! شكراً لمشاركتك.
          </div>
          <button 
            onClick={handleShare}
            className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={16} /> شارك تصويتك
          </button>
        </div>
      )}
    </div>
  );
}
