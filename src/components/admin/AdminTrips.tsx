// إدارة تنقلات الأنصار — création des trajets, inscrits, activation.
import { useCallback, useEffect, useState } from 'react';
import { Bus, ChevronRight, Trash2, Users } from 'lucide-react';

interface Person { name: string; seats: number; }
interface Trip {
  id: string; title: string; meetingPoint: string; departureAt: string;
  seatsTotal: number; seatsTaken: number; seatsLeft: number; price: number; active: boolean; people: Person[];
}

export default function AdminTrips({ onBack }: { onBack: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [title, setTitle] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [seatsTotal, setSeatsTotal] = useState('45');
  const [price, setPrice] = useState('1000');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trips/admin', { credentials: 'same-origin' });
      if (res.ok) setTrips((await res.json()).trips ?? []);
    } catch (e) {
      console.error('[CABBA] trips admin load:', e);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const submit = async () => {
    if (!title.trim() || !meetingPoint.trim() || !departureAt) { setNotice('العنوان ونقطة اللقاء وتاريخ الانطلاق مطلوبة.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), meetingPoint: meetingPoint.trim(), departureAt: new Date(departureAt).toISOString(), seatsTotal: Number(seatsTotal), price: Number(price) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الإنشاء');
      setNotice('تم نشر التنقل — سيظهر للأنصار فوراً.');
      setTitle(''); setMeetingPoint(''); setDepartureAt('');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإنشاء');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (trip: Trip) => {
    setBusy(true);
    try {
      await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !trip.active }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (trip: Trip) => {
    if (!window.confirm(`حذف تنقل « ${trip.title} » وحجوزاته ؟`)) return;
    setBusy(true);
    try {
      await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";
  const label = "text-[11px] font-bold text-zinc-400 mb-1 block";

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-blue-500/10 border-blue-500/30 text-blue-300">{notice}</div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Bus size={16} className="text-blue-400" /> نشر تنقل جديد
        </h3>
        <label className="block">
          <span className={label}>العنوان (المباراة والملعب)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="تنقل وهران — ملعب أحمد زبانة" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>نقطة اللقاء</span>
            <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} maxLength={200} placeholder="أمام ملعب 20 أوت" className={input} />
          </label>
          <label className="block">
            <span className={label}>تاريخ وساعة الانطلاق</span>
            <input value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} type="datetime-local" className={input} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>عدد المقاعد</span>
            <input value={seatsTotal} onChange={(e) => setSeatsTotal(e.target.value)} type="number" min={1} className={input} />
          </label>
          <label className="block">
            <span className={label}>السعر (د.ج)</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} className={input} />
          </label>
        </div>
        <button onClick={() => void submit()} disabled={busy}
          className="w-full bg-blue-500 hover:bg-blue-400 text-black text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
          + نشر التنقل
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-96 overflow-y-auto">
        {trips.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">لا تنقلات بعد — انشر أول باص</p>
        ) : trips.map((trip) => (
          <div key={trip.id} className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{trip.title}</p>
                <p className="text-[10px] text-zinc-500">
                  {new Date(trip.departureAt).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' })}
                  {' · '}{trip.meetingPoint} · {trip.price.toLocaleString('ar-DZ')} د.ج
                </p>
              </div>
              <span className="text-[10px] text-blue-300 font-bold flex items-center gap-1 flex-shrink-0">
                <Users size={11} /> {trip.seatsTaken}/{trip.seatsTotal}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded font-bold flex-shrink-0 ${trip.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                {trip.active ? 'منشور' : 'موقوف'}
              </span>
              <button onClick={() => void toggle(trip)} disabled={busy} className="text-zinc-500 hover:text-white text-[10px] font-bold px-1">
                {trip.active ? 'إيقاف' : 'تفعيل'}
              </button>
              <button onClick={() => void remove(trip)} disabled={busy} aria-label="حذف" className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
            </div>
            {trip.people.length > 0 && (
              <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                المسجلون : {trip.people.map((p) => `${p.name} (${p.seats})`).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
