// إدارة شركاء النادي — création, édition, activation, retrait.
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Handshake, Pencil, Trash2 } from 'lucide-react';
import { Handshake } from 'lucide-react';

interface Sponsor { id: string; name: string; url: string; logoUrl: string; coverUrl: string; videoUrl: string; position: number; active: boolean; }

function LogoThumb({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(!src);
  useEffect(() => { setBroken(!src); }, [src]);
  if (broken) {
    return (
      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
        <Handshake size={16} className="text-amber-500" />
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setBroken(true)} className="w-10 h-10 object-contain rounded-lg bg-white p-1 flex-shrink-0" />;
}

export default function AdminSponsors({ onBack }: { onBack: () => void }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [position, setPosition] = useState('100');
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sponsors/admin', { credentials: 'same-origin' });
      if (res.ok) setSponsors((await res.json()).sponsors ?? []);
    } catch (e) {
      console.error('[CABBA] sponsors load:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const submit = async () => {
    if (!name.trim()) { setNotice('الاسم مطلوب.'); return; }
    setBusy(true);
    try {
      const body = { name: name.trim(), url: url.trim(), logoUrl: logoUrl.trim(), coverUrl: coverUrl.trim(), videoUrl: videoUrl.trim(), position: Number(position) || 100, active };
      const res = editId
        ? await fetch(`/api/sponsors/${encodeURIComponent(editId)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/sponsors', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الحفظ');
      setNotice(editId ? 'تم تعديل الشريك.' : 'تمت إضافة الشريك — سيظهر على Accueil.');
      setName(''); setUrl(''); setLogoUrl(''); setPosition('100'); setActive(true); setEditId(null);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: Sponsor) => {
    setBusy(true);
    try {
      await fetch(`/api/sponsors/${encodeURIComponent(s.id)}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !s.active }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Sponsor) => {
    if (!window.confirm(`حذف الشريك ${s.name} ؟`)) return;
    setBusy(true);
    try {
      await fetch(`/api/sponsors/${encodeURIComponent(s.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500";
  const label = "text-[11px] font-bold text-zinc-400 mb-1 block";

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-amber-500/10 border-amber-500/30 text-amber-400">{notice}</div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Handshake size={16} className="text-amber-500" /> {editId ? 'تعديل شريك' : 'إضافة شريك'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>اسم الشريك</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="مثال : مقهى الجراد" className={input} />
          </label>
          <label className="block">
            <span className={label}>ترتيب العرض</span>
            <input value={position} onChange={(e) => setPosition(e.target.value)} type="number" className={input} />
          </label>
        </div>
        <label className="block">
          <span className={label}>رابط الشعار (صورة)</span>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" className={input} />

            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="رابط صورة الغلاف https://… (اختياري)" className={input} />

            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="رابط فيديو promo YouTube https://youtube.com/watch?v=… (اختياري)" className={input} />
        </label>
        <label className="block">
          <span className={label}>موقع الشريك (اختياري)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={input} />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-amber-500" />
          نشط (ظاهر على الصفحة الرئيسية)
        </label>
        <div className="flex gap-2">
          <button onClick={() => void submit()} disabled={busy}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
            {editId ? 'حفظ التعديل' : '+ إضافة الشريك'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setName(''); setUrl(''); setLogoUrl(''); setPosition('100'); setActive(true); }}
              className="px-4 bg-zinc-800 text-zinc-300 text-sm rounded-xl">إلغاء</button>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
        {sponsors.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">لا شركاء بعد — أضف أول مموّل للنادي</p>
        ) : sponsors.map((s) => (
          <div key={s.id} className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <LogoThumb src={s.logoUrl} name={s.name} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{s.name}</p>
              <p className="text-[10px] text-zinc-500">ترتيب {s.position}</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded font-bold ${s.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {s.active ? 'نشط' : 'موقوف'}
            </span>
            <button onClick={() => void toggle(s)} disabled={busy} aria-label="تبديل النشاط"
              className="text-zinc-500 hover:text-white p-1 text-[10px] font-bold">{s.active ? 'إيقاف' : 'تفعيل'}</button>
            <button onClick={() => { setEditId(s.id); setName(s.name); setUrl(s.url); setLogoUrl(s.logoUrl); setCoverUrl(s.coverUrl || ''); setVideoUrl(s.videoUrl || ''); setPosition(String(s.position)); setActive(s.active); }}
              aria-label="تعديل" className="text-zinc-500 hover:text-white p-1"><Pencil size={14} /></button>
            <button onClick={() => void remove(s)} disabled={busy} aria-label="حذف" className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
