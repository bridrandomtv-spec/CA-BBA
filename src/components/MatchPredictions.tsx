import { Target, Trophy, Info } from 'lucide-react';

export default function MatchPredictions() {
  return (
    <div className="space-y-4">
      {/* Prediction Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
        
        <div className="relative z-10 flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
            <Target size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">توقع النتيجة</h3>
            <p className="text-xs text-zinc-400">اربح 50 نقطة للتوقع الصحيح</p>
          </div>
        </div>
        
        <div className="relative z-10 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 text-center">
            <Info size={32} className="text-yellow-500 mx-auto mb-3" />
            <h4 className="font-bold text-white mb-2">النظام قيد التطوير</h4>
            <p className="text-sm text-zinc-400">نظام التوقعات المرتبط بقاعدة البيانات سيكون متاحاً قريباً جداً.</p>
        </div>
      </div>
      
      {/* Leaderboard Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
                <Trophy size={20} />
              </div>
              <h3 className="font-bold text-white text-md">لوحة الصدارة</h3>
            </div>
        </div>
        
        <div className="relative z-10 bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-500">لا توجد بيانات حالياً. سيتم تفعيل لوحة الصدارة مع إطلاق التوقعات.</p>
        </div>
      </div>
    </div>
  );
}
