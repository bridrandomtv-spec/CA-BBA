// شركاء النادي — vitrine des sponsors actifs sur l'accueil.
// Logos par URL : le club héberge ses visuels où il veut.
import { useEffect, useState } from 'react';
import { Handshake } from 'lucide-react';

interface Sponsor { id: string; name: string; url: string; logoUrl: string; }

export default function SponsorsStrip() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/sponsors', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSponsors(d?.sponsors ?? []))
      .catch(() => setSponsors([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || sponsors.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3">
        <Handshake size={16} className="text-amber-500" /> شركاء النادي
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {sponsors.map((s) => {
          const card = (
            <div className="flex-shrink-0 w-24 bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex flex-col items-center gap-2">
              <img src={s.logoUrl} alt={s.name} loading="lazy"
                className="w-14 h-14 object-contain rounded-lg bg-white p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
              <p className="text-[10px] text-zinc-300 font-bold text-center line-clamp-2">{s.name}</p>
            </div>
          );
          return s.url ? (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{card}</a>
          ) : (
            <div key={s.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
