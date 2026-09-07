import { useState, useEffect } from 'react';
import { CreditCard, Activity, Users, ChevronLeft, Check, ChevronRight } from 'lucide-react';

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export default function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'fan-card',
      icon: CreditCard,
      title: 'بطاقة المشجع الرقمية',
      description: 'احصل على بطاقتك الخاصة، اجمع النقاط عبر حضور المباريات وتفاعل في التطبيق للارتقاء في مستويات المشجعين.',
      image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
      id: 'match-updates',
      icon: Activity,
      title: 'تحديثات المباريات المباشرة',
      description: 'تابع أحداث المباريات لحظة بلحظة، إحصائيات الفريق، التشكيلة، وملخصات الفيديو الحصرية أولاً بأول.',
      image: 'https://images.unsplash.com/photo-1518605368461-1ee125225026?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
      id: 'community',
      icon: Users,
      title: 'مجتمع الجراد الأصفر',
      description: 'شارك آراءك، توقع نتائج المباريات، وتواصل مع آلاف المشجعين في مجتمع خاص بعشاق أهلي البرج.',
      image: 'https://images.unsplash.com/photo-1614632537190-23e4146777db?auto=format&fit=crop&q=80&w=800&h=600'
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(s => s - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col justify-between" dir="rtl">
      {/* Decorative top shape */}
      <div className="absolute top-0 left-0 w-full h-64 bg-yellow-500/10 blur-[100px] rounded-full -translate-y-1/2"></div>
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full overflow-hidden">
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          const isActive = index === currentSlide;
          const isPrev = index < currentSlide;
          
          return (
            <div 
              key={slide.id}
              className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-all duration-500 ease-in-out ${
                isActive ? 'opacity-100 translate-x-0' : 
                isPrev ? 'opacity-0 translate-x-full' : 'opacity-0 -translate-x-full'
              }`}
            >
              <div className="w-full max-w-sm aspect-[4/3] rounded-3xl overflow-hidden mb-8 relative shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-zinc-800">
                <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-yellow-500 text-black flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                    <Icon size={32} />
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4 max-w-sm">
                <h2 className="text-2xl font-black text-white">{slide.title}</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">{slide.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Navigation & Controls */}
      <div className="p-8 pb-12 relative z-10">
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <div 
              key={index} 
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide ? 'w-8 bg-yellow-500' : 'w-2 bg-zinc-800'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button 
            onClick={onComplete}
            className="text-zinc-500 font-bold text-sm px-4 py-2"
          >
            تخطي
          </button>
          
          <div className="flex items-center gap-3">
            {currentSlide > 0 && (
              <button 
                onClick={handlePrev}
                className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            )}
            <button 
              onClick={handleNext}
              className="w-14 h-14 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-105 transition-transform"
            >
              {currentSlide === slides.length - 1 ? <Check size={24} className="stroke-[3]" /> : <ChevronLeft size={24} className="stroke-[3]" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
