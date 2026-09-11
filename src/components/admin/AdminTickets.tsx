// إدارة التذاكر والمراقبة — émission guichet, QR, statuts, compteurs.
import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronRight, Loader2, Plus, ScanLine, Ticket as TicketIcon, XCircle } from 'lucide-react';

interface MatchOpt { id: string; home_team: string; away_team: string; match_date: string; }
interface TicketRow {
  id: string; code: string; holderName: string; category: string; price: number;
  status: string; usedAt: string | null; usedGate: string | null;
}
interface Stats { totals: { issued: number; valid: number; used: number; cancelled: number }; byGate: Array<{ gate: string; n: number }>; }

export default function AdminTickets({ onBack }: { onBack: () => void }) {
  const [matches, setMatches] = useState<MatchOpt[]>([]);
  const [matchId, setMatchId] = useState('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [holder, setHolder] = useState('');
  const [category, setCategory] = useState('virage');
  const [price, setPrice] = useState('300');
  const [issued, setIssued] = useState<TicketRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    fetch('/api/matches', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // /api/matches (route historique) renvoie un TABLEAU d'objets
        // camelCase { homeTeam, awayTeam, date } — et non { matches }.
        // Tolérance aux deux formes et aux deux conventions de noms.
        const list = Array.isArray(d) ? d : (d?.matches ?? []);
        setMatches(list.map((x: any) => ({
          id: x.id as string,
          home_team: (x.homeTeam ?? x.home_team) as string,
          away_team: (x.awayTeam ?? x.away_team) as string,
          match_date: (x.date ?? x.match_date) as string,
        })));
      })
      .catch(() => setMatches([]));
  }, []);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [tl, sl] = await Promise.all([
        fetch(`/api/tickets?matchId=${encodeURIComponent(matchId)}`, { credentials: 'same-origin' }),
        fetch(`/api/tickets/stats?matchId=${encodeURIComponent(matchId)}`, { credentials: 'same-origin' }),
      ]);
      if (tl.ok) setTickets((await tl.json()).tickets ?? []);
      if (sl.ok) setStats(await sl.json());
    } catch (e) {
      console.error('[CABBA] tickets load:', e);
    }
  }, [matchId]);

  useEffect(() => { void load(); }, [load]);

  const issue = async () => {
    if (!matchId) { setNotice('اختر المباراة أولاً.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, holderName: holder, category, price: Number(price) || 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر إصدار التذكرة');
      setIssued(data.ticket);
      setHolder('');
      setNotice('تم إصدار التذكرة — اطبعها أو اعرض رمز QR.');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر إصدار التذكرة');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('إلغاء هذه التذكرة؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/cancel`, {
        method: 'POST', credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('تعذر الإلغاء');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإلغاء');
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500";

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
        <ChevronRight size={16} /> العودة إلى لوحة الإدارة
      </button>

      {notice && (
        <div role="status" aria-live="polite" className="p-3 rounded-xl border text-sm font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
          {notice}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <TicketIcon size={16} className="text-emerald-500" /> إصدار تذكرة (شباك النادي)
        </h3>
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={input}>
          <option value="" className="bg-zinc-900">— اختر المباراة —</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id} className="bg-zinc-900">
              {m.home_team} — {m.away_team} ({m.match_date})
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={100}
            placeholder="اسم حامل التذكرة (اختياري)" className={input} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            <option value="virage" className="bg-zinc-900">منعرج (virage)</option>
            <option value="tribune" className="bg-zinc-900">منصة (tribune)</option>
            <option value="vip" className="bg-zinc-900">VIP</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0}
            placeholder="السعر (د.ج)" className={input} />
          <button onClick={() => void issue()} disabled={busy}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
            <Plus size={15} /> إصدار
          </button>
        </div>

        {issued && (
          <div className="bg-zinc-950 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl flex-shrink-0">
              <QRCodeSVG value={issued.code} size={96} />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-400 font-bold text-sm">تذكرة صالحة — اعرض أو اطبع</p>
              <p className="text-white font-mono text-lg tracking-widest mt-1">{issued.code}</p>
              <p className="text-zinc-500 text-xs mt-1">
                {issued.category} · {issued.price.toLocaleString('ar-DZ')} د.ج
              </p>
            </div>
          </div>
        )}
      </div>

      {matchId && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white text-sm">compteurs du match</h3>
              <button onClick={() => { window.location.hash = '#/scanner'; }}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                <ScanLine size={14} /> فتح وضع الماسح
              </button>
            </div>
            {stats && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-zinc-950 rounded-xl p-2"><p className="text-white font-bold">{stats.totals.issued}</p><p className="text-[10px] text-zinc-500">صادرة</p></div>
                <div className="bg-zinc-950 rounded-xl p-2"><p className="text-emerald-400 font-bold">{stats.totals.used}</p><p className="text-[10px] text-zinc-500">داخلة</p></div>
                <div className="bg-zinc-950 rounded-xl p-2"><p className="text-yellow-400 font-bold">{stats.totals.valid}</p><p className="text-[10px] text-zinc-500">صالحة</p></div>
                <div className="bg-zinc-950 rounded-xl p-2"><p className="text-red-400 font-bold">{stats.totals.cancelled}</p><p className="text-[10px] text-zinc-500">ملغاة</p></div>
              </div>
            )}
            {stats && stats.byGate.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {stats.byGate.map((g) => (
                  <span key={g.gate} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                    {g.gate} : {g.n}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-80 overflow-y-auto">
            {tickets.length === 0 ? (
              <p className="text-center text-zinc-600 text-xs py-4">لا تذاكر لهذه المباراة بعد</p>
            ) : tickets.map((t) => (
              <div key={t.id} className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-mono text-sm tracking-wider">{t.code}</p>
                  <p className="text-[10px] text-zinc-500">
                    {t.category} · {t.holderName || 'بدون اسم'}
                    {t.usedAt ? ` · دخل من ${t.usedGate || '؟'} ` : ''}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                  t.status === 'valid' ? 'bg-yellow-500/10 text-yellow-400'
                  : t.status === 'used' ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'}`}>
                  {t.status === 'valid' ? 'صالحة' : t.status === 'used' ? 'مستعملة' : 'ملغاة'}
                </span>
                {t.status === 'valid' && (
                  <button onClick={() => void cancel(t.id)} disabled={busy}
                    aria-label="إلغاء التذكرة" className="text-zinc-600 hover:text-red-400 p-1">
                    <XCircle size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
