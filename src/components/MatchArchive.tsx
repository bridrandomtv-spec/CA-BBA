import { useState } from 'react';
import { History, Calendar, ChevronDown, Trophy, Users, FileText } from 'lucide-react';

interface ArchiveMatch {
  id: string;
  date: string;
  opponent: string;
  score: string;
  result: 'win' | 'loss' | 'draw';
  competition: string;
  season: string;
}

const mockArchive: ArchiveMatch[] = [
  { id: '1', date: '2023-05-15', opponent: 'مولودية الجزائر', score: '2 - 1', result: 'win', competition: 'الرابطة المحترفة الأولى', season: '2022/2023' },
  { id: '2', date: '2023-03-22', opponent: 'شباب بلوزداد', score: '0 - 0', result: 'draw', competition: 'الرابطة المحترفة الأولى', season: '2022/2023' },
  { id: '3', date: '2022-12-10', opponent: 'وفاق سطيف', score: '1 - 2', result: 'loss', competition: 'الرابطة المحترفة الأولى', season: '2022/2023' },
  { id: '4', date: '2022-04-18', opponent: 'شبيبة القبائل', score: '3 - 1', result: 'win', competition: 'كأس الجمهورية', season: '2021/2022' },
];

export default function MatchArchive() {
  const [selectedSeason, setSelectedSeason] = useState('2022/2023');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const seasons = ['2023/2024', '2022/2023', '2021/2022', '2020/2021'];

  const filteredMatches = mockArchive.filter(m => m.season === selectedSeason);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
              <History size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-md">الأرشيف التاريخي</h3>
              <p className="text-[10px] text-zinc-400">إحصائيات ونتائج المواسم السابقة</p>
            </div>
          </div>
          
          <div className="relative">
            <select 
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="appearance-none bg-zinc-800 border border-zinc-700 text-white text-xs font-bold rounded-lg pl-8 pr-3 py-2 outline-none focus:border-yellow-500/50"
              dir="ltr"
            >
              {seasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-3">
        {filteredMatches.length > 0 ? filteredMatches.map(match => (
          <div key={match.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all">
            <div 
              className={`p-4 cursor-pointer hover:bg-zinc-800/50 flex items-center justify-between ${expandedMatch === match.id ? 'bg-zinc-800/50' : ''}`}
              onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-12 rounded-full ${match.result === 'win' ? 'bg-green-500' : match.result === 'loss' ? 'bg-red-500' : 'bg-zinc-500'}`}></div>
                <div>
                  <h4 className="font-bold text-white text-sm">ضد {match.opponent}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {match.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Trophy size={10} /> {match.competition}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="font-black text-lg text-white tracking-wider" dir="ltr">{match.score}</span>
                <ChevronDown size={16} className={`text-zinc-500 transition-transform ${expandedMatch === match.id ? 'rotate-180' : ''}`} />
              </div>
            </div>
            
            {expandedMatch === match.id && (
              <div className="bg-zinc-800/30 p-4 border-t border-zinc-800 text-sm animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4">
                    <h5 className="font-bold text-yellow-500 flex items-center gap-2 mb-3"><Users size={16} /> التشكيلة الأساسية</h5>
                    <ul className="text-zinc-300 text-xs space-y-2">
                      <li>1. وليد عمار (حارس)</li>
                      <li>5. عبد الله بن علي</li>
                      <li>3. سفيان م.</li>
                      <li>8. كريم ك.</li>
                      <li>10. محمد بن يحيى (C)</li>
                      <li>9. يوسف شيبان</li>
                    </ul>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4">
                    <h5 className="font-bold text-blue-400 flex items-center gap-2 mb-3"><FileText size={16} /> تقرير المباراة</h5>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      مباراة قوية شهدت سيطرة الكابا في الشوط الأول. تم تسجيل الهدف الأول في الدقيقة 34 عبر تسديدة قوية من خارج منطقة الجزاء. في الشوط الثاني تراجع الأداء قليلاً لكن الدفاع صمد أمام هجمات الخصم.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <History size={48} className="text-zinc-700 mb-4" />
            <h4 className="font-bold text-zinc-400">لا توجد سجلات</h4>
            <p className="text-xs text-zinc-500 mt-2">لا تتوفر بيانات أرشيفية لهذا الموسم حتى الآن.</p>
          </div>
        )}
      </div>
    </div>
  );
}
