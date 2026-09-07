import re

with open("src/components/MatchCenter.tsx", "r") as f:
    content = f.read()

import_search = "import { Calendar, Clock, MapPin, ChevronRight, Shield, Activity } from 'lucide-react';"
import_replace = "import { Calendar, Clock, MapPin, ChevronRight, Shield, Activity } from 'lucide-react';\nimport { useState, useEffect } from 'react';\nimport { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';\nimport { db } from '../lib/firebase';\nimport { Match } from '../types';"
content = content.replace(import_search, import_replace)

body_search = """export default function MatchCenter() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'results' | 'standings'>('upcoming');"""
  
body_replace = """export default function MatchCenter() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'results' | 'standings'>('upcoming');
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [results, setResults] = useState<Match[]>([]);
  
  useEffect(() => {
    // We fetch all matches and separate locally to avoid requiring complex composite index right away.
    // Order by createdAt desc will put newest created first. Ideally order by 'date' but that needs an index if combined with status filtering.
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const un = onSnapshot(q, (snapshot) => {
      const all: Match[] = [];
      snapshot.forEach(doc => all.push({ id: doc.id, ...doc.data() } as Match));
      setUpcomingMatches(all.filter(m => m.status === 'scheduled' || m.status === 'live'));
      setResults(all.filter(m => m.status === 'finished'));
    });
    return () => un();
  }, []);"""
content = content.replace(body_search, body_replace)

upcoming_ui_search = """        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-zinc-800 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent"></div>
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-yellow-500" />
                  <span className="text-sm font-bold text-white">السبت 24 أكتوبر</span>
                </div>
                <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full border border-yellow-500/20">
                  <Activity size={14} className="animate-pulse" />
                  <span className="text-xs font-bold">مباراة القمة</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-yellow-500" />
                  <span className="text-sm font-bold text-white">18:00</span>
                </div>
              </div>

              <div className="flex justify-between items-center relative z-10 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
                <div className="text-center w-1/3">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center p-1 shadow-lg mb-2">
                    <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center font-bold text-2xl text-yellow-500">C</div>
                  </div>
                  <h4 className="font-bold text-white text-sm">أهلي البرج</h4>
                </div>
                
                <div className="w-1/3 flex justify-center">
                  <div className="bg-black/50 px-4 py-2 rounded-xl border border-yellow-500/30 text-yellow-500 font-bold tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    VS
                  </div>
                </div>

                <div className="text-center w-1/3">
                  <div className="w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-700 shadow-lg mb-2">
                    <Shield size={28} className="text-zinc-500" />
                  </div>
                  <h4 className="font-bold text-zinc-400 text-sm">الفريق المنافس</h4>
                </div>
              </div>
              
              <div className="mt-5 flex items-center justify-between text-xs text-zinc-500 relative z-10 bg-zinc-900/50 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-zinc-400" />
                  <span>ملعب 20 أوت 1955</span>
                </div>
                <span className="font-bold text-zinc-400">الرابطة المحترفة الأولى</span>
              </div>
            </div>
          </div>
        )}"""
        
upcoming_ui_replace = """        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {upcomingMatches.map(m => (
              <div key={m.id} className="bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-5 border border-zinc-800 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent"></div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-yellow-500" />
                    <span className="text-sm font-bold text-white">{m.date}</span>
                  </div>
                  {m.status === 'live' && (
                    <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20">
                      <Activity size={14} className="animate-pulse" />
                      <span className="text-xs font-bold">مباشر</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-yellow-500" />
                    <span className="text-sm font-bold text-white">{m.time}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center relative z-10 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
                  <div className="text-center w-1/3">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center p-1 shadow-lg mb-2">
                      <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center font-bold text-2xl text-yellow-500">{m.homeTeam.charAt(0)}</div>
                    </div>
                    <h4 className="font-bold text-white text-sm">{m.homeTeam}</h4>
                  </div>
                  
                  <div className="w-1/3 flex flex-col items-center justify-center">
                    {m.status === 'live' ? (
                       <div className="flex items-center gap-3 text-3xl font-black text-white tracking-wider">
                         <span>{m.homeScore}</span><span className="text-zinc-600">-</span><span>{m.awayScore}</span>
                       </div>
                    ) : (
                      <div className="bg-black/50 px-4 py-2 rounded-xl border border-yellow-500/30 text-yellow-500 font-bold tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        VS
                      </div>
                    )}
                  </div>

                  <div className="text-center w-1/3">
                    <div className="w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-700 shadow-lg mb-2">
                      <span className="font-bold text-2xl text-zinc-500">{m.awayTeam.charAt(0)}</span>
                    </div>
                    <h4 className="font-bold text-zinc-400 text-sm">{m.awayTeam}</h4>
                  </div>
                </div>
                
                <div className="mt-5 flex items-center justify-between text-xs text-zinc-500 relative z-10 bg-zinc-900/50 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-zinc-400" />
                    <span>{m.stadium}</span>
                  </div>
                  <span className="font-bold text-zinc-400">{m.competition}</span>
                </div>
              </div>
            ))}
            {upcomingMatches.length === 0 && <p className="text-center text-zinc-500 text-sm mt-10">لا توجد مباريات قادمة</p>}
          </div>
        )}"""
content = content.replace(upcoming_ui_search, upcoming_ui_replace)

results_ui_search = """        {activeTab === 'results' && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 relative z-10">
                  <span className="text-xs text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full">الرابطة الأولى</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Full Time</span>
                </div>
                
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <span className="font-bold text-sm text-white">أهلي البرج</span>
                  </div>
                  
                  <div className="w-1/3 flex justify-center">
                    <div className="flex items-center gap-3 text-2xl font-black text-white tracking-wider bg-zinc-800/50 px-4 py-2 rounded-xl">
                      <span>2</span>
                      <span className="text-zinc-600">-</span>
                      <span className="text-zinc-500">1</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <span className="font-bold text-sm text-zinc-400">الفريق الضيف</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}"""

results_ui_replace = """        {activeTab === 'results' && (
          <div className="space-y-4">
            {results.map(r => (
              <div key={r.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 relative z-10">
                  <span className="text-xs text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full">{r.competition}</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{r.date}</span>
                </div>
                
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <span className="font-bold text-sm text-white">{r.homeTeam}</span>
                  </div>
                  
                  <div className="w-1/3 flex justify-center">
                    <div className="flex items-center gap-3 text-2xl font-black text-white tracking-wider bg-zinc-800/50 px-4 py-2 rounded-xl">
                      <span>{r.homeScore}</span>
                      <span className="text-zinc-600">-</span>
                      <span className="text-zinc-500">{r.awayScore}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <span className="font-bold text-sm text-zinc-400">{r.awayTeam}</span>
                  </div>
                </div>
              </div>
            ))}
            {results.length === 0 && <p className="text-center text-zinc-500 text-sm mt-10">لا توجد نتائج سابقة</p>}
          </div>
        )}"""
content = content.replace(results_ui_search, results_ui_replace)

with open("src/components/MatchCenter.tsx", "w") as f:
    f.write(content)

