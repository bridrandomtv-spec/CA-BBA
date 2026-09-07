import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Eye, Users, Activity } from 'lucide-react';

type Overview = {
  days: number;
  totals: { events: number; page_views: number; active_visitors: number; active_users: number };
  daily: { day: string; events: number; page_views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  topEvents: { name: string; count: number }[];
};

export default function AdminAnalytics({ onBack }: { onBack: () => void }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/overview?days=${days}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error('تعذر تحميل التحليلات');
        return r.json();
      })
      .then((value) => { if (!cancelled) setData(value); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white">
          <ArrowRight size={18} /> العودة
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="text-cyan-400" />
          <h3 className="font-bold text-lg">تحليلات التطبيق</h3>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {[7, 30, 90].map((value) => (
          <button key={value} onClick={() => setDays(value)} className={`px-3 py-1.5 rounded-lg text-xs border ${days === value ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}>
            {value} يوم
          </button>
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 text-sm">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Eye size={18} />} label="مشاهدات الصفحات" value={data.totals.page_views} />
            <Stat icon={<Users size={18} />} label="الزوار النشطون" value={data.totals.active_visitors} />
            <Stat icon={<Activity size={18} />} label="الأحداث" value={data.totals.events} />
            <Stat icon={<Users size={18} />} label="المستخدمون المسجلون" value={data.totals.active_users} />
          </div>

          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h4 className="font-bold mb-3">أكثر الصفحات زيارة</h4>
            <div className="space-y-2">
              {data.topPages.map((item) => <Row key={item.path} label={item.path} value={item.views} />)}
            </div>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h4 className="font-bold mb-3">الأحداث الأكثر استخداماً</h4>
            <div className="space-y-2">
              {data.topEvents.map((item) => <Row key={item.name} label={item.name} value={item.count} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"><div className="flex items-center gap-2 text-zinc-400 text-xs">{icon}{label}</div><div className="text-2xl font-black mt-2">{value.toLocaleString('ar-DZ')}</div></div>;
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3 bg-zinc-950/60 rounded-xl px-3 py-2"><span className="text-sm truncate">{label}</span><span className="text-yellow-400 font-bold">{value.toLocaleString('ar-DZ')}</span></div>;
}
