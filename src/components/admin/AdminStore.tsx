import { useState, useEffect } from 'react';
import { Trash2, Edit2, ChevronRight, Save, X, Package, ShoppingCart } from 'lucide-react';
import MediaUploader from '../MediaUploader';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  active: boolean;
  createdAt: number;
}

export interface Order {
  id: string;
  userId: string;
  items: any[];
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: number;
}

export default function AdminStore({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Product Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('أقمصة');
  const [stock, setStock] = useState(0);
  const [active, setActive] = useState(true);

  const loadStore = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        fetch('/api/store/admin/products'),
        fetch('/api/store/orders'),
      ]);
      if (!productsRes.ok || !ordersRes.ok) throw new Error('store');
      const [productsData, ordersData] = await Promise.all([productsRes.json(), ordersRes.json()]);
      setProducts(productsData.products ?? []);
      setOrders(ordersData.orders ?? []);
    } catch (error) {
      console.error('[CABBA] admin store:', error);
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !imageUrl.trim()) return;
    setLoading(true);
    try {
      const url = isEditing ? `/api/store/products/${isEditing}` : '/api/store/products';
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, price, imageUrl, category, stock, active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطأ في الحفظ');
      if (isEditing) setProducts((prev) => prev.map((p) => p.id === isEditing ? data.product : p));
      else setProducts((prev) => [data.product, ...prev]);
      resetForm();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (p: Product) => {
    setIsEditing(p.id);
    setName(p.name);
    setDescription(p.description);
    setPrice(p.price);
    setImageUrl(p.imageUrl);
    setCategory(p.category);
    setStock(p.stock);
    setActive(p.active);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف المنتج؟')) return;
    try {
      const res = await fetch(`/api/store/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete');
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error(error);
      alert('خطأ في الحذف');
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setName('');
    setDescription('');
    setPrice(0);
    setImageUrl('');
    setCategory('أقمصة');
    setStock(0);
    setActive(true);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/store/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('status');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: status as Order['status'] } : o));
    } catch (error) {
      console.error(error);
      alert('خطأ في تحديث الطلب');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-yellow-500 text-sm font-bold">
          <ChevronRight size={16} /> العودة
        </button>
        <div className="flex bg-zinc-800 rounded-lg p-1">
          <button onClick={() => setActiveTab('products')} className={`px-4 py-1 text-xs font-bold rounded-md flex items-center gap-2 ${activeTab === 'products' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}>
            <Package size={14} /> المنتجات
          </button>
          <button onClick={() => setActiveTab('orders')} className={`px-4 py-1 text-xs font-bold rounded-md flex items-center gap-2 ${activeTab === 'orders' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}>
            <ShoppingCart size={14} /> الطلبات
          </button>
        </div>
      </div>

      {activeTab === 'products' && (
        <>
          <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
            <h3 className="font-bold text-white mb-4">{isEditing ? 'تعديل المنتج' : 'إضافة منتج'}</h3>
            <form onSubmit={handleProductSubmit} className="space-y-3">
              <input type="text" placeholder="اسم المنتج" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
              <textarea placeholder="الوصف" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white h-20" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="السعر (دج)" value={price} onChange={e => setPrice(parseInt(e.target.value)||0)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
                <input type="number" placeholder="المخزون" value={stock} onChange={e => setStock(parseInt(e.target.value)||0)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white" required />
              </div>
              <MediaUploader label="صورة المنتج" value={imageUrl} onChange={(url) => setImageUrl(url)} onClear={() => setImageUrl('')} accept="image/jpeg,image/png,image/webp,image/gif" folder="products" preview="image" required />
              
              <div className="flex gap-3">
                <select value={category} onChange={e => setCategory(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white">
                  <option value="أقمصة">أقمصة</option>
                  <option value="أطقم">أطقم</option>
                  <option value="أكسسوارات">أكسسوارات</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-white bg-zinc-900 px-3 rounded-lg border border-zinc-700">
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
                  متاح للبيع
                </label>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                  <Save size={16} /> حفظ
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm} className="px-4 bg-zinc-700 text-white rounded-lg"><X size={16} /></button>
                )}
              </div>
            </form>
          </div>

          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden">
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{p.name}</h4>
                    <p className="text-xs text-zinc-500">{p.price} دج - المخزون: {p.stock}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(p)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد منتجات</p>}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-sm">طلب: {o.id.slice(0,8)}</h4>
                  <p className="text-xs text-zinc-400">الإجمالي: {o.total} دج</p>
                </div>
                <select 
                  value={o.status}
                  onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                  className="bg-zinc-900 text-white text-xs border border-zinc-700 rounded p-1"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="confirmed">مؤكد</option>
                  <option value="processing">جاري التجهيز</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">مكتمل (تم التسليم)</option>
                  <option value="cancelled">ملغى</option>
                </select>
              </div>
              <div className="text-xs text-zinc-500">
                {o.items.length} منتجات في الطلب
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-center text-zinc-500 text-sm">لا توجد طلبات</p>}
        </div>
      )}
    </div>
  );
}
