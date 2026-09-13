// إدارة المستخدمين — version « invitation & propreté » :
// 1. bouton « إضافة مستخدم » : création admin SANS mot de passe en clair —
//    un lien d'invitation (30 min, usage unique) s'affiche et part par email ;
// 2. comptes anonymisés (« حساب محذوف ») MASQUÉS par défaut — filtre dédié ;
// 3. recherche + filtres (نشطاء / محذوفون / الكل) ;
// 4. anonymisation côté admin (corbeille) avec window.confirm — vraie porte
//    de confirmation ; interdite sur soi-même (UI + serveur).
import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, UserPlus, Search, Trash2, Copy, X } from 'lucide-react';

interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin' | 'scanner';
  createdAt: string;
  deletedAt: string | null;
}

type Filter = 'active' | 'deleted' | 'all';

const ROLE_BADGE: Record<AppUser['role'], string> = {
  admin: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40',
  scanner: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40',
  user: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const ROLE_LABEL: Record<AppUser['role'], string> = {
  admin: 'مدير',
  scanner: 'مراقب',
  user: 'مناصر',
};

export default function AdminUsers({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'scanner'>('user');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (f: Filter) => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/users${f === 'active' ? '' : '?includeDeleted=1'}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('http');
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setLoadError(true);
      setUsers(null);
    }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.user && d.user.id) setMe(d.user.id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const changeRole = async (uid: string, role: string) => {
    setSavingId(uid);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}/role`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers((prev) => (prev ?? []).map((u) => (u.uid === uid ? { ...u, role: role as AppUser['role'] } : u)));
        setNotice('تم تحديث الصلاحيات ✓');
      } else {
        const b = await res.json().catch(() => ({}));
        setNotice((b && b.error) || 'تعذر تحديث الصلاحيات.');
      }
    } catch {
      setNotice('تعذر الوصول إلى الخادم.');
    } finally {
      setSavingId(null);
    }
  };

  const createUser = async () => {
    setAddBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), displayName: newName.trim(), role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteUrl(data.inviteUrl ?? null);
        setNewEmail('');
        setNewName('');
        setNewRole('user');
        void load(filter);
      } else {
        const b = await res.json().catch(() => ({}));
        setNotice((b && b.error) || 'تعذر إنشاء الحساب.');
      }
    } catch {
      setNotice('تعذر الوصول إلى الخادم.');
    } finally {
      setAddBusy(false);
    }
  };

  const anonymize = async (uid: string, name: string) => {
    if (!window.confirm(`إخفاء الحساب « ${name} » نهائياً من القائمة ؟ السجلات المحاسبية تُحفظ.`)) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setNotice('تم إخفاء الحساب ✓');
        void load(filter);
      } else {
        const b = await res.json().catch(() => ({}));
        setNotice((b && b.error) || 'تعذر إخفاء الحساب.');
      }
    } catch {
      setNotice('تعذر الوصول إلى الخادم.');
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice(inviteUrl);
    }
  };

  const visible = (users ?? []).filter((u) => {
    if (filter === 'active' && u.deletedAt) return false;
    if (filter === 'deleted' && !u.deletedAt) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (u.displayName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div>
          <h3 className="font-bold text-white">إدارة المستخدمين</h3>
          <p className="text-xs text-zinc-400 mt-1">الحسابات المسجلة فعلياً فقط افتراضياً — المحذوفون في فلتر خاص.</p>
        </div>
        <button onClick={onBack} className="p-2 bg-zinc-800 text-zinc-300 rounded-full hover:text-white">
          <ArrowRight size={18} />
        </button>
      </div>

      {notice && (
        <div role="status" aria-live="polite"
          className="p-3 rounded-xl border text-sm font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={15} className="text-zinc-500 absolute top-1/2 -translate-y-1/2 right-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو البريد…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pr-9 pl-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => { setAddOpen(true); setInviteUrl(null); }}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 rounded-xl flex items-center gap-2 text-sm"
          >
            <UserPlus size={16} /> إضافة مستخدم
          </button>
        </div>
        <div className="flex gap-2">
          {([['active', 'النشطاء'], ['deleted', 'المحذوفون'], ['all', 'الكل']] as Array<[Filter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                filter === key
                  ? 'bg-yellow-500 text-black border-yellow-500'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {users === null && !loadError && (
        <div className="py-10 flex justify-center text-zinc-400 text-sm">جاري تحميل المستخدمين…</div>
      )}
      {loadError && (
        <div className="py-10 text-center text-sm text-red-400 font-bold">تعذر تحميل قائمة المستخدمين.</div>
      )}
      {users !== null && visible.length === 0 && !loadError && (
        <p className="text-center text-zinc-500 text-sm py-10">لا يوجد مستخدمون في هذا الفلتر.</p>
      )}

      <div className="space-y-3">
        {visible.map((u) => (
          <div key={u.uid} className={`p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 flex flex-col gap-3 ${u.deletedAt ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                {(u.displayName || '؟').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-sm truncate">{u.displayName}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ROLE_BADGE[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                  {u.deletedAt && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/40">
                      محذوف
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate" dir="ltr">{u.email}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  مسجل منذ {new Date(u.createdAt).toLocaleDateString('ar-DZ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => void changeRole(u.uid, e.target.value)}
                disabled={u.uid === me || savingId !== null || !!u.deletedAt}
                aria-label={`صلاحيات ${u.displayName || u.email}`}
                className="bg-transparent text-white text-sm outline-none flex-1 disabled:opacity-50"
              >
                <option value="user" className="bg-zinc-900">مشجع عادي</option>
                <option value="admin" className="bg-zinc-900">مدير (Admin)</option>
                <option value="scanner" className="bg-zinc-900">scanner — مراقب تذاكر</option>
              </select>
              {!u.deletedAt && u.uid !== me && (
                <button
                  onClick={() => void anonymize(u.uid, u.displayName || u.email)}
                  title="إخفاء الحساب (أنonymisation RGPD)"
                  className="p-2 bg-zinc-900 text-zinc-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" dir="rtl">
          <div className="bg-zinc-950 border border-zinc-800 rounded-t-3xl md:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <UserPlus size={18} className="text-yellow-500" /> إضافة مستخدم
              </h3>
              <button onClick={() => setAddOpen(false)} aria-label="إغلاق"
                className="p-2 bg-zinc-900 text-zinc-400 rounded-full hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="البريد الإلكتروني"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
                dir="ltr"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="الاسم الظاهر"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'scanner')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-500 focus:outline-none"
              >
                <option value="user">مشجع عادي</option>
                <option value="scanner">scanner — مراقب تذاكر</option>
              </select>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                لا يُختار أي كلمة مرور هنا : الحساب يولد بقفل عشوائي، وصاحبه يختار كلمته
                عبر رابط الدعوة (صالح 30 دقيقة، استخدام واحد). الترقية إلى مدير تتم لاحقاً من القائمة.
              </p>
            </div>

            {inviteUrl && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-green-400">تم إنشاء الحساب ✓ أرسل رابط الدعوة :</p>
                <input readOnly value={inviteUrl} dir="ltr"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-[10px] text-zinc-300 font-mono" />
                <button onClick={() => void copyInvite()}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                  <Copy size={13} /> {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
                </button>
              </div>
            )}

            <button onClick={() => void createUser()} disabled={addBusy}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl disabled:opacity-50 transition-colors">
              {addBusy ? 'جاري الإنشاء…' : 'إنشاء وإرسال الدعوة'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
