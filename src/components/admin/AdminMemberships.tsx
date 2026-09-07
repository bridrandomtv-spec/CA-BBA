import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, X, Search, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export interface Membership {
  id: string;
  userId: string;
  userName: string;
  memberNumber: string;
  type: string; // 'standard', 'gold', 'vip'
  status: string; // 'active', 'suspended', 'expired'
  startDate: string;
  expirationDate: string;
  createdAt: number;
}

export default function AdminMemberships({ onBack }: { onBack: () => void }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isEditing, setIsEditing] = useState<Membership | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [type, setType] = useState('standard');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  useEffect(() => {
    fetch('/api/memberships')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('memberships')))
      .then((data) => setMemberships(data.memberships ?? []))
      .catch((error) => console.error('[CABBA] memberships:', error));
  }, []);

  const resetForm = () => {
    setUserId('');
    setUserName('');
    setType('standard');
    setStatus('active');
    setStartDate('');
    setExpirationDate('');
    setIsEditing(null);
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!userId || !startDate || !expirationDate) return alert('الرجاء إكمال جميع الحقول');
    try {
      const url = isEditing ? `/api/memberships/${isEditing.id}` : '/api/memberships';
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, status, startDate, expirationDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطأ في حفظ العضوية');
      if (isEditing) setMemberships((prev) => prev.map((m) => m.id === isEditing.id ? data.membership : m));
      else setMemberships((prev) => [data.membership, ...prev]);
      resetForm();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'خطأ في حفظ العضوية');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف العضوية؟')) return;
    try {
      const res = await fetch(`/api/memberships/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete');
      setMemberships((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error(e);
      alert('خطأ في الحذف');
    }
  };
  
  const handleRenew = (m: Membership) => {
      setIsEditing(m);
      setUserId(m.userId);
      setUserName(m.userName);
      setType(m.type);
      setStatus('active');
      setStartDate(new Date().toISOString().split('T')[0]);
      
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setExpirationDate(nextYear.toISOString().split('T')[0]);
  };

  const filtered = memberships.filter(m => 
    m.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.memberNumber.includes(searchQuery)
  );

  return (
    <div className="p-4" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="bg-zinc-800 p-2 rounded-xl text-zinc-400 hover:text-white">
          العودة
        </button>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="text-yellow-500" />
          إدارة العضويات
        </h2>
      </div>

      {(isAdding || isEditing) ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">{isEditing ? 'تعديل عضوية' : 'إضافة عضوية جديدة'}</h3>
            <button onClick={resetForm} className="text-zinc-500 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">معرف المستخدم (UID)</label>
              <input type="text" value={userId} onChange={e => setUserId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">اسم العضو</label>
              <input type="text" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">نوع العضوية</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none">
                  <option value="standard">Standard</option>
                  <option value="gold">Gold</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">الحالة</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none">
                  <option value="active">نشط</option>
                  <option value="suspended">معلق</option>
                  <option value="expired">منتهي</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">تاريخ البداية</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">تاريخ الانتهاء</label>
                <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none" />
              </div>
            </div>
            
            <button onClick={handleSave} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold p-3 rounded-xl transition-colors">
              حفظ
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input 
                type="text" 
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:border-yellow-500 outline-none"
              />
            </div>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              إضافة
            </button>
          </div>

          <div className="space-y-4">
            {filtered.map(m => (
              <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-lg">{m.userName}</h3>
                    <p className="text-zinc-500 text-sm font-mono">{m.memberNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                       m.status === 'active' ? 'bg-green-500/20 text-green-500 border border-green-500/20' :
                       m.status === 'suspended' ? 'bg-red-500/20 text-red-500 border border-red-500/20' :
                       'bg-zinc-800 text-zinc-400 border border-zinc-700'
                     }`}>
                       {m.status === 'active' && <CheckCircle2 size={12} />}
                       {m.status === 'suspended' && <AlertCircle size={12} />}
                       {m.status === 'expired' && <Clock size={12} />}
                       {m.status}
                     </span>
                     <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                       m.type === 'vip' ? 'bg-purple-500/20 text-purple-400' :
                       m.type === 'gold' ? 'bg-yellow-500/20 text-yellow-500' :
                       'bg-zinc-800 text-zinc-300'
                     }`}>
                       {m.type}
                     </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-zinc-400 bg-zinc-800/50 p-2 rounded-xl">
                  <div>
                    <span className="block text-zinc-500 mb-1">تاريخ البداية</span>
                    <span className="font-bold">{m.startDate}</span>
                  </div>
                  <div>
                    <span className="block text-zinc-500 mb-1">تاريخ الانتهاء</span>
                    <span className="font-bold">{m.expirationDate}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleRenew(m)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-xl text-xs font-bold transition-colors">
                    تجديد
                  </button>
                  <button onClick={() => {
                    setIsEditing(m);
                    setUserId(m.userId);
                    setUserName(m.userName);
                    setType(m.type);
                    setStatus(m.status);
                    setStartDate(m.startDate);
                    setExpirationDate(m.expirationDate);
                  }} className="bg-zinc-800 hover:bg-zinc-700 text-yellow-500 p-2 rounded-xl transition-colors">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="bg-zinc-800 hover:bg-red-500/20 text-red-500 p-2 rounded-xl transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد عضويات</p>}
          </div>
        </>
      )}
    </div>
  );
}
