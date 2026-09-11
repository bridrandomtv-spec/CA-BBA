// وفاء الجراد — côté admin : classement des plus fidèles et gestes
// de points (animation de match, geste commercial, compensation).
import { useCallback, useEffect, useState } from 'react';
import { Award, ChevronRight, Plus } from 'lucide-react';

export default function AdminLoyalty({ onBack }: { onBack: () => void }) {
  const [top, setTop] = useState<Array<{ name: string; points: number }>>([]);
  const [email, setEmail] = useState('');
  const [delta, setDelta] = useState('20');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/loyalty/top', { credentials: 'same-origin' });
      if (res.ok) setTop((await res.json()).top ?? []);
    } catch (e) {
      console.error('[CABBA] loyalty top:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const grant = async () => {
    const d = Number(delta);
    if (!email.trim() || !Number.isInteger(d) || d === 0) { setNotice('بريد وعدد نقاط صحيح غير صفري مطلوبان.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/loyalty/grant', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), delta: d, reason: reason.trim() || 'geste admin' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر المنح');
      setNotice(`تم المنح — الرصيد الجديد : ${data.points} نقطة.`);
      setEmail(''); setReason('');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر المنح');
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
          <Plus size={16} className="text-emerald-500" /> منح نقاط وفاء
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>بريد الأنصار</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="supporter@example.com" className={input} />
          </label>
          <label className="block">
            <span className={label}>النقاط (سالبة للسحب)</span>
            <input value={delta} onChange={(e) => setDelta(e.target.value)} type="number" className={input} />
          </label>
        </div>
        <label className="block">
          <span className={label}>السبب (اختياري)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={60} placeholder="مثال : مسابقة مدرجات الديربي" className={input} />
        </label>
        <button onClick={() => void grant()} disabled={busy}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
          منح النقاط
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
          <Award size={16} className="text-yellow-500" /> أكثر الأنصار وفاءً
        </h3>
        {top.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">لا نقاط بعد — أول scan وأول commande ouvriront le classement</p>
        ) : top.map((t, i) => (
          <div key={i} className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <span className="text-white text-sm font-bold">{i + 1}. {t.name}</span>
            <span className="text-yellow-400 text-xs font-black">{t.points} نقطة</span>
          </div>
        ))}
      </div>
    </div>
  );
}
