// مراقبة التذاكر الإلكترونية عند الباب — هاتف واحد يكفي.
// Caméra (BarcodeDetector natif Chrome/Android) ou saisie manuelle du
// code (iPhone / secours). Une requête serveur par scan ; sons et
// vibrations générés localement (WebAudio) : bip OK / alarme rejet.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, ScanLine, XCircle } from 'lucide-react';

interface Flash { kind: 'ok' | 'reject'; title: string; detail: string; entries?: number; }

export default function TicketScanner() {
  const [gate, setGate] = useState('باب 1');
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [counts, setCounts] = useState({ ok: 0, reject: 0 });
  const [entries, setEntries] = useState<number | null>(null);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const flashTimerRef = useRef<number | null>(null);

  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  // ---- sons locaux (aucun fichier externe) ----
  const beep = useCallback((kind: 'ok' | 'reject') => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const play = (freq: number, start: number, dur: number, type: OscillatorType) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      };
      if (kind === 'ok') {
        play(880, 0, 0.12, 'sine');
        play(1320, 0.14, 0.16, 'sine');
      } else {
        play(170, 0, 0.22, 'square');
        play(170, 0.28, 0.22, 'square');
      }
    } catch {
      // silence acceptable : le flash couleur reste lisible
    }
  }, []);

  const scan = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    // anti-rebond : même code ignoré 3 s
    const now = Date.now();
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 3000) return;
    lastCodeRef.current = { code, at: now };

    try {
      const res = await fetch('/api/tickets/scan', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, gate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر التحقق');
      if (data.result === 'ok') {
        beep('ok');
        if (navigator.vibrate) navigator.vibrate(90);
        setFlash({
          kind: 'ok',
          title: 'تذكرة صالحة — ادخل',
          detail: `${data.ticket?.holderName || 'حامل التذكرة'} · ${data.ticket?.category ?? ''}`,
          entries: data.entries,
        });
        setCounts((c) => ({ ...c, ok: c.ok + 1 }));
        if (typeof data.entries === 'number') setEntries(data.entries);
      } else {
        beep('reject');
        if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
        setFlash({
          kind: 'reject',
          title: data.result === 'used' ? 'مستعملة — ارفض' : data.result === 'cancelled' ? 'ملغاة — ارفض' : 'غير موجودة — ارفض',
          detail: data.ticket ? `${data.ticket.code} · ${data.ticket.usedGate ?? ''}` : code,
        });
        setCounts((c) => ({ ...c, reject: c.reject + 1 }));
      }
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setFlash(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التحقق');
    }
  }, [gate, beep]);

  const stop = useCallback(() => {
    if (loopRef.current) { window.clearInterval(loopRef.current); loopRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    // geste utilisateur : le contexte audio peut démarrer
    beep('ok');
    if (!hasDetector) {
      setError('متصفحك لا يملك كاشف رموز — استعمل إدخال الرمز يدوياً بالأسفل.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const BD = (window as any).BarcodeDetector;
      const detector = new BD({ formats: ['qr_code'] });
      setRunning(true);
      loopRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length && codes[0].rawValue) void scan(codes[0].rawValue);
        } catch { /* image pas prête */ }
      }, 250);
    } catch (e) {
      setError('تعذر فتح الكاميرا — استعمل الإدخال اليدوي.');
      stop();
    }
  }, [hasDetector, scan, beep, stop]);

  useEffect(() => () => {
    if (loopRef.current) window.clearInterval(loopRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (audioRef.current) void audioRef.current.close();
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950" dir="rtl">
      {/* flash plein écran OK / REJET */}
      {flash && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 ${
          flash.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {flash.kind === 'ok' ? <CheckCircle2 size={96} className="text-white" /> : <XCircle size={96} className="text-white" />}
          <p className="text-white text-3xl font-black">{flash.title}</p>
          <p className="text-white/90 text-sm font-bold">{flash.detail}</p>
          {typeof flash.entries === 'number' && (
            <p className="text-white/80 text-xs">إجمالي الداخلين : {flash.entries.toLocaleString('ar-DZ')}</p>
          )}
        </div>
      )}

      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white text-lg flex items-center gap-2">
            <ScanLine size={20} className="text-emerald-500" /> مراقبة التذاكر
          </h2>
          <input value={gate} onChange={(e) => setGate(e.target.value)} maxLength={40}
            aria-label="البوابة" className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white w-28 text-center" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2">
            <p className="text-emerald-400 font-bold text-lg">{counts.ok}</p>
            <p className="text-[10px] text-zinc-500">مقبولة (جلسة)</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2">
            <p className="text-red-400 font-bold text-lg">{counts.reject}</p>
            <p className="text-[10px] text-zinc-500">مرفوضة (جلسة)</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2">
            <p className="text-white font-bold text-lg">{entries ?? '—'}</p>
            <p className="text-[10px] text-zinc-500">داخل الملعب</p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90">
              <Camera size={40} className="text-zinc-600" />
              <button onClick={() => void start()}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm px-6 py-3 rounded-xl transition-colors">
                بدء المراقبة بالكاميرا
              </button>
              {!hasDetector && <p className="text-zinc-500 text-[10px] px-6 text-center">كاميرا غير مدعومة هنا — الإدخال اليدوي متاح بالأسفل</p>}
            </div>
          )}
          {running && (
            <button onClick={stop} aria-label="إيقاف الكاميرا"
              className="absolute top-2 left-2 bg-black/60 text-white p-2 rounded-full">
              <CameraOff size={16} />
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

        <div className="flex items-center gap-2">
          <input value={manual} onChange={(e) => setManual(e.target.value)} maxLength={24}
            placeholder="أو اكتب رمز التذكرة يدوياً"
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-3 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500" />
          <button onClick={() => { void scan(manual); setManual(''); }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm px-4 py-3 rounded-xl transition-colors flex-shrink-0">
            تحقق
          </button>
        </div>

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          كل مرور (مقبول أو مرفوض) يُسجَّل في دفتر المراقبة مع البوابة والوقت واسم المراقب —
          دليل النادي في حالة أي طعن.
        </p>
      </div>
    </div>
  );
}
