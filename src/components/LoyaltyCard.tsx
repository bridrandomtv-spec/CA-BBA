// وفاء الجراد — carte de fidélité du profil : points, palier,
// progression, derniers gains et top des plus fidèles.
import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';

interface Me {
  points: number;
  tier: { key: string; label: string; min: number };
  tiers: Array<{ key: string; label: string; min: number }>;
  recent: Array<{ delta: number; reason: string; at: string }>;
}

const REASON: Record<string, string> = {
  scan: 'حضور في الملعب (scan)',
  order: 'طلب مؤكد من المتجر',
  prediction: 'توقع صحيح',
  admin: 'منحة الإدارة',
};

export default function LoyaltyCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [top, setTop] = useState<Array<{ name: string; points: number }>>([]);

  useEffect(() => {
    fetch('/api/loyalty/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => setMe(null));
    fetch('/api/loyalty/top', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTop(d?.top ?? []))
      .catch(() => setTop([]));
  }, []);

  if (!me) return null;

  const next = me.tiers.find((t) => t.min > me.points);
  const pct = next ? Math.min(100, Math.round((me.points / next.min) * 100)) : 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
          <Award size={18} className="text-yellow-500" /> وفاء الجراد
        </h3>
        <span className="text-xs font-black text-black bg-yellow-500 px-3 py-1 rounded-full">
          {me.tier.label} · {me.points} نقطة
        </span>
      </div>

      {next && (
        <div className="mb-3">
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-gradient-to-l from-yellow-500 to-yellow-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            باقي {next.min - me.points} نقطة إلى palier {next.label} — تُكسب بالحضور في الملعب، الشراء من المتجر، والتوقعات الصحيحة
          </p>
        </div>
      )}

      {me.recent.length > 0 && (
        <div className="space-y-1 mb-3">
          {me.recent.slice(0, 4).map((r, i) => (
            <div key={i} className="flex justify-between text-[11px] bg-zinc-950/60 rounded-lg px-3 py-1.5">
              <span className="text-zinc-400">{REASON[r.reason] ?? r.reason}</span>
              <span className={r.delta >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {r.delta >= 0 ? '+' : ''}{r.delta}
              </span>
            </div>
          ))}
        </div>
      )}

      {top.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-zinc-400 mb-1">أكثر الأنصار وفاءً</p>
          <div className="flex flex-wrap gap-1">
            {top.slice(0, 3).map((t, i) => (
              <span key={i} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                {t.name} · {t.points}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
