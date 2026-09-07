import { useState } from 'react';
import { BarChart2, CheckCircle2 } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  category: string;
}

const initialPolls: Poll[] = [
  {
    id: '1',
    question: 'من هو رجل مباراة الكابا ضد شبيبة القبائل؟',
    category: 'رجل المباراة',
    totalVotes: 1245,
    options: [
      { id: 'o1', text: 'محمد بن يحيى', votes: 850 },
      { id: 'o2', text: 'يوسف شيبان', votes: 215 },
      { id: 'o3', text: 'وليد عمار', votes: 120 },
      { id: 'o4', text: 'أخرى', votes: 60 },
    ]
  },
  {
    id: '2',
    question: 'ما هي الخطة الأنسب للمباراة القادمة ضد وفاق سطيف؟',
    category: 'الخطة المفضلة',
    totalVotes: 890,
    options: [
      { id: 'o1', text: '4-3-3 الهجومية', votes: 500 },
      { id: 'o2', text: '4-4-2 التوازن', votes: 300 },
      { id: 'o3', text: '3-5-2 الدفاعية', votes: 90 },
    ]
  }
];

export default function FanPolls() {
  const [polls, setPolls] = useState<Poll[]>(initialPolls);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});

  const handleVote = (pollId: string, optionId: string) => {
    if (votedPolls[pollId]) return;

    setVotedPolls(prev => ({ ...prev, [pollId]: optionId }));
    
    setPolls(prevPolls => 
      prevPolls.map(poll => {
        if (poll.id === pollId) {
          return {
            ...poll,
            totalVotes: poll.totalVotes + 1,
            options: poll.options.map(opt => 
              opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
            )
          };
        }
        return poll;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2 mt-4">
        <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
          <BarChart2 size={16} />
        </div>
        <h3 className="font-bold text-white text-lg">تصويت الجماهير</h3>
      </div>

      <div className="space-y-4">
        {polls.map(poll => {
          const hasVoted = !!votedPolls[poll.id];
          const votedOptionId = votedPolls[poll.id];

          return (
            <div key={poll.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">{poll.category}</span>
                <span className="text-xs text-zinc-500">{poll.totalVotes.toLocaleString('ar-DZ')} صوت</span>
              </div>
              <h4 className="font-bold text-white text-sm mb-4 leading-relaxed">{poll.question}</h4>
              
              <div className="space-y-2">
                {poll.options.map(option => {
                  const percentage = Math.round((option.votes / poll.totalVotes) * 100);
                  const isVotedOption = votedOptionId === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      disabled={hasVoted}
                      onClick={() => handleVote(poll.id, option.id)}
                      className={`relative w-full text-right p-3 rounded-xl border transition-all overflow-hidden ${
                        hasVoted 
                          ? isVotedOption 
                            ? 'border-yellow-500 bg-yellow-500/5' 
                            : 'border-zinc-800 bg-zinc-800/20 opacity-80'
                          : 'border-zinc-800 bg-zinc-800/40 hover:border-yellow-500/50 hover:bg-zinc-800'
                      }`}
                    >
                      {hasVoted && (
                        <div 
                          className={`absolute top-0 right-0 h-full -z-10 transition-all duration-1000 ease-out ${
                            isVotedOption ? 'bg-yellow-500/20' : 'bg-zinc-800/50'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      )}
                      
                      <div className="flex items-center justify-between z-10 relative">
                        <span className={`text-sm font-bold flex items-center gap-2 ${
                          isVotedOption ? 'text-yellow-500' : 'text-zinc-300'
                        }`}>
                          {isVotedOption && <CheckCircle2 size={14} />}
                          {option.text}
                        </span>
                        {hasVoted && (
                          <span className={`text-xs font-bold ${
                            isVotedOption ? 'text-yellow-500' : 'text-zinc-500'
                          }`}>
                            {percentage}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
