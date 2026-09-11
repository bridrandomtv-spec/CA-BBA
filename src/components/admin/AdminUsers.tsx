// إدارة المستخدمين — version corrigée :
//  1. alert() bloquants (2×) → notification inline ;
//  2. état vide ambigu : « جاري تحميل المستخدمين... » s'affichait AUSSI en cas
//     d'échec ou de liste réellement vide — chargement / erreur / vide sont
//     désormais trois états distincts ;
//  3. window.confirm conservé pour le changement de rôle : c'est une vraie
//     porte de confirmation pour une opération sensible (le serveur garde sa
//     propre garde anti-auto-rétrogradation).
import { useState, useEffect } from 'react';
import { AppUser } from '../../types';
import { Shield, User as UserIcon, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminUsers({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AppUser[] | null>(null); // null = chargement
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/users', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`users → ${res.status}`))))
      .then((data) => {
        if (!cancelled) setUsers(Array.isArray(data?.users) ? data.users : []);
      })
      .catch((error) => {
        console.error('[CABBA] users:', error);
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (uid === currentUser?.id) {
      setNotice('لا يمكنك تغيير صلاحياتك الخاصة');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من تغيير صلاحيات هذا المستخدم إلى ${newRole === 'admin' ? 'مدير' : 'مشجع عادي'}؟`)) return;

    setSavingId(uid);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}/role`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'خطأ في تحديث الصلاحيات');
      setUsers((prev) => (prev ?? []).map((u) => (u.uid === uid ? { ...u, role: newRole as AppUser['role'] } : u)));
      setNotice(newRole === 'admin' ? 'تمت الترقية إلى مدير.' : 'تم إرجاع المستخدم إلى مشجع عادي.');
    } catch (error) {
      console.error('[CABBA] role change:', error);
      setNotice(error instanceof Error ? error.message : 'خطأ في تحديث الصلاحيات');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold mb-4">
        <ChevronRight size={16} /> العودة
      </button>

      {notice && (
        <div role="status" aria-live="polite" className="mb-3 p-3 rounded-xl border text-sm font-bold bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-in fade-in duration-200">
          {notice}
        </div>
      )}

      {users === null && !loadError && (
        <div className="py-10 flex justify-center">
          <Loader2 size={24} className="animate-spin text-yellow-500" />
        </div>
      )}

      {loadError && (
        <div className="py-10 text-center text-sm text-red-400 font-bold">
          تعذر تحميل قائمة المستخدمين.
        </div>
      )}

      {users !== null && users.length === 0 && !loadError && (
        <p className="text-center text-zinc-500 text-sm py-10">لا يوجد مستخدمون بعد.</p>
      )}

      <div className="space-y-3">
        {(users ?? []).map((u) => (
          <div key={u.uid} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
                <UserIcon size={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-sm">{u.displayName || 'بدون اسم'}</h4>
                <p className="text-xs text-zinc-400" dir="ltr">{u.email}</p>
              </div>
              {savingId === u.uid && <Loader2 size={16} className="animate-spin text-yellow-500" />}
            </div>

            <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-700">
              <Shield size={16} className="text-yellow-500" />
              <select
                value={u.role}
                onChange={(e) => void handleRoleChange(u.uid, e.target.value)}
                disabled={u.uid === currentUser?.id || savingId !== null}
                aria-label={`صلاحيات ${u.displayName || u.email}`}
                className="bg-transparent text-white text-sm outline-none flex-1 disabled:opacity-50"
              >
                <option value="user" className="bg-zinc-900">مشجع عادي</option>
                <option value="admin" className="bg-zinc-900">مدير (Admin)</option>
                        <option value="scanner">scanner — مراقب تذاكر</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
