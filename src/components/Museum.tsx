// المتحف — mémoire officielle du club : frise chronologique publique.
// Titres, légendes, événements : ce qui fait qu'on est du CABBA.
import { useEffect, useState } from 'react';
import { Landmark, Medal, ScrollText, Star } from 'lucide-react';

interface Entry { id: string; year: number; kind: string; title: string; body: string; imageUrl: string; }

const KIND: Record<string, { label: string; cls: string; Icon: typeof Medal }> = {
  title: { label: 'بطولة', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', Icon: Medal },
  legend: { label: 'أسطورة', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30', Icon: Star },
  event: { label: 'حدث', cls: 'bg-zinc-800 text-zinc-300 border-zinc-700', Icon: ScrollText },
};

export default function Museum() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/museum', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEntries(d?.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-yellow-500 flex items-center justify-center flex-shrink-0">
          <Landmark size={24} className="text-black" />
        </div>
        <div>
          <h2 className="text-white font-black text-lg">متحف النادي</h2>
          <p className="text-zinc-500 text-[11px]">ذاكرة شباب أهلي برج بوعريريج — منذ 1931</p>
        </div>
      </div>

      {!loaded ? (
        <p className="text-center text-zinc-600 text-xs py-8">جاري التحميل…</p>
      ) : entries.length === 0 ? (
        <div className="text-center text-zinc-600 text-xs py-8 border border-zinc-800 border-dashed rounded-2xl">
          المتحف يُبنى : الإدارة تضيف البطولات والأساطير من لوحة الإدارة
        </div>
      ) : (
        <div className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:right-[7px] before:w-px before:bg-zinc-800">
          {entries.map((e) => {
            const k = KIND[e.kind] ?? KIND.event;
            const Icon = k.Icon;
            return (
              <div key={e.id} className="relative pr-6">
                <span className="absolute right-0 top-2 w-[15px] h-[15px] rounded-full bg-zinc-950 border-2 border-yellow-500" />
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-500 font-black text-lg">{e.year}</span>
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-bold ${k.cls}`}>
                      <Icon size={11} /> {k.label}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-sm">{e.title}</h3>
                  {e.body && <p className="text-zinc-400 text-xs leading-relaxed mt-1">{e.body}</p>}
                  {e.imageUrl && (
                    <img src={e.imageUrl} alt={e.title} loading="lazy"
                      className="mt-3 rounded-xl border border-zinc-800 w-full object-cover max-h-52"
                      onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
