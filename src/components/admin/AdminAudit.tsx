// سجل التدقيق والتصدير — qui a fait quoi, quand ; et export global
// des données du club (Article 6) en un clic.
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Download, FileJson, ScrollText } from 'lucide-react';

interface Entry { id: string; actor: string; action: string; target: string; detail: string; at: string; }

const ACTION: Record<string, string> = {
  'ticket.issue': 'إصدار تذكرة',
  'ticket.cancel': 'إلغاء تذكرة',
  'ticket.assign': 'إرسال تذكرة لحساب',
  'user.role': 'تغيير دور مستخدم',
  'sponsor.create': 'إضافة شريك',
  'sponsor.update': 'تعديل شريك',
  'sponsor.delete': 'حذف شريك',
};

export default function AdminAudit({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/audit', { credentials: 'same-origin' });
      if (res.ok) setEntries((await res.json()).entries ?? []);
    } catch (e) {
      console.error('[CABBA] audit load:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    const rows = [['التاريخ', 'الفاعل', 'الإجراء', 'الهدف', 'تفاصيل'],
      ...entries.map((e) => [new Date(e.at).toLocaleString('ar-DZ'), e.actor, ACTION[e.action] ?? e.action, e.target, e.detail])];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `cabba-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportGlobal = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/audit/export', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('تعذر التصدير');
      const json = await res.text();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `cabba-export-article6-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNotice('تم تصدير كامل بيانات النادي (Article 6).');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر التصدير');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-indigo-500/10 border-indigo-500/30 text-indigo-300">{notice}</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 flex-1">
          <ScrollText size={16} className="text-indigo-400" /> سجل التدقيق والتصدير
        </h3>
        <button onClick={exportCsv} disabled={entries.length === 0}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50">
          <Download size={14} /> CSV السجل
        </button>
        <button onClick={() => void exportGlobal()} disabled={busy}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-black text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50">
          <FileJson size={14} /> تصدير كامل البيانات (Article 6)
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-96 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">لا إجراءات مسجلة بعد — كل geste admin sensible apparaîtra ici</p>
        ) : entries.map((e) => (
          <div key={e.id} className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white text-xs font-bold">{ACTION[e.action] ?? e.action}</span>
              <span className="text-[10px] text-zinc-500">{new Date(e.at).toLocaleString('ar-DZ')}</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              بواسطة <b className="text-zinc-200">{e.actor}</b>
              {e.target ? ` · الهدف : ${e.target}` : ''}
              {e.detail ? ` · ${e.detail}` : ''}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        كل إجراء حساس (تذاكر، أدوار، شركاء…) يُسجَّل هنا تلقائياً مع فاعله ووقته —
        والتصدير الكامل يسلَّم للنادي عند أول طلب، كما يعد العقد.
      </p>
    </div>
  );
}
