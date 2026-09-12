// إدارة مدرسة الكرة — effectifs, statuts, retraits.
import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Clock, GraduationCap, Trash2, X } from 'lucide-react';

interface Reg {
  id: string; childName: string; birthYear: number; category: string;
  parentName: string; parentPhone: string; parentEmail: string; notes: string; status: string; at: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'قيد الدراسة', cls: 'bg-yellow-500/10 text-yellow-400' },
  accepted: { label: 'مقبول', cls: 'bg-emerald-500/10 text-emerald-400' },
  waitlist: { label: 'قائمة انتظار', cls: 'bg-zinc-800 text-zinc-300' },
  rejected: { label: 'مرفوض', cls: 'bg-red-500/10 text-red-400' },
};

export default function AdminAcademy({ onBack }: { onBack: () => void }) {
  const [regs, setRegs] = useState<Reg[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/academy/admin', { credentials: 'same-origin' });
      if (res.ok) setRegs((await res.json()).registrations ?? []);
    } catch (e) {
      console.error('[CABBA] academy load:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (r: Reg, status: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/${encodeURIComponent(r.id)}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('تعذر التغيير');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر التغيير');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Reg) => {
    if (!window.confirm(`حذف تسجيل ${r.childName} ؟`)) return;
    setBusy(true);
    try {
      await fetch(`/api/academy/${encodeURIComponent(r.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const counts = regs.reduce<Record<string, number>>((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-red-500/10 border-red-500/30 text-red-400">{notice}</div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3">
          <GraduationCap size={16} className="text-teal-400" /> effectifs par catégorie
        </h3>
        <div className="flex flex-wrap gap-2">
          {['U7','U9','U11','U13','U15','U17'].map((cat) => (
            <span key={cat} className="text-[11px] bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-lg">
              {cat} : <b className="text-teal-400">{counts[cat] ?? 0}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-96 overflow-y-auto">
        {regs.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">لا تسجيلات بعد — الرابط العام : #/academy</p>
        ) : regs.map((r) => (
          <div key={r.id} className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{r.childName} <span className="text-teal-400 text-xs">{r.category}</span></p>
                <p className="text-[10px] text-zinc-500">
                  مواليد {r.birthYear} · وليّه : {r.parentName} · {r.parentPhone}
                  {r.parentEmail ? ` · ${r.parentEmail}` : ''}
                </p>
                {r.notes && <p className="text-[10px] text-zinc-600 mt-0.5">{r.notes}</p>}
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-bold flex-shrink-0 ${(STATUS[r.status] ?? STATUS.pending).cls}`}>
                {(STATUS[r.status] ?? STATUS.pending).label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => void setStatus(r, 'accepted')} disabled={busy}
                className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold">
                <Check size={11} /> قبول
              </button>
              <button onClick={() => void setStatus(r, 'waitlist')} disabled={busy}
                className="flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded font-bold">
                <Clock size={11} /> انتظار
              </button>
              <button onClick={() => void setStatus(r, 'rejected')} disabled={busy}
                className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded font-bold">
                <X size={11} /> رفض
              </button>
              <button onClick={() => void remove(r)} disabled={busy} aria-label="حذف"
                className="ms-auto text-zinc-600 hover:text-red-400 p-1"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
