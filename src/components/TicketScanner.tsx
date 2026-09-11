// مراقبة التذاكر الإلكترونية — scanneur de portique sur mobile.
// Caméra via BarcodeDetector (natif Chrome/Android) + saisie manuelle en
// repli (iPhone, caméra refusée). Sons générés en WebAudio : bip montant
// « OK » / double buzz « rejet » + vibrations + flash plein écran.
// Aucune vérification hors-ligne en v1 : réseau absent = flash orange,
// JAMAIS de faux OK (la recette du club ne tolère pas d'entrée non validée).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, WifiOff, Keyboard } from 'lucide-react';

interface ScanMatch { id: string; label: string; }
interface Flash { kind: 'ok' | 'bad' | 'net'; title: string; sub: string; }
interface Recent { result: string; gate: string; at: string; holder: string; }

const REASONS: Record<string, string> = {
  already_used: 'استُعملت بالفعل — مرفوضة',
  invalid: 'تذكرة غير صحيحة',
  cancelled: 'تذكرة ملغاة',
  wrong_match: 'ليست تذكرة هذه المباراة',
};

export default function TicketScanner() {
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [matchId, setMatchId] = useState('');
  const [gate, setGate] = useState('A');
  const [running, setRunning] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [entries, setEntries] = useState<number | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const flashTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetch('/api/matches', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = (data?.matches ?? []).map((m: any) => ({
          id: m.id,
          label: `${m.homeTeam ?? m.home_team} — ${m.awayTeam ?? m.away_team} (${m.date ?? m.matchDate ?? ''})`,
        }));
        setMatches(list);
        if (list.length) setMatchId(list[0].id);
      })
      .catch(() => setMatches([]));
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, []);

  const beep = useCallback((freq: number, dur: number, delay = 0) => {
    const ctx = audioRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }, []);

  const showFlash = useCallback((f: Flash) => {
    setFlash(f);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1600);
  }, []);

  const handleCode = useCallback(async (code: string) => {
    const now = Date.now();
    if (code === lastCodeRef.current.code && now - lastCodeRef.current.at < 2500) return;
    lastCodeRef.current = { code, at: now };
    setBusy(true);
    try {
      const res = await fetch('/api/tickets/scan', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, gate, matchId }),
      });
      if (!res.ok) throw new Error('scan');
      const data = await res.json();
      if (typeof data.entries === 'number') setEntries(data.entries);
      const holder = data.ticket?.holder ?? '';
      setRecent((prev) => [{ result: data.result, gate, at: new Date().toISOString(), holder }, ...prev].slice(0, 12));
      if (data.result === 'ok') {
        beep(880, 0.12); beep(1320, 0.16, 0.13);
        if (navigator.vibrate) navigator.vibrate([80]);
        showFlash({ kind: 'ok', title: 'دخول مقبول', sub: holder || 'تذكرة صالحة' });
      } else {
        beep(220, 0.22); beep(180, 0.26, 0.24);
        if (navigator.vibrate) navigator.vibrate([250, 80, 250]);
        const sub = data.result === 'already_used' && data.firstUse
          ? `أول دخول: ${new Date(data.firstUse).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}`
          : (REASONS[data.result] ?? 'مرفوضة');
        showFlash({ kind: 'bad', title: 'دخول مرفوض', sub });
      }
    } catch {
      beep(440, 0.35);
      if (navigator.vibrate) navigator.vibrate([120]);
      showFlash({ kind: 'net', title: 'لا يوجد شبكة', sub: 'التحقق مستحيل — لا دخول بدون تحقق' });
    } finally {
      setBusy(false);
    }
  }, [gate, matchId, beep, showFlash]);

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const BD = (window as any).BarcodeDetector;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !videoRef.current) { stream?.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        if (BD) {
          const detector = new BD({ formats: ['qr_code'] });
          timer = window.setInterval(async () => {
            if (document.hidden || !videoRef.current || busy) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length && codes[0].rawValue) void handleCode(codes[0].rawValue);
            } catch { /* image pas encore nette */ }
          }, 350);
        } else {
          setCameraNote('unsupported');
        }
      } catch {
        setCameraNote('denied');
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [running, handleCode, busy]);

  const start = () => {
    if (!audioRef.current) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) audioRef.current = new AC();
    }
    audioRef.current?.resume().catch(() => undefined);
    setRunning(true);
  };

  return (
    <div className="space-y-4 pb-4" dir="rtl">
      {/* Flash plein écran OK / rejet / réseau */}
      {flash && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 ${
          flash.kind === 'ok' ? 'bg-green-600' : flash.kind === 'bad' ? 'bg-red-700' : 'bg-orange-600'}`}
          role="alert">
          {flash.kind === 'ok' ? <CheckCircle2 size={96} className="text-white" />
            : flash.kind === 'bad' ? <XCircle size={96} className="text-white" />
            : <WifiOff size={96} className="text-white" />}
          <p className="text-white text-3xl font-black">{flash.title}</p>
          <p className="text-white/90 text-lg font-bold">{flash.sub}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white text-lg flex items-center gap-2">
          <ScanLine size={20} className="text-emerald-400" /> مراقبة التذاكر
        </h2>
        {entries !== null && (
          <span className="text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            الدخول: {entries.toLocaleString('ar-DZ')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500">
          {matches.length === 0 && <option value="">لا مباريات — أنشئها من لوحة الإدارة</option>}
          {matches.map((m) => <option key={m.id} value={m.id} className="bg-zinc-900">{m.label}</option>)}
        </select>
        <input value={gate} onChange={(e) => setGate(e.target.value)} maxLength={50}
          placeholder="البوابة (A, B, منعرج…)"
          className="bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500" />
      </div>

      {!running ? (
        <button onClick={start}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <ScanLine size={20} /> تشغيل الماسح
        </button>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-[4/3]">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          {cameraNote && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/90 p-4 text-center">
              <AlertTriangle size={28} className="text-orange-400" />
              <p className="text-zinc-300 text-xs leading-relaxed">
                {cameraNote === 'denied'
                  ? 'الكاميرا مرفوضة — استعمل التحقق اليدوي بالأسفل.'
                  : 'هاتفك لا يقرأ QR بالكاميرا عبر المتصفح — استعمل التحقق اليدوي بالأسفل (أو هاتفاً أندرويد).'}
              </p>
            </div>
          )}
          <div className="absolute inset-x-8 inset-y-8 border-2 border-emerald-400/70 rounded-2xl pointer-events-none" />
        </div>
      )}

      {/* Repli manuel (iPhone, caméra refusée, douchette Bluetooth série…) */}
      <div className="flex items-center gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)}
          placeholder="أو الصق رمز التذكرة يدوياً…"
          className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500" />
        <button onClick={() => { if (manual.trim()) { void handleCode(manual.trim()); setManual(''); } }}
          disabled={busy || !manual.trim()}
          aria-label="تحقق يدوي"
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-3 rounded-xl transition-colors disabled:opacity-40">
          <Keyboard size={18} />
        </button>
      </div>

      {recent.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-zinc-500">آخر العمليات</p>
          {recent.map((r, i) => (
            <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
              <span className={`w-2 h-2 rounded-full ${r.result === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="flex-1 text-xs text-zinc-300 truncate">
                {r.result === 'ok' ? 'مقبول' : REASONS[r.result] ?? r.result}{r.holder ? ` — ${r.holder}` : ''}
              </span>
              <span className="text-[10px] text-zinc-600">بوابة {r.gate} · {new Date(r.at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
