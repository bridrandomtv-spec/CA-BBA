// إدارة التذاكر والمراقبة — version 2 « شباك محترف » :
// étiquettes permanentes, impression propre (carte QR), envoi au compte
// du supporter, copie du code, date lisible, compteurs par porte.
import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import ClubLogo from '../ClubLogo';
import { ChevronRight, Copy, Printer, ScanLine, Send, Ticket as TicketIcon, XCircle } from 'lucide-react';

interface MatchOpt { id: string; home_team: string; away_team: string; match_date: string; }
interface TicketRow {
  id: string; code: string; holderName: string; category: string; price: number;
  status: string; usedAt: string | null; usedGate: string | null;
  ownerId?: string | null; matchLabel?: string;
}
interface Stats { totals: { issued: number; valid: number; used: number; cancelled: number }; byGate: Array<{ gate: string; n: number }>; }

const CAT: Record<string, string> = { virage: 'منعرج', tribune: 'منصة', vip: 'VIP' };

export default function AdminTickets({ onBack }: { onBack: () => void }) {
  const [matches, setMatches] = useState<MatchOpt[]>([]);
  const [matchId, setMatchId] = useState('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [holder, setHolder] = useState('');
  const [category, setCategory] = useState('virage');
  const [price, setPrice] = useState('300');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [issued, setIssued] = useState<TicketRow | null>(null);
  const [printTicket, setPrintTicket] = useState<TicketRow | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState('');
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
        body: JSON.stringify({ matchId, holderName: holder, category, price: Number(price) || 0, ownerEmail: ownerEmail || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر إصدار التذكرة');
      setIssued(data.ticket);
      setHolder(''); setOwnerEmail('');
      setNotice(data.ticket.ownerId ? 'تم إصدار التذكرة وإرسالها إلى حساب الأنصار.' : 'تم إصدار التذكرة — اطبعها أو انسخ رمزها.');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر إصدار التذكرة');
    } finally {
      setBusy(false);
    }
  };

  const doPrint = (t: TicketRow) => {
    setPrintTicket(t);
    window.setTimeout(() => window.print(), 200);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice('تم نسخ الرمز — يمكنك لصقه في رسالة للأنصار.');
    } catch {
      setNotice('تعذر النسخ التلقائي — انسخ الرمز يدوياً.');
    }
  };

  const assign = async (id: string) => {
    if (!assignEmail.trim()) { setNotice('أدخل بريد الأنصار.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/assign`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: assignEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الإرسال');
      setNotice('أُرسلت التذكرة إلى حساب الأنصار (تذاكري).');
      setAssignFor(null); setAssignEmail('');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإرسال');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('إلغاء هذه التذكرة؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/cancel`, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) throw new Error('تعذر الإلغاء');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإلغاء');
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500";
  const label = "text-[11px] font-bold text-zinc-400 mb-1 block";

  return (
    <div className="space-y-4" dir="rtl">
      {/* Zone d'impression : seule visible sur papier / PDF */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-ticket, #print-ticket * { visibility: visible !important; }
          #print-ticket { position: fixed !important; inset: 0 !important; left: 0 !important; top: 0 !important; }
        }
      `}</style>
      <div id="print-ticket" style={{ position: 'absolute', left: '-10000px', top: 0, width: '340px', background: '#ffffff', color: '#000000', padding: '24px', fontFamily: 'sans-serif' }} dir="rtl">
        {printTicket && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><ClubLogo size={72} /></div>
            <p style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, margin: 0 }}>نادي شباب أهلي برج بوعريريج (CABBA)</p>
            <p style={{ textAlign: 'center', fontSize: 13, margin: '6px 0 0' }}>{printTicket.matchLabel ?? ''}</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0', background: '#ffffff' }}>
              <QRCodeSVG value={printTicket.code} size={180} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <p style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 22, letterSpacing: 4, margin: '4px 0' }}>{printTicket.code}</p>
            <p style={{ textAlign: 'center', fontSize: 12, margin: '4px 0' }}>
              {CAT[printTicket.category] ?? printTicket.category} · {printTicket.price} د.ج{printTicket.holderName ? ` · ${printTicket.holderName}` : ''}
            </p>
            <p style={{ textAlign: 'center', fontSize: 11, marginTop: 14, color: '#333' }}>
              تذكرة صالحة لدخول واحد — كل مرور مسجل بالبوابة والوقت واسم المراقب
            </p>
          </>
        )}
      </div>

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

        <label className="block">
          <span className={label}>المباراة</span>
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={input}>
            <option value="" className="bg-zinc-900">— اختر المباراة —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id} className="bg-zinc-900">
                {m.home_team} — {m.away_team} ({(m.match_date ?? '').slice(0, 10)})
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>اسم حامل التذكرة (اختياري)</span>
            <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={100}
              placeholder="مثال : خريف أحمد" className={input} />
          </label>
          <label className="block">
            <span className={label}>الفئة</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
              <option value="virage" className="bg-zinc-900">منعرج (virage)</option>
              <option value="tribune" className="bg-zinc-900">منصة (tribune)</option>
              <option value="vip" className="bg-zinc-900">VIP</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>السعر بالدينار (د.ج)</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0}
              placeholder="300" className={input} />
          </label>
          <label className="block">
            <span className={label}>بريد الأنصار — إرسال لحسابه (اختياري)</span>
            <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} type="email"
              placeholder="supporter@example.com" className={input} />
          </label>
        </div>

        <button onClick={() => void issue()} disabled={busy}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
          + إصدار التذكرة
        </button>

        {issued && (
          <div className="bg-zinc-950 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-xl flex-shrink-0">
                <QRCodeSVG value={issued.code} size={96} />
              </div>
              <div className="min-w-0">
                <p className="text-emerald-400 font-bold text-sm">تذكرة صالحة — اطبعها أو أرسلها</p>
                <p className="text-white font-mono text-lg tracking-widest mt-1">{issued.code}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {CAT[issued.category] ?? issued.category} · {issued.price.toLocaleString('ar-DZ')} د.ج
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button onClick={() => doPrint(issued)}
                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold py-2 rounded-lg transition-colors">
                <Printer size={14} /> طباعة / PDF
              </button>
              <button onClick={() => void copyCode(issued.code)}
                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold py-2 rounded-lg transition-colors">
                <Copy size={14} /> نسخ الرمز
              </button>
              <button onClick={() => { window.location.hash = '#/scanner'; }}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold py-2 rounded-lg transition-colors">
                <ScanLine size={14} /> فتح الماسح
              </button>
            </div>
          </div>
        )}
      </div>

      {matchId && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3">عدادات المباراة</h3>
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

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 max-h-96 overflow-y-auto">
            {tickets.length === 0 ? (
              <p className="text-center text-zinc-600 text-xs py-4">لا تذاكر لهذه المباراة بعد</p>
            ) : tickets.map((t) => (
              <div key={t.id} className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-mono text-sm tracking-wider">{t.code}</p>
                    <p className="text-[10px] text-zinc-500">
                      {CAT[t.category] ?? t.category} · {t.price.toLocaleString('ar-DZ')} د.ج · {t.holderName || 'بدون اسم'}
                      {t.usedAt ? ` · دخل من ${t.usedGate || '؟'}` : ''}
                      {t.ownerId ? ' · مرسلة لحساب أنصار' : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                    t.status === 'valid' ? 'bg-yellow-500/10 text-yellow-400'
                    : t.status === 'used' ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'}`}>
                    {t.status === 'valid' ? 'صالحة' : t.status === 'used' ? 'مستعملة' : 'ملغاة'}
                  </span>
                  <button onClick={() => doPrint(t)} aria-label="طباعة" className="text-zinc-500 hover:text-white p-1"><Printer size={14} /></button>
                  <button onClick={() => void copyCode(t.code)} aria-label="نسخ الرمز" className="text-zinc-500 hover:text-white p-1"><Copy size={14} /></button>
                  {t.status === 'valid' && (
                    <button onClick={() => void cancel(t.id)} disabled={busy} aria-label="إلغاء" className="text-zinc-600 hover:text-red-400 p-1"><XCircle size={15} /></button>
                  )}
                </div>
                {t.status === 'valid' && (
                  assignFor === t.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} type="email"
                        placeholder="بريد الأنصار المسجل في التطبيق" className={input + " !py-2 !text-xs"} />
                      <button onClick={() => void assign(t.id)} disabled={busy}
                        className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0">
                        <Send size={12} /> ربط
                      </button>
                      <button onClick={() => setAssignFor(null)} className="text-zinc-500 text-xs px-2">إلغاء</button>
                    </div>
                  ) : !t.ownerId ? (
                    <button onClick={() => { setAssignFor(t.id); setAssignEmail(''); }}
                      className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold">
                      <Send size={11} /> إرسال إلى حساب أنصار
                    </button>
                  ) : null
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
