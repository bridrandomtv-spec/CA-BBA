import { useState, useEffect } from 'react';
import { Calendar, MapPin, Bell, CalendarPlus, ChevronRight, ChevronLeft, Heart, Filter } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { Match } from '../types';



export default function MatchCalendar() {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(2); 
  const [filterStatus, setFilterStatus] = useState<'all' | 'past' | 'upcoming'>('all');
  const { favorites, toggleFavorite } = useFavorites();
  
  const [matches, setMatches] = useState<Match[]>([]);
  
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch('/api/matches');
        if (res.ok) {
          const data = await res.json();
          setMatches(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMatches();
  }, []);

  const months = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان'];
  const monthDays = [31, 29, 31, 30, 31, 30];
  const startDayOfWeek = [1, 4, 5, 1, 3, 6]; 

  const filteredMatches = matches.filter(m => {
    // In a real app we'd map m.date to month index. We'll just show all for this month for demo.
    // Or we skip month filtering and just show them.
    if (filterStatus === 'all') return true;
    if (filterStatus === 'upcoming') return m.status === 'scheduled';
    if (filterStatus === 'past') return m.status === 'finished';
    return true;
  });
  
  const prevMonth = () => setCurrentMonthIndex(prev => Math.max(0, prev - 1));
  const nextMonth = () => setCurrentMonthIndex(prev => Math.min(months.length - 1, prev + 1));

  const renderCalendarGrid = () => {
    const days = monthDays[currentMonthIndex];
    const startDay = startDayOfWeek[currentMonthIndex];
    
    const headers = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(d => (
      <div key={d} className="text-center text-[10px] text-zinc-500 font-bold py-1">
        {d}
      </div>
    ));
    
    const grid: React.ReactElement[] = [];
    for (let i = 0; i < startDay; i++) {
      grid.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    for (let day = 1; day <= days; day++) {
      // rough match by date string
      const matchOnDay = filteredMatches.find(m => {
          const matchDay = parseInt(m.date.split(' ')[0]) || 0;
          return matchDay === day;
      });
      const isToday = day === 12 && currentMonthIndex === 2;
      
      grid.push(
        <div 
          key={`day-${day}`} 
          className={`flex flex-col items-center justify-center p-1.5 aspect-square rounded-lg border transition-colors ${
            matchOnDay 
              ? 'border-yellow-500/50 bg-yellow-500/10 cursor-pointer hover:bg-yellow-500/20' 
              : isToday
                ? 'border-zinc-500 bg-zinc-800'
                : 'border-transparent hover:bg-zinc-800/50'
          }`}
        >
          <span className={`text-xs font-bold ${matchOnDay ? 'text-yellow-500' : isToday ? 'text-white' : 'text-zinc-400'}`}>
            {day}
          </span>
          {matchOnDay && (
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1"></div>
          )}
        </div>
      );
    }
    
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {headers}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Calendar className="text-yellow-500" size={20} />
            التقويم
          </h3>
          <div className="flex bg-zinc-800 rounded-lg p-1 text-[10px] font-bold">
            <button onClick={() => setFilterStatus('all')} className={`px-2 py-1 rounded-md transition-colors ${filterStatus === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}>الكل</button>
            <button onClick={() => setFilterStatus('upcoming')} className={`px-2 py-1 rounded-md transition-colors ${filterStatus === 'upcoming' ? 'bg-yellow-500 text-black' : 'text-zinc-400'}`}>القادمة</button>
            <button onClick={() => setFilterStatus('past')} className={`px-2 py-1 rounded-md transition-colors ${filterStatus === 'past' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}>السابقة</button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
            <button onClick={prevMonth} disabled={currentMonthIndex === 0} className={`p-1 rounded-full ${currentMonthIndex === 0 ? 'text-zinc-700' : 'text-zinc-400'}`}>
                <ChevronRight size={16} />
            </button>
            <span className="text-sm font-bold text-yellow-500 min-w-[60px] text-center">{months[currentMonthIndex]}</span>
            <button onClick={nextMonth} disabled={currentMonthIndex === months.length - 1} className={`p-1 rounded-full ${currentMonthIndex === months.length - 1 ? 'text-zinc-700' : 'text-zinc-400'}`}>
                <ChevronLeft size={16} />
            </button>
        </div>
      </div>
      
      {renderCalendarGrid()}
      
      <div className="space-y-3">
        <h4 className="font-bold text-zinc-400 text-sm mb-2 px-2">مباريات الشهر</h4>
        {filteredMatches.length > 0 ? (
            filteredMatches.map(match => (
              <div key={match.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleFavorite(match.id)}
                      className={`transition-colors ${favorites.includes(match.id) ? 'text-red-500' : 'text-zinc-600 hover:text-red-400'}`}
                    >
                      <Heart size={16} className={favorites.includes(match.id) ? 'fill-current' : ''} />
                    </button>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{match.competition}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                    <Calendar size={12} />
                    <span>{match.date}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-700">
                      <span className="font-bold text-xs text-white truncate max-w-[20px]">{match.awayTeam.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{match.awayTeam}</h4>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                        <MapPin size={10} /> {match.stadium}
                      </div>
                    </div>
                  </div>
                  
                  {match.status === 'scheduled' ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="font-black text-lg text-white">{match.time}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-zinc-500 font-bold">انتهت</span>
                      <span className="font-black text-xl text-white tracking-widest">{match.homeScore} - {match.awayScore}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
        ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Calendar size={48} className="text-zinc-700 mb-4" />
                <h4 className="font-bold text-zinc-400">لا توجد مباريات</h4>
            </div>
        )}
      </div>
    </div>
  );
}
