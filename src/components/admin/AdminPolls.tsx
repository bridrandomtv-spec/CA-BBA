// إدارة الاستطلاعات — création et clôture des sondages (pendant admin de
// FanPolls). Formulaire borné au contrat serveur : 2 à 5 options, libellés
// uniques, question ≤ 500 caractères.
import { useCallback, useEffect, useState } from 'react';
import { BarChart2, ChevronRight, Loader2, Plus, X, Lock } from 'lucide-react';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

interface AdminPoll {
  id: string;
  question: string;
  status: 'open' | 'closed';
  createdAt: string;
  options: Array<{ id: string; label: string; votes: number }>;
}

export default function AdminPolls({ onBack }: { onBack: () => void }) {
  const [polls, setPolls] = useState<AdminPoll[] | null>(null);
  const [question, setQuestion] = useState('');
  const [optionLabels, setOptionLabels] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/polls', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`polls → ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setPolls(Array.isArray(data?.polls) ? data.polls : []);
    } catch (error) {
      console.error('[CABBA] admin polls:', error);
      setPolls([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addOption = () => {
    if (optionLabels.length < MAX_OPTIONS) setOptionLabels((prev) => [...prev, '']);
  };
  const removeOption = (index: number) => {
    setOptionLabels((prev) => (prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev));
  };
  const updateOption = (index: number, value: string) => {
    setOptionLabels((prev) => prev.map((label, i) => (i === index ? value : label)));
  };

  const handleCreate = async () => {
    const cleanOptions = optionLabels.map((label) => label.trim()).filter(Boolean);
    if (!question.trim()) { setNotice('أدخل نص الاستطلاع.'); return; }
    if (cleanOptions.length < MIN_OPTIONS) { setNotice(`أضف ${MIN_OPTIONS} خيارات على الأقل.`); return; }
    if (new Set(cleanOptions).size !== cleanOptions.length) { setNotice('الخيارات المكررة غير مسموحة.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: cleanOptions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر إنشاء الاستطلاع');
      setQuestion('');
      setOptionLabels(['', '']);
      setNotice('تم إنشاء الاستطلاع ونشره للجماهير.');
      await load();
    } catch (error) {
      console.error('[CABBA] poll create:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر إنشاء الاستطلاع');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (pollId: string) => {
    if (!window.confirm('إغلاق الاستطلاع نهائياً؟ لن يتمكن المشجعون من التصويت بعده.')) return;
    setClosingId(pollId);
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/close`, {
        method: 'PATCH',
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر إغلاق الاستطلاع');
      await load();
    } catch (error) {
      console.error('[CABBA] poll close:', error);
      setNotice(error instanceof Error ? error.message : 'تعذر إغلاق الاستطلاع');
    } finally {
      setClosingId(null);
    }
  };

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

      {/* Formulaire de création */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-yellow-500" />
          إنشاء استطلاع جديد
        </h3>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="نص السؤال (مثال: من هو أفضل لاعب في المباراة؟)"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-yellow-500 mb-3"
        />
        <div className="space-y-2">
          {optionLabels.map((label, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={label}
                onChange={(e) => updateOption(index, e.target.value)}
                maxLength={200}
                placeholder={`الخيار ${index + 1}`}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-yellow-500"
              />
              {optionLabels.length > MIN_OPTIONS && (
                <button
                  onClick={() => removeOption(index)}
                  aria-label={`حذف الخيار ${index + 1}`}
                  className="px-3 rounded-xl bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          {optionLabels.length < MAX_OPTIONS && (
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-colors"
            >
              <Plus size={14} /> إضافة خيار
            </button>
          )}
          <button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            نشر الاستطلاع
          </button>
        </div>
      </div>

      {/* Sondages existants */}
      <div className="space-y-3">
        {polls === null ? (
          <div className="py-10 flex justify-center"><Loader2 size={24} className="animate-spin text-yellow-500" /></div>
        ) : polls.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-8">لا توجد استطلاعات منشورة.</p>
        ) : (
          polls.map((poll) => {
            const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
            return (
              <div key={poll.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-bold text-white text-sm leading-snug">{poll.question}</h4>
                  {poll.status === 'open' ? (
                    <button
                      onClick={() => void handleClose(poll.id)}
                      disabled={closingId === poll.id}
                      className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:text-red-400 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {closingId === poll.id ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                      إغلاق
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] bg-zinc-800 text-zinc-500 px-2.5 py-1.5 rounded-lg font-bold">مغلق</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {poll.options.map((option) => (
                    <div key={option.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 truncate">{option.label}</span>
                      <span className="text-yellow-500 font-black shrink-0">
                        {total > 0 ? Math.round((option.votes / total) * 100) : 0}% · {option.votes}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
