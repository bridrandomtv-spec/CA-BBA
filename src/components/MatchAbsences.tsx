import { AlertCircle, Stethoscope, Square } from 'lucide-react';

export default function MatchAbsences() {
  const absences = [
    { id: 1, name: 'رياض. م', number: '7', reason: 'إصابة في العضلة الخلفية', type: 'injury', returnDate: 'أسبوعين' },
    { id: 2, name: 'سعيد. ب', number: '22', reason: 'تراكم البطاقات', type: 'suspension', returnDate: 'مباراة واحدة' },
    { id: 3, name: 'أسامة. ت', number: '4', reason: 'التواء في الكاحل', type: 'injury', returnDate: 'أسبوع' }
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
          <AlertCircle size={20} />
        </div>
        <div>
          <h3 className="font-bold text-white text-md">تقرير الغيابات</h3>
          <p className="text-[10px] text-zinc-400">الإصابات والعقوبات للمباراة القادمة</p>
        </div>
      </div>

      <div className="space-y-3">
        {absences.map((player) => (
          <div key={player.id} className="flex flex-col bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${player.type === 'injury' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                  {player.number}
                </div>
                <span className="font-bold text-white text-sm">{player.name}</span>
              </div>
              <div className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${player.type === 'injury' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                {player.type === 'injury' ? <Stethoscope size={10} /> : <Square size={10} className="fill-current text-yellow-500" />}
                {player.type === 'injury' ? 'إصابة' : 'إيقاف'}
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-zinc-400">
              <span>{player.reason}</span>
              <span>العودة: {player.returnDate}</span>
            </div>
          </div>
        ))}
        {absences.length === 0 && (
          <div className="text-center py-4 text-zinc-500 text-xs">
            لا توجد غيابات مسجلة لهذه المباراة
          </div>
        )}
      </div>
    </div>
  );
}
