// تنقلات الأنصار — bus des matchs à l'extérieur : réservation en un tap.
import { useCallback, useEffect, useState } from 'react';
import { Bus, MapPin, Users } from 'lucide-react';

interface Trip {
  id: string; title: string; meetingPoint: string; departureAt: string;
  seatsTotal: number; seatsTaken: number; seatsLeft: number; price: number; mySeats: number;
}

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seatsFor, setSeatsFor] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trips', { credentials: 'same-origin' });
      if (res.ok) setTrips((await res.json()).trips ?? []);
    } catch (e) {
      console.error('[CABBA] trips load:', e);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const book = async (trip: Trip) => {
    setBusy(true);
    try {
      const seats = seatsFor[trip.id] ?? 1;
      const res = await fetch(`/api/trips/${encodeURIComponent(trip.id)}/book`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الحجز');
      setNotice(`تم حجز ${seats} مقعد — نقطة اللقاء : ${trip.meetingPoint}`);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحجز');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (trip: Trip) => {
    if (!window.confirm('إلغاء حجزك في هذا التنقل ؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip.id)}/cancel`, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) throw new Error('تعذر الإلغاء');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإلغاء');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Bus size={24} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-white font-black text-lg">تنقلات الأنصار</h2>
          <p className="text-zinc-500 text-[11px]">bus organisés pour les matchs à l'extérieur — places limitées</p>
        </div>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl border text-sm font-bold bg-blue-500/10 border-blue-500/30 text-blue-300">{notice}</div>
      )}

      {!loaded ? (
        <p className="text-center text-zinc-600 text-xs py-8">جاري التحميل…</p>
      ) : trips.length === 0 ? (
        <div className="text-center text-zinc-600 text-xs py-8 border border-zinc-800 border-dashed rounded-2xl">
          لا تنقلات مبرمجة حالياً — الإدارة تنشرها هنا قبل كل مباراة خارج الديار
        </div>
      ) : trips.map((trip) => {
        const pct = Math.round((trip.seatsTaken / trip.seatsTotal) * 100);
        return (
          <div key={trip.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-white font-bold text-sm">{trip.title}</h3>
                <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                  <MapPin size={12} className="text-blue-400" /> {trip.meetingPoint}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  الانطلاق : {new Date(trip.departureAt).toLocaleString('ar-DZ', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              </div>
              <span className="text-yellow-400 font-black text-sm flex-shrink-0">{trip.price.toLocaleString('ar-DZ')} د.ج</span>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span className="flex items-center gap-1"><Users size={11} /> {trip.seatsTaken}/{trip.seatsTotal} مقعداً</span>
                <span>{trip.seatsLeft} متبقية</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {trip.mySeats > 0 ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[11px] text-emerald-400 font-bold">حجزك : {trip.mySeats} مقعداً ✓</span>
                <button onClick={() => void cancel(trip)} disabled={busy}
                  className="text-[11px] bg-red-500/10 text-red-400 px-3 py-2 rounded-lg font-bold">إلغاء الحجز</button>
              </div>
            ) : trip.seatsLeft > 0 ? (
              <div className="flex items-center gap-2">
                <select value={seatsFor[trip.id] ?? 1} onChange={(e) => setSeatsFor({ ...seatsFor, [trip.id]: Number(e.target.value) })}
                  className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white">
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n} className="bg-zinc-900">{n} مقعد</option>)}
                </select>
                <button onClick={() => void book(trip)} disabled={busy}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 text-black text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50">
                  احجز مقعدك في الباص
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-red-400 font-bold">اكتمل العدد — قائمة انتظار عبر إدارة النادي</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
