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

  const news = [
    {
      id: '1',
      title: 'استئناف التدريبات بملعب 20 أوت',
      excerpt: 'الفريق يعود للتدريبات تحضيراً للمباراة القادمة بحضور جماهيري غفير.',
      date: 'منذ ساعتين',
      category: 'الفريق الأول',
    },
    {
      id: '2',
      title: 'حملة الانخراط في النادي',
      excerpt: 'الإدارة تفتح باب الانخراط الرقمي للأنصار لدعم استقرار النادي.',
      date: 'منذ 5 ساعات',
      category: 'النادي',
    },
    {
      id: '3',
      title: 'ندوة صحفية للمدرب غداً',
      excerpt: 'مدرب الفريق يعقد ندوة صحفية للحديث عن التحديات القادمة.',
      date: 'أمس',
      category: 'تصريحات',
    }
  ];

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
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Calendar size={12} />
              السبت، 20:00
            </span>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center border-2 border-yellow-500 mb-2 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                <span className="font-bold text-lg text-yellow-500">C</span>
              </div>
              <span className="font-bold text-sm text-white">الكابا</span>
            </div>
            
            <div className="flex flex-col items-center px-4">
              <span className="text-2xl font-black text-white bg-zinc-800 px-3 py-1 rounded-lg">VS</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-zinc-700 mb-2" style={{ backgroundColor: "#ffffff" }}>
                <span className="font-bold text-lg text-black">M</span>
              </div>
              <span className="font-bold text-sm text-white">المنافس</span>
            </div>
          </div>
          
          <button onClick={() => onNavigate && onNavigate('match')} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
            مركز المباراة
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>

      {/* Quick Stats / Mini Dashboard */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center hover:border-yellow-500/30 transition-colors">
          <Trophy size={24} className="text-yellow-500 mb-2" />
          <span className="text-2xl font-black text-white block">3</span>
          <span className="text-xs text-zinc-400 font-medium">الترتيب الحالي</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center hover:border-yellow-500/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center mb-2 font-bold">12</div>
          <span className="text-2xl font-black text-white block">24</span>
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
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
              شفافية 100%
            </span>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-white mb-2">
              <span>تم جمع: 125,000 دج</span>
              <span className="text-zinc-400">الهدف: 500,000 دج</span>
            </div>
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-yellow-500 w-[25%] rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)] relative">
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 text-xs text-zinc-300">
            <p className="mb-2"><span className="text-yellow-500 font-bold">•</span> المساهمات الأخيرة ذهبت لـ: <span className="font-bold text-white">مصاريف تنقل الفريق للفئات الشبانية</span></p>
            <p><span className="text-yellow-500 font-bold">•</span> عدد المساهمين هذا الشهر: <span className="font-bold text-white">342 مناصر</span></p>
          </div>
        </div>
      </div>

      {/* News Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-white">آخر الأخبار</h3>
        </div>
        
        <div className="space-y-3">
          {news.map((item) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
