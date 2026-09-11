// المحاسبة والتقارير — état financier issu des PIÈCES de l'app :
// billets du guichet, registre des dons, commandes boutique, adhésions.
// Export CSV (Excel arabe) + impression d'un état signé-able.
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Download, Printer, Wallet } from 'lucide-react';

interface Summary {
  period: { from: string | null; to: string | null };
  tickets: {
    issuedCount: number; issuedTotal: number; usedCount: number; usedTotal: number; cancelledCount: number;
    byMatch: Array<{ id: string; label: string; issuedCount: number; issuedTotal: number; usedCount: number }>;
    byCategory: Array<{ category: string; count: number; total: number }>;
  };
  donations: { count: number; total: number; byMethod: Array<{ method: string; count: number; total: number }> };
  store: { byStatus: Array<{ status: string; count: number; total: number }>; revenueCount: number; revenueTotal: number };
  memberships: { active: number; pending: number; byType: Array<{ type: string; count: number }> };
  monthly: Array<{ month: string; tickets: number; donations: number; store: number; total: number }>;
  grandTotal: number;
}

const CAT: Record<string, string> = { virage: 'منعرج', tribune: 'منصة', vip: 'VIP' };
const METHOD: Record<string, string> = { cash: 'نقداً', ccp: 'CCP', transfer: 'تحويل', other: 'أخرى' };
const STATUS: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكدة', processing: 'قيد التحضير',
  shipped: 'مشحونة', delivered: 'مسلّمة', cancelled: 'ملغاة',
};
const fmt = (n: number) => n.toLocaleString('ar-DZ');

function periodBounds(kind: string): { from: string | null; to: string | null } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (kind === 'month') return { from: first.toISOString(), to: next.toISOString() };
  if (kind === '3m') {
    const f = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: f.toISOString(), to: next.toISOString() };
  }
  return { from: null, to: null };
}

export default function AdminAccounting({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState<Summary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { from, to } = periodBounds(period);
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    try {
      const res = await fetch(`/api/accounting/summary?${qs.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('تعذر تحميل المحاسبة');
      setData(await res.json());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر تحميل المحاسبة');
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const rows: string[][] = [
      ['CABBA — état financier', period === 'month' ? 'mois courant' : period === '3m' ? '3 derniers mois' : 'tout'],
      [],
      ['Source', 'Détail', 'Opérations', 'Montant (DZD)'],
      ['Billetterie', 'émises (encaissé guichet)', String(data.tickets.issuedCount), String(data.tickets.issuedTotal)],
      ['Billetterie', 'consommées (entrées)', String(data.tickets.usedCount), String(data.tickets.usedTotal)],
      ['Billetterie', 'annulées', String(data.tickets.cancelledCount), '0'],
      ...data.tickets.byMatch.map((m) => ['Billetterie', `match : ${m.label}`, String(m.issuedCount), String(m.issuedTotal)]),
      ['Dons', 'registre du fonds', String(data.donations.count), String(data.donations.total)],
      ...data.donations.byMethod.map((m) => ['Dons', METHOD[m.method] ?? m.method, String(m.count), String(m.total)]),
      ['Boutique', 'commandes confirmées et +', String(data.store.revenueCount), String(data.store.revenueTotal)],
      ...data.store.byStatus.map((s) => ['Boutique', STATUS[s.status] ?? s.status, String(s.count), String(s.total)]),
      ['Adhésions', 'actives', String(data.memberships.active), ''],
      [],
      ['TOTAL GÉNÉRAL', '', '', String(data.grandTotal)],
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cabba-comptabilite-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const card = "bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center";

  return (
    <div className="space-y-4" dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-accounting, #print-accounting * { visibility: visible !important; }
          #print-accounting { position: fixed !important; inset: 0 !important; left: 0 !important; top: 0 !important; }
        }
      `}</style>
      <div id="print-accounting" style={{ position: 'absolute', left: '-10000px', top: 0, width: '700px', background: '#fff', color: '#000', padding: '28px', fontFamily: 'sans-serif' }} dir="rtl">
        {data && (
          <>
            <p style={{ textAlign: 'center', fontWeight: 800, fontSize: 20, margin: 0 }}>نادي شباب أهلي برج بوعريريج (CABBA)</p>
            <p style={{ textAlign: 'center', fontSize: 13, margin: '4px 0 16px' }}>
              état financier — {period === 'month' ? 'الشهر الجاري' : period === '3m' ? 'آخر 3 أشهر' : 'كامل الفترة'} — حرر في {new Date().toLocaleDateString('ar-DZ')}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                <tr><td style={{ border: '1px solid #000', padding: 6 }}>التذاكر — المحصّل بالشباك</td><td style={{ border: '1px solid #000', padding: 6 }}>{fmt(data.tickets.issuedTotal)} د.ج ({fmt(data.tickets.issuedCount)} تذكرة)</td></tr>
                <tr><td style={{ border: '1px solid #000', padding: 6 }}>التذاكر — المستهلكة (داخل الملعب)</td><td style={{ border: '1px solid #000', padding: 6 }}>{fmt(data.tickets.usedCount)} دخول</td></tr>
                <tr><td style={{ border: '1px solid #000', padding: 6 }}>تبرعات صندوق الدعم</td><td style={{ border: '1px solid #000', padding: 6 }}>{fmt(data.donations.total)} د.ج ({fmt(data.donations.count)} عملية)</td></tr>
                <tr><td style={{ border: '1px solid #000', padding: 6 }}>المتجر — الطلبات المؤكدة فما فوق</td><td style={{ border: '1px solid #000', padding: 6 }}>{fmt(data.store.revenueTotal)} د.ج ({fmt(data.store.revenueCount)} طلب)</td></tr>
                <tr><td style={{ border: '1px solid #000', padding: 6 }}>الانخراطات النشطة</td><td style={{ border: '1px solid #000', padding: 6 }}>{fmt(data.memberships.active)}</td></tr>
                <tr><td style={{ border: '1px solid #000', padding: 6, fontWeight: 800 }}>المجموع العام</td><td style={{ border: '1px solid #000', padding: 6, fontWeight: 800 }}>{fmt(data.grandTotal)} د.ج</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: 10, marginTop: 14, color: '#333' }}>
              المستندات : سجل التذاكر، سجل التبرعات، سجل الطلبات — كل مبلغ قابل للتتبع إلى عمليته الأصلية.
            </p>
          </>
        )}
      </div>

      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-red-500/10 border-red-500/30 text-red-400">{notice}</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 flex-1">
          <Wallet size={16} className="text-sky-500" /> المحاسبة والتقارير
        </h3>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white">
          <option value="month" className="bg-zinc-900">الشهر الجاري</option>
          <option value="3m" className="bg-zinc-900">آخر 3 أشهر</option>
          <option value="all" className="bg-zinc-900">كامل الفترة</option>
        </select>
        <button onClick={exportCsv} disabled={!data}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50">
          <Download size={14} /> تصدير CSV
        </button>
        <button onClick={() => window.print()} disabled={!data}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50">
          <Printer size={14} /> طباعة الحالة
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={card}><p className="text-yellow-400 font-black text-lg">{fmt(data.tickets.issuedTotal)}</p><p className="text-[10px] text-zinc-500">التذاكر المحصّلة (د.ج)</p></div>
            <div className={card}><p className="text-rose-400 font-black text-lg">{fmt(data.donations.total)}</p><p className="text-[10px] text-zinc-500">تبرعات الصندوق (د.ج)</p></div>
            <div className={card}><p className="text-emerald-400 font-black text-lg">{fmt(data.store.revenueTotal)}</p><p className="text-[10px] text-zinc-500">المتجر المؤكد (د.ج)</p></div>
            <div className={card}><p className="text-sky-400 font-black text-lg">{fmt(data.grandTotal)}</p><p className="text-[10px] text-zinc-500">المجموع العام (د.ج)</p></div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-zinc-300">التذاكر حسب المباراة</h4>
            {data.tickets.byMatch.length === 0 ? <p className="text-zinc-600 text-xs">لا تذاكر في الفترة</p> :
              data.tickets.byMatch.map((m) => (
                <div key={m.id} className="flex justify-between text-xs bg-zinc-950/60 rounded-lg px-3 py-2">
                  <span className="text-zinc-300">{m.label}</span>
                  <span className="text-zinc-400">{fmt(m.issuedCount)} تذكرة · <b className="text-yellow-400">{fmt(m.issuedTotal)} د.ج</b> · {fmt(m.usedCount)} دخول</span>
                </div>
              ))}
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-zinc-300">التبرعات حسب الطريقة</h4>
              {data.donations.byMethod.map((m) => (
                <div key={m.method} className="flex justify-between text-xs bg-zinc-950/60 rounded-lg px-3 py-2">
                  <span className="text-zinc-300">{METHOD[m.method] ?? m.method}</span>
                  <span className="text-rose-400 font-bold">{fmt(m.total)} د.ج ({fmt(m.count)})</span>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-zinc-300">المتجر حسب الحالة</h4>
              {data.store.byStatus.map((s) => (
                <div key={s.status} className="flex justify-between text-xs bg-zinc-950/60 rounded-lg px-3 py-2">
                  <span className="text-zinc-300">{STATUS[s.status] ?? s.status}</span>
                  <span className="text-emerald-400 font-bold">{fmt(s.total)} د.ج ({fmt(s.count)})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-zinc-300 mb-2">آخر 6 أشهر (تذاكر / تبرعات / متجر)</h4>
            <div className="space-y-1">
              {data.monthly.map((m) => (
                <div key={m.month} className="grid grid-cols-5 text-[11px] bg-zinc-950/60 rounded-lg px-3 py-2">
                  <span className="text-zinc-400 font-mono">{m.month}</span>
                  <span className="text-yellow-400">{fmt(m.tickets)}</span>
                  <span className="text-rose-400">{fmt(m.donations)}</span>
                  <span className="text-emerald-400">{fmt(m.store)}</span>
                  <span className="text-sky-400 font-bold">{fmt(m.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-zinc-600 leading-relaxed">
            كل رقم هنا قابل للتتبع إلى مستنده : سجل التذاكر، سجل التبرعات، سجل الطلبات —
            المحاسبة تقرأ المستندات ولا تعيد إدخالها، فلا اختلاف ممكن بين الشاشة والدفتر.
          </p>
        </>
      )}
    </div>
  );
}
