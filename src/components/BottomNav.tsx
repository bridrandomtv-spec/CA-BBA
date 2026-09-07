import { Home, Activity, Tv, ShoppingCart, User, Music, Users } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'match', label: 'المباريات', icon: Activity },
    { id: 'community', label: 'المجتمع', icon: Users },
    { id: 'chants', label: 'الأهازيج', icon: Music },
    { id: 'tv', label: 'كابا TV', icon: Tv },
    { id: 'store', label: 'المتجر', icon: ShoppingCart },
    { id: 'profile', label: 'العضوية', icon: User },
  ];

  return (
    <nav className="flex-none bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 pb-safe">
      <div className="flex items-center justify-around p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as Tab)}
              className={`flex flex-col items-center justify-center flex-1 h-14 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'text-yellow-500' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <div className={`relative ${isActive ? 'translate-y-[-2px]' : ''} transition-transform`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,1)]"></span>
                )}
              </div>
              <span className={`text-[10px] mt-1.5 font-medium ${isActive ? 'opacity-100 font-bold' : 'opacity-70'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
