import { ArrowRight, Trophy, History, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { useState } from 'react';

// Use the placeholder images we just generated
const historicalImages = [
  {
    id: 1,
    url: 'https://images.unsplash.com/photo-1518605368461-1e1e38ce7058?auto=format&fit=crop&q=80&w=800',
    title: 'تأسيس النادي',
    description: 'صورة تاريخية للفريق الأول بعد تأسيس نادي أهلي برج بوعريريج عام 1931.',
    year: '1931'
  },
  {
    id: 2,
    url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=800',
    title: 'فرحة التتويج',
    description: 'احتفالات الجراد الأصفر بالصعود وتحقيق إنجازات تاريخية.',
    year: '1998'
  },
  {
    id: 3,
    url: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=80&w=800',
    title: 'الجراد الأصفر',
    description: 'أنصار النادي الأوفياء يزينون المدرجات باللونين الأصفر والأسود.',
    year: '1990'
  }
];

const timelineEvents = [
  {
    year: '1931',
    title: 'تأسيس النادي',
    description: 'تأسس النادي الرياضي أهلي برج بوعريريج (CABBA) ليصبح واحداً من أعرق الأندية في المنطقة.',
    icon: History
  },
  {
    year: '1998',
    title: 'الصعود للقسم الأول',
    description: 'تاريخ حافل بمحاولات الصعود ومواسم لا تنسى في الذاكرة الكروية البرايجية.',
    icon: Trophy
  },
  {
    year: '2001',
    title: 'إنجازات قارية',
    description: 'المشاركة التاريخية في البطولات العربية و تمثيل الجزائر أحسن تمثيل.',
    icon: Trophy
  },
  {
    year: '2009',
    title: 'نهائي كأس الجمهورية',
    description: 'الوصول لنهائي كأس الجمهورية في مسيرة بطولية لا تُنسى في تاريخ النادي.',
    icon: Trophy
  }
];

export default function ClubHistory({ onBack }: { onBack: () => void }) {
  const [activeImage, setActiveImage] = useState<number | null>(null);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" dir="rtl">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
            <History size={20} />
          </div>
          <div>
            <h2 className="font-bold text-white">تاريخ النادي</h2>
            <p className="text-[10px] text-zinc-400">عراقة وأمجاد الجراد الأصفر</p>
          </div>
        </div>
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowRight size={20} />
        </button>
      </div>

      <div className="p-4 space-y-8 pb-20">
        
        {/* Intro */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
           <div className="relative z-10">
               <h3 className="text-xl font-black text-white mb-3">شباب أهلي برج بوعريريج</h3>
               <p className="text-sm text-zinc-400 leading-relaxed">
                   نادي أهلي برج بوعريريج (CABBA) تأسس عام 1931، يعتبر من أعرق الأندية الجزائرية. 
                   يتميز بقاعدته الجماهيرية العريضة المعروفة بـ "الجراد الأصفر".
               </p>
           </div>
        </div>

        {/* Timeline */}
        <div>
            <div className="flex items-center gap-2 mb-6">
                <History className="text-yellow-500" size={20} />
                <h3 className="font-bold text-white text-lg">أهم المحطات</h3>
            </div>
            
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                {timelineEvents.map((event, index) => (
                    <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-zinc-950 bg-zinc-900 text-yellow-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                            <event.icon size={16} />
                        </div>
                        
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm group-hover:border-yellow-500/30 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="font-bold text-white text-sm">{event.title}</h4>
                                <span className="text-xs font-black text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">{event.year}</span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">{event.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Historic Gallery */}
        <div>
            <div className="flex items-center gap-2 mb-6">
                <ImageIcon className="text-yellow-500" size={20} />
                <h3 className="font-bold text-white text-lg">معرض الصور التاريخي</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historicalImages.map((img) => (
                    <div key={img.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group cursor-pointer" onClick={() => setActiveImage(img.id)}>
                        <div className="aspect-[4/3] relative overflow-hidden">
                            <img src={img.url} alt={img.title} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-yellow-500 text-[10px] font-bold px-2 py-1 rounded">
                                {img.year}
                            </div>
                        </div>
                        <div className="p-4">
                            <h4 className="font-bold text-white text-sm mb-1">{img.title}</h4>
                            <p className="text-xs text-zinc-400 line-clamp-2">{img.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {activeImage !== null && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-300">
              <div className="p-4 flex justify-end">
                 <button 
                    onClick={() => setActiveImage(null)}
                    className="w-10 h-10 bg-zinc-800/50 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 transition-colors"
                 >
                    <ArrowRight size={20} />
                 </button>
              </div>
              <div className="flex-1 flex flex-col justify-center p-4">
                  {historicalImages.find(img => img.id === activeImage) && (
                      <>
                        <img 
                            src={historicalImages.find(img => img.id === activeImage)?.url} 
                            className="w-full max-h-[70vh] object-contain rounded-lg shadow-2xl" 
                            alt="Historical moment" 
                        />
                        <div className="mt-6 text-center text-white">
                            <h3 className="text-xl font-bold mb-2">{historicalImages.find(img => img.id === activeImage)?.title}</h3>
                            <p className="text-sm text-zinc-400">{historicalImages.find(img => img.id === activeImage)?.description}</p>
                            <span className="inline-block mt-4 text-xs font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
                                {historicalImages.find(img => img.id === activeImage)?.year}
                            </span>
                        </div>
                      </>
                  )}
              </div>
          </div>
      )}

    </div>
  );
}
