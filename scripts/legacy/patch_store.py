import re

content = """import { useState, useEffect } from 'react';
import { ShoppingCart, QrCode, Tag, X, Plus, Minus, Image as ImageIcon } from 'lucide-react';
import { Product, CartItem } from '../types';
import { collection, onSnapshot, query, where, addDoc, runTransaction, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Store() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'merch' | 'tickets'>('merch');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (product: Product) => {
    if (!product.stock || product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= (product.stock || 0)) return prev;
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        if (newQ > 0 && newQ <= (item.product.stock || 0)) {
          return { ...item, quantity: newQ };
        }
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const handleCheckout = async () => {
    if (!currentUser) {
      alert('يجب تسجيل الدخول لإتمام الطلب');
      return;
    }
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Read all products from DB to check stock and price
        const productRefs = cart.map(item => doc(db, 'products', item.product.id));
        const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        let calculatedTotal = 0;
        const orderItems = [];

        for (let i = 0; i < cart.length; i++) {
          const item = cart[i];
          const pDoc = productDocs[i];
          
          if (!pDoc.exists()) {
            throw new Error(`المنتج غير موجود: ${item.product.name}`);
          }
          
          const dbProduct = pDoc.data() as Product;
          
          if (!dbProduct.active) {
            throw new Error(`المنتج غير متاح حالياً: ${dbProduct.name}`);
          }
          
          if ((dbProduct.stock || 0) < item.quantity) {
            throw new Error(`الكمية المطلوبة غير متوفرة لـ: ${dbProduct.name}`);
          }
          
          calculatedTotal += dbProduct.price * item.quantity;
          
          orderItems.push({
            productId: item.product.id,
            name: dbProduct.name,
            quantity: item.quantity,
            price: dbProduct.price
          });

          // Update stock
          transaction.update(pDoc.ref, {
            stock: (dbProduct.stock || 0) - item.quantity
          });
        }

        // Create order
        const newOrderRef = doc(collection(db, 'orders'));
        transaction.set(newOrderRef, {
          userId: currentUser.uid,
          items: orderItems,
          total: calculatedTotal,
          status: 'pending',
          createdAt: Date.now()
        });
      });

      setCart([]);
      setIsCartOpen(false);
      alert('تم تقديم طلبك بنجاح!');
    } catch (error: any) {
      console.error("Checkout error:", error);
      alert(error.message || 'حدث خطأ أثناء إتمام الطلب');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full relative" dir="rtl">
      {/* Header Tabs */}
      <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800 shadow-sm relative z-10">
        <button
          onClick={() => setActiveTab('merch')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'merch' ? 'bg-zinc-800 text-yellow-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ShoppingCart size={16} />
          المتجر
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'tickets' ? 'bg-zinc-800 text-yellow-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <QrCode size={16} />
          التذاكر الرقمية
        </button>
      </div>

      {activeTab === 'merch' ? (
        <div className="space-y-4 pb-20 relative z-10">
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <div key={product.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col group hover:border-yellow-500/50 transition-all">
                <div className="aspect-square bg-zinc-800 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                  {product.imageUrl && product.imageUrl.startsWith('http') ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  ) : (
                    <ImageIcon size={40} className="text-zinc-600" />
                  )}
                  {product.category === 'kit' && (
                    <span className="absolute top-2 right-2 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
                      رسمي
                    </span>
                  )}
                  {(!product.stock || product.stock <= 0) && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-white font-bold text-xs bg-red-500 px-2 py-1 rounded">نفذت الكمية</span>
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-sm text-white mb-1 line-clamp-1">{product.name}</h4>
                <div className="flex justify-between items-end mt-auto pt-2">
                  <span className="text-yellow-500 font-bold text-sm">{product.price} د.ج</span>
                  <button 
                    onClick={() => addToCart(product)} 
                    disabled={!product.stock || product.stock <= 0}
                    className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-yellow-500 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={14} />
                  </button>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="col-span-2 py-10 text-center text-zinc-500 font-bold text-sm">
                لا توجد منتجات متاحة حالياً.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 relative z-10">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-yellow-500 shrink-0">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">بطاقة العبور الرقمية</h3>
              <p className="text-xs text-zinc-400">استخدم التطبيق لدخول الملعب مباشرة لتفادي الطوابير والسوق السوداء.</p>
            </div>
          </div>
          <div className="bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-2xl p-6 text-center mt-6">
            <Tag size={40} className="text-zinc-600 mx-auto mb-4" />
            <h4 className="font-bold text-white mb-2">لا توجد تذاكر متاحة حالياً</h4>
            <p className="text-sm text-zinc-400 mb-6">سيتم فتح عملية البيع للمباراة القادمة قبل 48 ساعة من موعد الانطلاق.</p>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {activeTab === 'merch' && cartCount > 0 && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-64 bg-yellow-500 text-black p-4 rounded-2xl shadow-xl font-bold flex justify-between items-center z-40 transition-transform active:scale-95"
        >
          <div className="flex items-center gap-2">
            <div className="bg-black text-yellow-500 w-6 h-6 rounded-full flex items-center justify-center text-xs">
              {cartCount}
            </div>
            <span>عربة التسوق</span>
          </div>
          <span>{cartTotal} دج</span>
        </button>
      )}

      {/* Cart Overlay */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
          <div className="bg-zinc-950 w-full h-[80vh] rounded-t-3xl border-t border-zinc-800 flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <h3 className="font-bold text-white text-lg">عربة التسوق</h3>
              <button onClick={() => setIsCartOpen(false)} className="p-2 bg-zinc-900 text-zinc-400 rounded-full hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="flex gap-4 bg-zinc-900 p-3 rounded-xl border border-zinc-800 items-center">
                  <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                    {item.product.imageUrl && item.product.imageUrl.startsWith('http') ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-sm mb-1">{item.product.name}</h4>
                    <p className="text-yellow-500 font-bold text-sm">{item.product.price} دج</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button 
                      onClick={() => updateQuantity(item.product.id, 1)}
                      disabled={item.quantity >= (item.product.stock || 0)}
                      className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="text-white font-bold text-xs">{item.quantity}</span>
                    <button 
                      onClick={() => item.quantity > 1 ? updateQuantity(item.product.id, -1) : removeFromCart(item.product.id)}
                      className="p-1 text-zinc-400 hover:text-white"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-zinc-500 py-10 font-bold">
                  عربة التسوق فارغة
                </div>
              )}
            </div>

            <div className="p-4 bg-zinc-900 border-t border-zinc-800">
              <div className="flex justify-between items-center mb-4 text-white font-bold">
                <span>المجموع:</span>
                <span className="text-yellow-500 text-xl">{cartTotal} دج</span>
              </div>
              <button 
                onClick={handleCheckout}
                disabled={cart.length === 0 || isCheckingOut}
                className="w-full bg-yellow-500 text-black font-bold p-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCheckingOut ? 'جاري إتمام الطلب...' : 'إتمام الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

with open("src/components/Store.tsx", "w") as f:
    f.write(content)
