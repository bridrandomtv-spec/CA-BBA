// تذاكري — cartes QR réelles liées au compte (tickets.owner_id).
// Remplace l'ancien placeholder « TICKET-78X92 » qui ne désignait personne.
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket as TicketIcon } from 'lucide-react';

interface MyTicket {
  id: string;
  code: string;
  category: string;
  price: number;
  status: string;
  usedAt: string | null;
  usedGate: string | null;
  matchLabel?: string;
}

const CAT: Record<string, string> = { virage: 'منعرج', tribune: 'منصة', vip: 'VIP' };

export default function MyTickets() {
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/tickets/mine', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTickets(d?.tickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setLoaded(true));
  }, []);

  // Aucun ticket : pas de bloc mort, rien ne s'affiche.
  if (loaded && tickets.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
          <TicketIcon size={18} className="text-yellow-500" /> تذاكري
        </h3>
        <span className="text-xs text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded-md border border-green-500/30">
          {tickets.length} تذكرة
        </span>
      </div>
      <div className="space-y-3">
        {!loaded ? (
          <p className="text-center text-zinc-600 text-xs py-4">جاري التحميل…</p>
        ) : tickets.map((t) => (
          <div key={t.id} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 flex items-center gap-4">
            <div className="p-2 rounded-xl bg-white flex-shrink-0">
              <QRCodeSVG value={t.code} size={84} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate">{t.matchLabel ?? 'مباراة'}</p>
              <p className="text-yellow-500 font-bold text-xs tracking-widest font-mono mt-1">{t.code}</p>
              <p className="text-zinc-500 text-[10px] mt-1">
                {CAT[t.category] ?? t.category} · {t.price.toLocaleString('ar-DZ')} د.ج
              </p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded font-bold flex-shrink-0 ${
              t.status === 'valid' ? 'bg-yellow-500/10 text-yellow-400'
              : t.status === 'used' ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'}`}>
              {t.status === 'valid' ? 'صالحة' : t.status === 'used' ? `مستعملة${t.usedGate ? ` · ${t.usedGate}` : ''}` : 'ملغاة'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
        اعرض رمز QR عند الباب : دخول واحد لكل تذكرة، وكل مرور مسجل بالبوابة والوقت.
      </p>
    </div>
  );
}
