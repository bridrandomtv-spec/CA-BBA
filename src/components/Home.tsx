import { ArrowLeft, Trophy, Calendar, ChevronLeft, History } from 'lucide-react';
import { useState } from 'react';
import TeamStats from './TeamStats';
import ClubHistory from './ClubHistory';
import WeatherWidget from './WeatherWidget';
import FanPolls from './FanPolls';
import FanGallery from './FanGallery';

interface HomeProps {
  onNavigate?: (tab: any) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const [showHistory, setShowHistory] = useState(false);

  const news: any[] = []; // Empty for now as there's no real backend news API

  if (showHistory) {
    return <ClubHistory onBack={() => setShowHistory(false)} />;
  }

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      
      {/* Welcome Banner / Next Match Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
        <div className="p-5 relative z-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded font-bold uppercase tracking-wider">
              المباراة القادمة
            </span>
          </div>
          
          <div className="text-center text-zinc-500 py-6 text-sm font-bold border border-zinc-800 border-dashed rounded-xl mb-4">
            البيانات غير متوفرة
          </div>
          
          <button onClick={() => onNavigate && onNavigate('match')} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
            مركز المباراة
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>

      {/* Quick Stats / Mini Dashboard */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center hover:border-yellow-500/30 transition-colors">
          <Trophy size={24} className="text-zinc-600 mb-2" />
          <span className="text-lg font-black text-zinc-500 block">-</span>
          <span className="text-xs text-zinc-400 font-medium">الترتيب الحالي</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center hover:border-yellow-500/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-600 flex items-center justify-center mb-2 font-bold">-</div>
          <span className="text-lg font-black text-zinc-500 block">-</span>
          <span className="text-xs text-zinc-400 font-medium">النقاط</span>
        </div>
      </div>

      <TeamStats />
      
      <WeatherWidget />
      
      <FanPolls />
      
      <FanGallery />

      {/* History Navigation Card */}
      <div 
        onClick={() => setShowHistory(true)}
        className="bg-zinc-900 border border-zinc-800 hover:border-yellow-500/50 rounded-2xl p-4 shadow-lg flex items-center justify-between cursor-pointer group transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-colors">
            <History size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">تاريخ النادي</h3>
            <p className="text-xs text-zinc-400">عراقة وأمجاد الجراد الأصفر</p>
          </div>
        </div>
        <ChevronLeft size={20} className="text-zinc-500 group-hover:text-white transition-colors" />
      </div>

      {/* Financial Transparency / Campaign */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-white">صندوق دعم النادي</h3>
          </div>
          
          <div className="text-center text-zinc-500 py-6 border border-zinc-800 border-dashed rounded-xl text-xs">
            البيانات غير متوفرة حالياً
          </div>
        </div>
      </div>

      {/* News Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-white">آخر الأخبار</h3>
        </div>
        
        <div className="space-y-3">
          {news.length > 0 ? news.map((item) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 hover:border-yellow-500/30 transition-colors rounded-xl p-4 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-lg bg-black flex-none flex items-center justify-center border border-zinc-800">
                <div className="text-yellow-500/50 font-bold">C</div>
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-yellow-500 font-semibold tracking-wider mb-1 block">
                  {item.category}
                </span>
                <h4 className="font-bold text-sm text-white mb-1 line-clamp-1">{item.title}</h4>
                <p className="text-xs text-zinc-400 line-clamp-1">{item.excerpt}</p>
                <span className="text-[10px] text-zinc-500 mt-2 block">{item.date}</span>
              </div>
            </div>
          )) : (
            <div className="text-center text-zinc-500 py-6 border border-zinc-800 border-dashed rounded-xl text-xs">
              لا توجد أخبار حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
