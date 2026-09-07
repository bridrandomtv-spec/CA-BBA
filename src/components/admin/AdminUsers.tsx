import { useState, useEffect } from 'react';
import { AppUser } from '../../types';
import { Shield, User as UserIcon, ChevronRight, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminUsers({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const { currentUser } = useAuth();
  
  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('users')))
      .then((data) => setUsers(data.users ?? []))
      .catch((error) => console.error('[CABBA] users:', error));
  }, []);

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (uid === currentUser?.id) {
      alert('لا يمكنك تغيير صلاحياتك الخاصة');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من تغيير صلاحيات هذا المستخدم إلى ${newRole}؟`)) return;
    try {
      const res = await fetch(`/api/users/${uid}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطأ في تحديث الصلاحيات');
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role: newRole as AppUser['role'] } : u));
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'خطأ في تحديث الصلاحيات');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold mb-4">
        <ChevronRight size={16} /> العودة
      </button>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.uid} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
                <UserIcon size={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-sm">{u.displayName || 'بدون اسم'}</h4>
                <p className="text-xs text-zinc-400">{u.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-700">
              <Shield size={16} className="text-yellow-500" />
              <select 
                value={u.role}
                onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                disabled={u.uid === currentUser?.id}
                className="bg-transparent text-white text-sm outline-none flex-1"
              >
                <option value="user" className="bg-zinc-900">مشجع عادي</option>
                <option value="admin" className="bg-zinc-900">مدير (Admin)</option>
              </select>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-zinc-500 text-sm">جاري تحميل المستخدمين...</p>}
      </div>
    </div>
  );
}
