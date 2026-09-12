// مدرسة الكرة — inscription publique d'un jeune (U7 → U17).
import { useState } from 'react';
import { CheckCircle2, GraduationCap } from 'lucide-react';

const CATS = ['U7', 'U9', 'U11', 'U13', 'U15', 'U17'];

export default function AcademyForm() {
  const [childName, setChildName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [category, setCategory] = useState('U11');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setNotice(null);
    try {
      const res = await fetch('/api/academy', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childName, birthYear: Number(birthYear), category, parentName, parentPhone, parentEmail: parentEmail || undefined, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر التسجيل');
      setDone(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر التسجيل');
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500";
  const label = "text-[11px] font-bold text-zinc-400 mb-1 block";

  if (done) {
    return (
      <div className="p-4" dir="rtl">
        <div className="bg-zinc-900 border border-teal-500/30 rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 size={40} className="text-teal-400 mx-auto" />
          <h2 className="text-white font-black text-lg">تم تسجيل الطلب</h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            ستتصل بكم إدارة مدرسة الكرة لتحديد حصة التجريب — تابعوا الحالة عبر الهاتف المسجل.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={24} className="text-teal-400" />
        </div>
        <div>
          <h2 className="text-white font-black text-lg">مدرسة الكرة</h2>
          <p className="text-zinc-500 text-[11px]">سجّل ابنك في فئات U7 → U17 — حصة تجريبية بإشراف مدربي النادي</p>
        </div>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-red-500/10 border-red-500/30 text-red-400">{notice}</div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <label className="block">
          <span className={label}>اسم الطفل</span>
          <input value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={120} placeholder="الاسم واللقب" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>سنة الميلاد</span>
            <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} type="number" placeholder="2015" className={input} />
          </label>
          <label className="block">
            <span className={label}>الفئة</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
              {CATS.map((cat) => <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={label}>اسم ولي الأمر</span>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} maxLength={120} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>هاتف ولي الأمر</span>
            <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} maxLength={30} placeholder="07…" className={input} />
          </label>
          <label className="block">
            <span className={label}>بريد إلكتروني (اختياري)</span>
            <input value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} type="email" className={input} />
          </label>
        </div>
        <label className="block">
          <span className={label}>ملاحظات (اختياري)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000}
            placeholder="نادٍ سابق، منصب مفضل…" className={input} />
        </label>
        <button onClick={() => void submit()} disabled={busy}
          className="w-full bg-teal-500 hover:bg-teal-400 text-black text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
          تسجيل الطلب
        </button>
      </div>
    </div>
  );
}
