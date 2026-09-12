// المدفوعات والتحصيل — file de validation des déclarations CCP/BaridiMob.
import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, CreditCard, Landmark, X } from 'lucide-react';

interface Payment {
  id: string; kind: string; refId: string; method: string; bankRef: string;
  amount: number; status: string; payerName: string; payerEmail: string | null;
  orderStatus: string | null; at: string; checkedAt: string | null;
}

const KIND: Record<string, string> = { order: 'طلب متجر', donation: 'تبرع صندوق', ticket: 'تذكرة' };
const METHOD: Record<string, string> = { ccp: 'CCP / BaridiMob', cash: 'نقداً', cod_cib: 'CIB عند التسليم' };

export default function AdminPayments({ onBack }: { onBack: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ccp, setCcp] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/admin', { credentials: 'same-origin' });
      if (res.ok) setPayments((await res.json()).payments ?? []);
    } catch (e) {
      console.error('[CABBA] payments load:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/payments/config', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => cfg && setCcp(cfg.ccp ?? ''))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const act = async (p: Payment, action: 'confirm' | 'reject') => {
    if (action === 'reject' && !window.confirm(`رفض تصريح الدفع بمبلغ ${p.amount} د.ج ؟`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(p.id)}/${action}`, { method: 'POST', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الإجراء');
      setNotice(action === 'confirm' ? 'تم تأكيد الدفع — الطلب مؤكد والمشتري مُخطَر.' : 'تم رفض التصريح.');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإجراء');
    } finally {
      setBusy(false);
    }
  };

  const pending = payments.filter((p) => p.status === 'pending');
  const done = payments.filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400">{notice}</div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
          <Landmark size={20} className="text-yellow-500" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-bold">حساب النادي (CCP)</p>
          <p className="text-[11px] text-zinc-400 font-mono">{ccp || 'غير مُعرّف — أضف CLUB_CCP في .env'}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <CreditCard size={16} className="text-cyan-400" /> بانتظار التحقق ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">لا تصريحات معلّقة — كل شيء محصّل</p>
        ) : pending.map((p) => (
          <div key={p.id} className="bg-zinc-950/60 border border-yellow-500/20 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold">
                  {KIND[p.kind] ?? p.kind} · {p.amount.toLocaleString('ar-DZ')} د.ج
                </p>
                <p className="text-[10px] text-zinc-500">
                  {METHOD[p.method] ?? p.method}
                  {p.bankRef ? ` · مرجع : ${p.bankRef}` : ''}
                  {p.payerName ? ` · ${p.payerName}` : ''}
                  {p.payerEmail ? ` · ${p.payerEmail}` : ''}
                </p>
              </div>
              <button onClick={() => void act(p, 'confirm')} disabled={busy}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold px-3 py-2 rounded-lg">
                <Check size={12} /> تأكيد
              </button>
              <button onClick={() => void act(p, 'reject')} disabled={busy}
                className="flex items-center gap-1 bg-red-500/10 text-red-400 text-[11px] font-bold px-3 py-2 rounded-lg">
                <X size={12} /> رفض
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-72 overflow-y-auto">
        <h3 className="font-bold text-white text-sm">السجل ({done.length})</h3>
        {done.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-3">لا سجل بعد</p>
        ) : done.map((p) => (
          <div key={p.id} className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 text-xs font-bold">{KIND[p.kind] ?? p.kind} · {p.amount.toLocaleString('ar-DZ')} د.ج</p>
              <p className="text-[10px] text-zinc-600">{METHOD[p.method] ?? p.method}{p.bankRef ? ` · ${p.bankRef}` : ''}</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded font-bold ${p.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {p.status === 'confirmed' ? 'مؤكد' : 'مرفوض'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
