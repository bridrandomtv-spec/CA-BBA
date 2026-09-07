import { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { GitCompare, User } from 'lucide-react';

export default function PlayerComparison() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <GitCompare size={16} className="text-yellow-500" />
          مقارنة اللاعبين
        </h3>
        
        <div className="text-center text-zinc-500 py-10 border border-zinc-800 border-dashed rounded-xl text-sm font-bold">
          بيانات اللاعبين غير متوفرة حالياً
        </div>
      </div>
    </div>
  );
}
