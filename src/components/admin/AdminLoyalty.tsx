// وفاء الجراد — côté admin : classement des plus fidèles et gratifications
// manuelles (animation de match, geste commercial, compensation).
// Contrat serveur (main) :
//   GET  /api/loyalty/top   -> { top: [{ userId, name, total, tier }] }
//   POST /api/loyalty/grant -> { userId, delta, reason }  (requireAdmin)
import { useCallback, useEffect, useState } from 'react';
import { Award, ArrowRight, Plus, Medal } from 'lucide-react';

interface TopFan { userId: string; name: string; total: number; tier: string; }

const tierStyle = (t: string): string => {
  if (!t) return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  if (t.includes('ذهب')) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40';
  if (t.includes('فض')) return 'bg-zinc-400/10 text-zinc-300 border-zinc-400/30';
  if (t.includes('برون')) return 'bg-amber-700/20 text-amber-500 border-amber-700/40';
  return 'bg-zinc-800 text-zinc-400 border-zinc-700';
};

export default function AdminLoyalty({ onBack }: { onBack: () => void }) {
  const [top, setTop] = useState<TopFan[]>([]);
  const [userId, setUserId] = useState('');
  const [delta, setDelta] = useState('20');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
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
    const d = parseInt(delta, 10);
    if (!userId.trim() || !Number.isInteger(d) || d === 0 || Math.abs(d) > 1000) {
      setNotice({ kind: 'err', text: 'معرف المستخدم صحيح وعدد نقاط بين -1000 و 1000 (≠ 0) مطلوبان.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/loyalty/grant', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), delta: d, reason: reason.trim() || 'grant admin' }),
      });
      if (res.ok) {
        setNotice({ kind: 'ok', text: `تم منح ${d} نقطة ✓` });
        setReason('');
        void load();
      } else {
        const b = await res.json().catch(() => ({}));
        setNotice({ kind: 'err', text: (b && b.error) || 'رفض الخادم العملية.' });
      }
    } catch {
      setNotice({ kind: 'err', text: 'تعذر الوصول إلى الخادم.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Award size={20} className="text-yellow-500" />
          </div>
          <div>
            <h3 className="font-bold text-white">نقاط الوفاء</h3>
            <p className="text-xs text-zinc-400">ترتيب أوفياء الجراد ومنح النقاط يدوياً</p>
          </div>
        </div>
        <button onClick={onBack} className="p-2 bg-zinc-800 text-zinc-300 rounded-full hover:text-white">
          <ArrowRight size={18} />
        </button>
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl border text-sm font-bold ${
            notice.kind === 'ok'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
          <Medal size={16} className="text-yellow-500" /> أفضل 10 أنصار
        </h4>
        {top.length === 0 && <p className="text-zinc-500 text-sm">لا توجد نقاط بعد — ستُملأ القائمة مع أول مسح عند الباب.</p>}
        <div className="space-y-2">
          {top.map((fan, i) => (
            <div key={fan.userId} className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              <span className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm truncate">{fan.name}</div>
                <div className="text-xs text-zinc-500">{fan.total} نقطة</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${tierStyle(fan.tier)}`}>{fan.tier || '—'}</span>
              <button
                onClick={() => { setUserId(fan.userId); setNotice(null); }}
                className="p-2 bg-zinc-800 text-yellow-500 rounded-lg hover:bg-yellow-500 hover:text-black"
                title="منح نقاط لهذا المناصر"
              >
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h4 className="font-bold text-white text-sm">منح / خصم نقاط</h4>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="معرف المستخدم (UUID)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
          dir="ltr"
        />
        <div className="flex gap-2">
          <input
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            type="number"
            className="w-28 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
            dir="ltr"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="السبب (animation derby, geste commercial…)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
          />
        </div>
        <button
          onClick={grant}
          disabled={busy}
          className="w-full bg-yellow-500 text-black font-bold p-3 rounded-xl disabled:opacity-50"
        >
          {busy ? 'جاري المنح...' : 'تأكيد العملية'}
        </button>
        <p className="text-[11px] text-zinc-500">كل عملية تُسجَّل في ledger النقاط وتظهر في سجل التدقيق باسم الإداري.</p>
      </div>
    </div>
  );
}
