// إدارة صندوق الدعم — campagne + registre des dons.
// L'encaissement est physique (espèces / CCP / virement) : l'admin consigne
// chaque don ici, et le montant affiché publiquement est TOUJOURS la somme
// du registre (jamais saisi à la main → aucune dérive possible).
import { useCallback, useEffect, useState } from 'react';
import { Heart, Plus, Trash2, Loader2, ChevronRight, Power } from 'lucide-react';

interface Donation {
  id: string;
  amount: number;
  donorName: string;
  method: string;
  note: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  title: string;
  goal: number;
  raised: number;
  donationsCount: number;
  bankInfo: string;
  active: boolean;
  updatedAt: string;
}

const METHODS: Array<{ value: string; label: string }> = [
  { value: 'cash', label: 'نقداً' },
  { value: 'ccp', label: 'CCP' },
  { value: 'transfer', label: 'تحويل بنكي' },
  { value: 'other', label: 'أخرى' },
];

export default function AdminSupport({ onBack }: { onBack: () => void }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Formulaire campagne (création et édition partagent les mêmes champs)
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [bankInfo, setBankInfo] = useState('');

  // Formulaire don
  const [amount, setAmount] = useState('');
  const [donor, setDonor] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // تصريحات الأنصار بالصندوق — file d'attente à valider
  const [declarations, setDeclarations] = useState<Array<{
    id: string; donorName: string; amountDzd: number; reference: string;
    status: string; createdAt: string; userName: string | null;
  }>>([]);

  const loadDeclarations = useCallback(async () => {
    try {
      const res = await fetch('/api/support/declarations', { credentials: 'same-origin' });
      if (res.ok) setDeclarations((await res.json()).declarations ?? []);
    } catch (e) {
      console.error('[CABBA] admin declarations:', e);
    }
  }, []);

  useEffect(() => { void loadDeclarations(); }, [loadDeclarations]);

  const processDeclaration = async (id: string, action: 'confirm' | 'reject') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/support/declarations/${id}/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setNotice(action === 'confirm'
          ? 'تم تأكيد التصريح وإضافة الدون إلى السجل ✓'
          : 'تم رفض التصريح.');
        void loadDeclarations();
        const cres = await fetch('/api/support/campaign', { credentials: 'same-origin' });
        if (cres.ok) {
          const cj = await cres.json();
          setCampaign(cj.campaign ?? null);
          if (cj.campaign) {
            const dres = await fetch(`/api/support/campaign/${cj.campaign.id}/donations`, { credentials: 'same-origin' });
            if (dres.ok) setDonations((await dres.json()).donations ?? []);
          }
        }
      } else {
        const b = await res.json().catch(() => ({}));
        setNotice((b && b.error) || 'رفض الخادم العملية.');
      }
    } catch {
      setNotice('تعذر الوصول إلى الخادم.');
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/support/campaign', { credentials: 'same-origin' });
      const data = res.ok ? await res.json().catch(() => null) : null;
      const camp: Campaign | null = data?.campaign ?? null;
      setCampaign(camp);
      if (camp) {
        setTitle(camp.title);
        setGoal(String(camp.goal));
        setBankInfo(camp.bankInfo ?? '');
        const dres = await fetch(`/api/support/campaign/${camp.id}/donations`, { credentials: 'same-origin' });
        const ddata = dres.ok ? await dres.json().catch(() => null) : null;
        setDonations(ddata?.donations ?? []);
      }
    } catch (error) {
      console.error('[CABBA] support load:', error);
      setNotice('تعذر تحميل بيانات الصندوق.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveCampaign = async () => {
    if (!title.trim()) { setNotice('عنوان الحملة مطلوب.'); return; }
    setBusy(true);
    try {
      const body = { title: title.trim(), goal: goal === '' ? 0 : Number(goal), bankInfo };
      const res = campaign
        ? await fetch(`/api/support/campaign/${campaign.id}`, {
            method: 'PATCH', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch('/api/support/campaign', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر حفظ الحملة');
      setNotice(campaign ? 'تم تحديث الحملة.' : 'تم إنشاء الحملة وتفعيلها.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر حفظ الحملة');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/support/campaign/${campaign.id}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !campaign.active }),
      });
      if (!res.ok) throw new Error('تعديل الحالة فشل');
      setNotice(campaign.active ? 'أُوقفت الحملة — الصندوق مخفي من الرئيسية.' : 'أُعيد تفعيل الحملة.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر تغيير الحالة');
    } finally {
      setBusy(false);
    }
  };

  const addDonation = async () => {
    if (!campaign) return;
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) { setNotice('أدخل مبلغاً صحيحاً بالدينار.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/support/campaign/${campaign.id}/donations`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, donorName: donor, method, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر تسجيل العملية');
      setAmount(''); setDonor(''); setNote('');
      setNotice('تم تسجيل العملية في السجل.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر تسجيل العملية');
    } finally {
      setBusy(false);
    }
  };

  const removeDonation = async (donationId: string) => {
    if (!campaign) return;
    if (!window.confirm('حذف هذه العملية من السجل؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/support/campaign/${campaign.id}/donations/${donationId}`, {
        method: 'DELETE', credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('تعذر حذف العملية');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر حذف العملية');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500";

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" aria-live="polite" className="p-3 rounded-xl border text-sm font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      {!loaded ? (
        <div className="py-10 flex justify-center"><Loader2 size={24} className="animate-spin text-yellow-500" /></div>
      ) : (
        <>
          {/* Aperçu + état */}
          {campaign && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Heart size={16} className="text-rose-500" /> {campaign.title}
                </h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${campaign.active ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {campaign.active ? 'نشطة — ظاهرة في الرئيسية' : 'موقوفة — مخفية'}
                </span>
              </div>
              {campaign.goal > 0 && (
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>{campaign.raised.toLocaleString('ar-DZ')} د.ج</span>
                    <span>{Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))}% من الهدف</span>
                  </div>
                  <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-l from-yellow-400 to-yellow-600"
                      style={{ width: `${Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))}%` }} />
                  </div>
                </div>
              )}
              <button onClick={() => void toggleActive()} disabled={busy}
                className="flex items-center gap-2 text-xs font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                <Power size={13} /> {campaign.active ? 'إيقاف الحملة وإخفاؤها' : 'إعادة التفعيل'}
              </button>
            </div>
          )}

          {/* Formulaire création / édition */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-white text-sm">{campaign ? 'تعديل الحملة' : 'إنشاء حملة جديدة'}</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              placeholder="عنوان الحملة (مثال: تجهيز حافلة الفريق)" className={inputClass} />
            <input value={goal} onChange={(e) => setGoal(e.target.value)} type="number" min={0}
              placeholder="الهدف بالدينار (0 = بدون هدف محدد)" className={inputClass} />
            <textarea value={bankInfo} onChange={(e) => setBankInfo(e.target.value)} maxLength={2000} rows={3}
              placeholder={'كيف يتبرع المشجعون؟\nمثال: حساب CCP: 123456789 مفتاح 42\nأو صندوق النادي بمقر الفريق يومياً 17h-20h'}
              className={inputClass + " resize-none"} />
            <button onClick={() => void saveCampaign()} disabled={busy}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {busy ? 'جاري الحفظ...' : campaign ? 'حفظ التعديلات' : 'إنشاء وتفعيل الحملة'}
            </button>
          </div>

          {/* Registre des dons */}
          {campaign && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-white text-sm">تسجيل دون مستلم ({campaign.donationsCount} عملية)</h3>
              <div className="grid grid-cols-2 gap-2">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={1}
                  placeholder="المبلغ (د.ج)" className={inputClass} />
                <input value={donor} onChange={(e) => setDonor(e.target.value)} maxLength={100}
                  placeholder="اسم المتبرع (اختياري)" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                  {METHODS.map((m) => <option key={m.value} value={m.value} className="bg-zinc-900">{m.label}</option>)}
                </select>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                  placeholder="ملاحظة (اختياري)" className={inputClass} />
              </div>
              <button onClick={() => void addDonation()} disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                <Plus size={15} /> إضافة دون إلى السجل
              </button>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {donations.length === 0 ? (
                  <p className="text-center text-zinc-600 text-xs py-4">لا توجد عمليات مسجلة بعد</p>
                ) : donations.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-bold truncate">
                        {d.amount.toLocaleString('ar-DZ')} د.ج — {d.donorName}
                        <span className="text-zinc-500 font-normal"> ({METHODS.find((m) => m.value === d.method)?.label ?? d.method})</span>
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {new Date(d.createdAt).toLocaleDateString('ar-DZ')}{d.note ? ` · ${d.note}` : ''}
                      </p>
                    </div>
                    <button onClick={() => void removeDonation(d.id)} disabled={busy}
                      aria-label="حذف العملية" className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* تصريحات الأنصار — file d'attente vérifiée */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Heart size={16} className="text-yellow-500" /> تصريحات الأنصار بانتظار التحقق
            </h4>
            {declarations.filter((d) => d.status === 'pending').length === 0 ? (
              <p className="text-zinc-500 text-xs">لا توجد تصريحات معلّقة حالياً.</p>
            ) : (
              <div className="space-y-2">
                {declarations.filter((d) => d.status === 'pending').map((d) => (
                  <div key={d.id} className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-bold truncate">
                        {d.amountDzd.toLocaleString('ar-DZ')} د.ج — {d.donorName}
                        {d.userName && d.userName !== d.donorName
                          ? <span className="text-zinc-500 font-normal"> ({d.userName})</span>
                          : null}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        <span dir="ltr">ref: {d.reference || '—'}</span> · {new Date(d.createdAt).toLocaleDateString('ar-DZ')}
                      </p>
                    </div>
                    <button onClick={() => void processDeclaration(d.id, 'confirm')} disabled={busy}
                      className="text-[10px] font-bold bg-yellow-500 text-black px-2 py-1 rounded hover:bg-yellow-400 disabled:opacity-50">
                      تأكيد
                    </button>
                    <button onClick={() => void processDeclaration(d.id, 'reject')} disabled={busy}
                      className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-2 py-1 rounded hover:bg-red-500 hover:text-white disabled:opacity-50">
                      رفض
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
