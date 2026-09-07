import { useState } from 'react';
import { Award, Shield, CheckCircle2, TrendingUp, Users, Star, Lock } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  color: string;
  bgColor: string;
  dateUnlocked?: string;
}

const initialAchievements: Achievement[] = [
  {
    id: '1',
    title: 'مشجع وفي',
    description: 'تم تسجيل الدخول في 5 مباريات متتالية',
    icon: Shield,
    progress: 5,
    maxProgress: 5,
    unlocked: true,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    dateUnlocked: '10/05/2023'
  },
  {
    id: '2',
    title: 'خبير التوقعات',
    description: 'توقع النتيجة الصحيحة في 10 مباريات',
    icon: TrendingUp,
    progress: 10,
    maxProgress: 10,
    unlocked: true,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    dateUnlocked: '15/09/2023'
  },
  {
    id: '3',
    title: 'كبير المصوتين',
    description: 'شارك في 20 تصويت خاص بالجماهير',
    icon: Users,
    progress: 20,
    maxProgress: 20,
    unlocked: true,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    dateUnlocked: '01/11/2023'
  },
  {
    id: '4',
    title: 'داعم النادي',
    description: 'ساهم في الصندوق أو اشترى منتجات من المتجر',
    icon: CheckCircle2,
    progress: 1,
    maxProgress: 1,
    unlocked: true,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    dateUnlocked: '12/12/2023'
  },
  {
    id: '5',
    title: 'الأسطورة',
    description: 'أكمل جميع تحديات الموسم',
    icon: Star,
    progress: 15,
    maxProgress: 30,
    unlocked: false,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-800'
  },
  {
    id: '6',
    title: 'صوت الملعب',
    description: 'شارك 5 أهازيج وفيديوهات في عدسة الجماهير',
    icon: Award,
    progress: 2,
    maxProgress: 5,
    unlocked: false,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-800'
  }
];

export default function Achievements() {
  const [achievements] = useState<Achievement[]>(initialAchievements);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Award className="text-yellow-500" size={20} />
            إنجازات المشجع
          </h3>
          <p className="text-xs text-zinc-400 mt-1">اجمع الأوسمة لإثبات ولائك</p>
        </div>
        <span className="text-xs text-yellow-500 font-bold bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full">
          {unlockedCount} / {achievements.length} أوسمة
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {achievements.map((achievement) => (
          <div 
            key={achievement.id}
            onClick={() => setSelectedAchievement(achievement)}
            className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 transition-all ${
              achievement.unlocked 
                ? 'bg-zinc-800/50 border-zinc-700/50 hover:border-yellow-500/50 hover:bg-zinc-800' 
                : 'bg-zinc-900 border-zinc-800/50 opacity-70 hover:opacity-100 hover:border-zinc-700'
            }`}
          >
            <div className={`w-14 h-14 rounded-full ${achievement.bgColor} ${achievement.color} flex items-center justify-center relative ${achievement.unlocked ? 'shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''}`}>
              <achievement.icon size={24} className={!achievement.unlocked ? 'opacity-50' : ''} />
              {!achievement.unlocked && (
                <div className="absolute -bottom-1 -right-1 bg-zinc-800 rounded-full p-1 border border-zinc-700">
                  <Lock size={10} className="text-zinc-400" />
                </div>
              )}
            </div>
            <div>
              <p className={`text-xs font-bold mb-0.5 ${achievement.unlocked ? 'text-white' : 'text-zinc-400'}`}>
                {achievement.title}
              </p>
              {achievement.unlocked ? (
                <p className="text-[10px] text-zinc-500">{achievement.dateUnlocked}</p>
              ) : (
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden mx-auto">
                  <div 
                    className="h-full bg-yellow-500/50 rounded-full" 
                    style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Achievement Modal */}
      {selectedAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedAchievement(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-yellow-500/10 to-transparent rounded-t-2xl"></div>
            
            <div className={`w-24 h-24 mx-auto rounded-full ${selectedAchievement.bgColor} ${selectedAchievement.color} flex items-center justify-center mb-4 relative z-10 border-4 border-zinc-900 shadow-xl`}>
              <selectedAchievement.icon size={40} />
              {!selectedAchievement.unlocked && (
                <div className="absolute bottom-0 right-0 bg-zinc-800 rounded-full p-1.5 border-2 border-zinc-900 text-zinc-400">
                  <Lock size={14} />
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">{selectedAchievement.title}</h3>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{selectedAchievement.description}</p>
            
            <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className={selectedAchievement.unlocked ? 'text-yellow-500' : 'text-zinc-400'}>التقدم</span>
                <span className="text-white">{selectedAchievement.progress} / {selectedAchievement.maxProgress}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${selectedAchievement.unlocked ? 'bg-yellow-500' : 'bg-yellow-500/50'}`}
                  style={{ width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%` }}
                />
              </div>
              {selectedAchievement.unlocked && (
                <div className="mt-3 text-xs text-zinc-500 bg-zinc-900 py-1.5 rounded-lg border border-zinc-800">
                  تم فتح الوسام في: {selectedAchievement.dateUnlocked}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setSelectedAchievement(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
