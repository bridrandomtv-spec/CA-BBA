// شركاء النادي — vitrine des sponsors actifs sur l'accueil.
// 1. Grille pleine largeur : plus de vide à gauche en RTL ;
// 2. Logo avec repli SVG : jamais d'image cassée ni de trou invisible ;
// 3. Fiche partenaire en modale : image de couverture + vidéo de promo
//    YouTube + lien du site — la vitrine devient un écran de vente.
import { useEffect, useState } from 'react';
import { Handshake, ExternalLink, X, Play } from 'lucide-react';

interface Sponsor {
  id: string;
  name: string;
  url: string;
  logoUrl: string;
  coverUrl?: string;
  videoUrl?: string;
}

const ytId = (u: string): string | null => {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

function SponsorLogo({ src, name, size }: { src: string; name: string; size: 'sm' | 'lg' }) {
  const [broken, setBroken] = useState(!src);
  useEffect(() => { setBroken(!src); }, [src]);
  const cls = size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';
  if (broken) {
    return (
      <div className={`${cls} rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center`}>
        <Handshake size={size === 'sm' ? 20 : 26} className="text-amber-500" />
      </div>
    );
  }
  return (
    <img src={src} alt={name} loading="lazy" onError={() => setBroken(true)}
      className={`${cls} object-contain rounded-lg bg-white p-1`} />
  );
}

function SponsorCard({ s, onClose }: { s: Sponsor; onClose: () => void }) {
  const [coverBroken, setCoverBroken] = useState(!s.coverUrl);
  const video = s.videoUrl ? ytId(s.videoUrl) : null;
  // Vidéo Facebook publique : intégrée via le plugin officiel (iframe),
  // car un lien share/facebook ne se lit pas comme un fichier direct.
  const fbVideoUrl = s.videoUrl && !video && /(?:facebook\.com|fb\.watch)/.test(s.videoUrl) ? s.videoUrl : null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" dir="rtl" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-t-3xl md:rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {coverBroken ? (
            <div className="w-full aspect-video bg-gradient-to-br from-amber-500/20 via-zinc-900 to-black flex items-center justify-center">
              <Handshake size={44} className="text-amber-500/60" />
            </div>
          ) : (
            <img src={s.coverUrl} alt={s.name} onError={() => setCoverBroken(true)} className="w-full aspect-video object-cover" />
          )}
          <button onClick={onClose} aria-label="إغلاق"
            className="absolute top-3 left-3 p-2 bg-black/60 text-zinc-200 rounded-full hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 -mt-10 relative">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 shadow-lg">
              <SponsorLogo src={s.logoUrl} name={s.name} size="lg" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{s.name}</h3>
              <p className="text-[10px] text-amber-500 font-bold">شريك النادي</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-300 flex items-center gap-2 mb-2">
              <Play size={14} className="text-amber-500" /> فيديو promo
            </p>
            {video ? (
              <iframe
                src={`https://www.youtube.com/embed/${video}`}
                title={`فيديو ${s.name}`}
                className="w-full aspect-video rounded-xl border border-zinc-800"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : fbVideoUrl ? (
              <iframe
                src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fbVideoUrl)}&show_text=false&width=560`}
                title={`فيديو ${s.name}`}
                className="w-full aspect-video rounded-xl border border-zinc-800"
                allow="autoplay; clipboard-write; picture-in-picture; encrypted-media"
                allowFullScreen
              />
            ) : (
              <div className="w-full aspect-video rounded-xl border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 text-xs text-center px-4">
                لا يوجد فيديو promo — أضف رابط YouTube أو رابط Facebook عام من لوحة الإدارة
              </div>
            )}
          </div>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer"
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <ExternalLink size={16} /> زيارة موقع الشريك
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SponsorsStrip() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<Sponsor | null>(null);

  useEffect(() => {
    fetch('/api/sponsors', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSponsors(d?.sponsors ?? []))
      .catch(() => setSponsors([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || sponsors.length === 0) return null;

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3">
          <Handshake size={16} className="text-amber-500" /> شركاء النادي
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {sponsors.map((s) => (
            <button key={s.id} onClick={() => setOpen(s)}
              className="bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-2.5 flex flex-col items-center gap-2 transition-colors">
              <SponsorLogo src={s.logoUrl} name={s.name} size="sm" />
              <p className="text-[10px] text-zinc-300 font-bold text-center line-clamp-2 w-full">{s.name}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">اضغط على شريك لعرض الغلاف وفيديو promo.</p>
      </div>
      {open && <SponsorCard s={open} onClose={() => setOpen(null)} />}
    </>
  );
}
