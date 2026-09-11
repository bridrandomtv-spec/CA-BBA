// fidélité du Jarrad — solde, palier et derniers gains du supporter.
import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';

interface Entry { delta: number; reason: string; ref: string; at: string; }

const TIER: Record<string, { label: string; cls: string }> = {
  bronze: { label: 'برونزي', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  silver: { label: 'فضي', cls: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30' },
  gold: { label: 'ذهبي', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
};
const REASON: Record<string, string> = {
  scan: 'حضور بالبوابة', order: 'طلب من المتجر', prediction: 'توقع صحيح', grant: 'منحة الإدارة',
};

export default function LoyaltyCard() {
  const [total, setTotal] = useState(0);
  const [tier, setTier] = useState('bronze');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/loyalty/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setTotal(d.total); setTier(d.tier); setEntries(d.entries ?? []); } })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  const t = TIER[tier] ?? TIER.bronze;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
          <Award size={18} className="text-yellow-500" /> نقاط الوفاء
        </h3>
        <span className={`text-xs px-2 py-1 rounded-md border font-bold ${t.cls}`}>{t.label}</span>
      </div>
      <p className="text-yellow-400 font-black text-3xl">{total.toLocaleString('ar-DZ')}</p>
      <p className="text-[10px] text-zinc-500 mt-1">
        اكسب نقاطك : حضور بالبوابة (+5) · طلب من المتجر (+10) · توقع صحيح (+20)
      </p>
      {entries.length > 0 && (
        <div className="mt-3 space-y-1">
          {entries.slice(0, 3).map((e, i) => (
            <div key={i} className="flex justify-between text-[11px] bg-zinc-950/60 rounded-lg px-3 py-1.5">
              <span className="text-zinc-400">{REASON[e.reason] ?? e.reason}</span>
              <span className={e.delta > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {e.delta > 0 ? `+${e.delta}` : e.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
