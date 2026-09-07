import { useState, useEffect } from 'react';


import { Match } from '../../types';
import { Trash2, Edit2, ChevronRight, Save, X } from 'lucide-react';

export default function AdminMatches({ onBack }: { onBack: () => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [homeTeam, setHomeTeam] = useState('أهلي برج بوعريريج');
  const [awayTeam, setAwayTeam] = useState('');
  const [competition, setCompetition] = useState('الرابطة المحترفة الأولى');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [stadium, setStadium] = useState('20 أوت 1955');
  const [status, setStatus] = useState<Match['status']>('scheduled');
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

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

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const matchData = {
      homeTeam, awayTeam, competition, date, time, stadium, status, homeScore, awayScore
    };
    
    try {
      if (isEditing) {
        await fetch(`/api/matches/${isEditing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(matchData)
        });
      } else {
        await fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(matchData)
        });
      }
      resetForm();
      fetchMatches();
    } catch (error) {
      console.error(error);
      alert('خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (m: Match) => {
    setIsEditing(m.id);
    setHomeTeam(m.homeTeam);
    setAwayTeam(m.awayTeam);
    setCompetition(m.competition);
    setDate(m.date);
    setTime(m.time);
    setStadium(m.stadium);
    setStatus(m.status);
    setHomeScore(m.homeScore);
    setAwayScore(m.awayScore);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف المباراة؟')) return;
    try {
      await fetch(`/api/matches/${id}`, { method: 'DELETE' });
      fetchMatches();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setHomeTeam('أهلي برج بوعريريج');
    setAwayTeam('');
    setDate('');
    setTime('');
    setStatus('scheduled');
    setHomeScore(0);
    setAwayScore(0);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold mb-4">
        <ChevronRight size={16} /> العودة
      </button>

      <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <h3 className="font-bold text-white mb-4">{isEditing ? 'تعديل المباراة' : 'إضافة مباراة'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="الفريق المستضيف" value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" required />
            <input type="text" placeholder="الفريق الضيف" value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" required />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" required />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="البطولة" value={competition} onChange={e => setCompetition(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" required />
            <input type="text" placeholder="الملعب" value={stadium} onChange={e => setStadium(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" required />
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="col-span-3 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white">
              <option value="scheduled">مجدولة (لم تبدأ)</option>
              <option value="live">جارية الآن</option>
              <option value="finished">انتهت</option>
              <option value="postponed">تأجلت</option>
              <option value="cancelled">ألغيت</option>
            </select>
          </div>

          {(status === 'finished' || status === 'live') && (
            <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="text-xs text-zinc-400">أهداف المستضيف</label>
                  <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(parseInt(e.target.value)||0)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" />
               </div>
               <div>
                  <label className="text-xs text-zinc-400">أهداف الضيف</label>
                  <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(parseInt(e.target.value)||0)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white" />
               </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              <Save size={16} /> حفظ
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="px-4 bg-zinc-700 text-white rounded-lg"><X size={16} /></button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {matches.map(m => (
          <div key={m.id} className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div className="text-right">
              <h4 className="font-bold text-white text-sm">{m.homeTeam} ضد {m.awayTeam}</h4>
              <p className="text-xs text-zinc-500">{m.date} - {m.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(m)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(m.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {matches.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد مباريات</p>}
      </div>
    </div>
  );
}
