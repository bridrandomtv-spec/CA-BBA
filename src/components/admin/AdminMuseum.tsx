// إدارة المتحف — ajout/édition/retrait des entrées de la mémoire du club.
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Landmark, Pencil, Trash2 } from 'lucide-react';

interface Entry { id: string; year: number; kind: string; title: string; body: string; imageUrl: string; position: number; }

const KIND_LABEL: Record<string, string> = { title: 'بطولة', legend: 'أسطورة', event: 'حدث' };

export default function AdminMuseum({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [year, setYear] = useState('');
  const [kind, setKind] = useState('event');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/museum', { credentials: 'same-origin' });
      if (res.ok) setEntries((await res.json()).entries ?? []);
    } catch (e) {
      console.error('[CABBA] museum load:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const reset = () => { setYear(''); setKind('event'); setTitle(''); setBody(''); setImageUrl(''); setEditId(null); };

  const submit = async () => {
    if (!year.trim() || !title.trim()) { setNotice('السنة والعنوان مطلوبان.'); return; }
    setBusy(true);
    try {
      const payload = { year: Number(year), kind, title: title.trim(), body: body.trim(), imageUrl: imageUrl.trim() };
      const res = editId
        ? await fetch(`/api/museum/${encodeURIComponent(editId)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/museum', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الحفظ');
      setNotice(editId ? 'تم تعديل الإدخال.' : 'تمت الإضافة إلى المتحف.');
      reset();
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: Entry) => {
    if (!window.confirm(`حذف « ${e.title} » من المتحف ؟`)) return;
    setBusy(true);
    try {
      await fetch(`/api/museum/${encodeURIComponent(e.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500";
  const label = "text-[11px] font-bold text-zinc-400 mb-1 block";

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400">{notice}</div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Landmark size={16} className="text-yellow-500" /> {editId ? 'تعديل إدخال' : 'إضافة إلى المتحف'}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className={label}>السنة</span>
            <input value={year} onChange={(e) => setYear(e.target.value)} type="number" placeholder="1981" className={input} />
          </label>
          <label className="block col-span-2">
            <span className={label}>النوع</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
              <option value="title" className="bg-zinc-900">بطولة</option>
              <option value="legend" className="bg-zinc-900">أسطورة</option>
              <option value="event" className="bg-zinc-900">حدث</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className={label}>العنوان</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="مثال : كأس الجزائر" className={input} />
        </label>
        <label className="block">
          <span className={label}>القصة</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3}
            placeholder="ما الذي حدث ولماذا لن يُنسى…" className={input} />
        </label>
        <label className="block">
          <span className={label}>صورة أرشيف (رابط، اختياري)</span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className={input} />
        </label>
        <div className="flex gap-2">
          <button onClick={() => void submit()} disabled={busy}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
            {editId ? 'حفظ التعديل' : '+ إضافة إلى الذاكرة'}
          </button>
          {editId && <button onClick={reset} className="px-4 bg-zinc-800 text-zinc-300 text-sm rounded-xl">إلغاء</button>}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-96 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">المتحف فارغ — اكتب أول صفحة من تاريخ النادي</p>
        ) : entries.map((e) => (
          <div key={e.id} className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <span className="text-yellow-500 font-black text-sm w-12 flex-shrink-0">{e.year}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{e.title}</p>
              <p className="text-[10px] text-zinc-500">{KIND_LABEL[e.kind] ?? e.kind}</p>
            </div>
            <button onClick={() => { setEditId(e.id); setYear(String(e.year)); setKind(e.kind); setTitle(e.title); setBody(e.body); setImageUrl(e.imageUrl); }}
              aria-label="تعديل" className="text-zinc-500 hover:text-white p-1"><Pencil size={14} /></button>
            <button onClick={() => void remove(e)} disabled={busy} aria-label="حذف" className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
