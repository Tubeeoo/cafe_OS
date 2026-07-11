import React, { useState, useMemo, useEffect } from 'react';
import { Category, MenuItem, Table, Order, OrderItem, VegType } from '../types';
import { doc, setDoc, getDocs, collection, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Coffee, ShoppingBag, Plus, Minus, CheckCircle, Flame, User, ArrowRight, Loader2, UtensilsCrossed } from 'lucide-react';

interface QRMenuScreenProps {
  cafeId: string;
  tableId: string;
  categories: Category[];
  menuItems: MenuItem[];
}

export default function QRMenuScreen({ cafeId, tableId, categories, menuItems }: QRMenuScreenProps) {
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [customerName, setCustomerName] = useState('');
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  
  const [tableInfo, setTableInfo] = useState<Table | null>(null);
  const [cafeInfo, setCafeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  // Load Table and Cafe details
  useEffect(() => {
    const loadDetails = async () => {
      try {
        const tableSnap = await getDoc(doc(db, 'cafes', cafeId, 'tables', tableId));
        if (tableSnap.exists()) {
          setTableInfo(tableSnap.data() as Table);
        }
        const cafeSnap = await getDoc(doc(db, 'cafes', cafeId));
        if (cafeSnap.exists()) {
          setCafeInfo(cafeSnap.data());
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadDetails();
  }, [cafeId, tableId]);

  // FSSAI badge
  const renderVegBadge = (veg_type: 'veg' | 'egg' | 'nonveg') => {
    let color = '';
    if (veg_type === 'veg') color = 'border-emerald-600 text-emerald-600';
    else if (veg_type === 'egg') color = 'border-amber-500 text-amber-500';
    else color = 'border-red-500 text-red-500';

    return (
      <div className={`w-3.5 h-3.5 border-2 flex items-center justify-center p-0.5 rounded ${color}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${veg_type === 'veg' ? 'bg-emerald-600' : veg_type === 'egg' ? 'bg-amber-500' : 'bg-red-500'}`} />
      </div>
    );
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchCat = selectedCatId === 'all' || item.category_id === selectedCatId;
      return matchCat && item.is_available;
    });
  }, [menuItems, selectedCatId]);

  // Add/Sub quantities
  const adjustQty = (itemId: string, delta: number) => {
    const current = cart[itemId] || 0;
    const next = current + delta;
    if (next <= 0) {
      const updated = { ...cart };
      delete updated[itemId];
      setCart(updated);
    } else {
      setCart({ ...cart, [itemId]: next });
    }
  };

  const cartTotalCount = useMemo(() => {
    return (Object.values(cart) as number[]).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  const cartTotalPrice = useMemo(() => {
    return (Object.entries(cart) as [string, number][]).reduce((sum, [itemId, qty]) => {
      const item = menuItems.find(m => m.id === itemId);
      return sum + (qty * (item?.price || 0));
    }, 0);
  }, [cart, menuItems]);

  // Handle Order Submit
  const handleSubmitQR = async () => {
    if (!customerName.trim()) return;
    if (Object.keys(cart).length === 0) return;

    setLoading(true);
    try {
      // 1. Fetch if there is an active running order for this table
      const ordersRef = collection(db, 'cafes', cafeId, 'orders');
      const snap = await getDocs(ordersRef);
      const openOrder = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Order)
        .find(o => o.table_id === tableId && (o.status === 'open' || o.status === 'kot_sent'));

      const isNew = !openOrder;
      let orderId = '';
      if (isNew) {
        if (cafeId === 'demo-cafe') {
          const existingOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Order);
          const allowedIds = Array.from({ length: 30 }, (_, i) => `ord_qr_${i + 1}`);
          const existingIds = existingOrders.map(o => o.id);
          const unusedId = allowedIds.find(id => !existingIds.includes(id));
          if (unusedId) {
            orderId = unusedId;
          } else {
            const demoQrOrders = existingOrders.filter(o => o.id.startsWith('ord_qr_'));
            if (demoQrOrders.length > 0) {
              demoQrOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              orderId = demoQrOrders[0].id;
            } else {
              orderId = 'ord_qr_1';
            }
          }
        } else {
          orderId = `ord_qr_${Date.now()}`;
        }
      } else {
        orderId = openOrder.id;
      }

      // Prepare Line Items
      const lineItems: OrderItem[] = (Object.entries(cart) as [string, number][]).map(([itemId, qty]) => {
        const item = menuItems.find(m => m.id === itemId)!;
        return {
          id: `line_qr_${Date.now()}_${itemId}`,
          menu_item_id: item.id,
          menu_item_name: item.name,
          quantity: qty,
          unit_price: item.price,
          gst_rate: item.gst_rate,
          veg_type: item.veg_type,
          note: `QR Order - Patron: ${customerName}`
        };
      });

      // Calculate totals
      const subtotal = lineItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
      const gst = lineItems.reduce((sum, i) => sum + (i.quantity * i.unit_price * (i.gst_rate / 100)), 0);
      const total = Math.round(subtotal + gst);

      if (isNew) {
        // Create brand new open order
        const newOrder: Order = {
          id: orderId,
          table_id: tableId,
          table_label: tableInfo?.label || 'Table',
          shift_id: 'qr-shift',
          staff_id: 'customer',
          staff_name: 'Table Customer',
          source: 'qr',
          customer_name: customerName,
          status: 'open',
          subtotal: subtotal,
          discount_percent: 0,
          round_off: total - (subtotal + gst),
          total: total,
          created_at: new Date().toISOString()
        };

        await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId), newOrder);

        // Update table to occupied
        await updateDoc(doc(db, 'cafes', cafeId, 'tables', tableId), { status: 'occupied' });
      } else {
        // Merge into existing running order!
        const nextSubtotal = openOrder.subtotal + subtotal;
        const nextGst = openOrder.total - openOrder.subtotal + gst; // approximate gst merge
        const nextTotal = Math.round(nextSubtotal + nextGst);

        await updateDoc(doc(db, 'cafes', cafeId, 'orders', orderId), {
          subtotal: nextSubtotal,
          round_off: nextTotal - (nextSubtotal + nextGst),
          status: 'open' // trigger staff alert by reverting status to 'open' if it was KOT_SENT
        });
      }

      // Add line items to subcollection
      for (const line of lineItems) {
        await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', line.id), line);
      }

      setOrderComplete(true);
      setCart({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-md border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Order Dispatched to Kitchen!</h2>
          <p className="text-xs text-slate-500">
            Thank you, <strong className="text-slate-800">{customerName}</strong>! Your order for <strong className="text-slate-800">{tableInfo?.label}</strong> has been successfully received by our barista.
          </p>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-[11px] text-slate-600 font-mono">
            Payment Mode: <strong>Pay at Checkout Drawer</strong>
          </div>
          <button
            onClick={() => setOrderComplete(false)}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
          >
            Order Something Else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Upper branding */}
      <div className="bg-slate-900 text-white p-5 sticky top-0 z-40 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-amber-500" />
            <div>
              <h1 className="text-sm font-bold truncate max-w-[150px]">{cafeInfo?.name || 'Cafe Companion'}</h1>
              <span className="text-[10px] text-slate-400 block font-semibold">{tableInfo?.label || 'Loading...'}</span>
            </div>
          </div>
          <UtensilsCrossed className="w-4 h-4 text-amber-500 animate-bounce" />
        </div>
      </div>

      {/* Main body content */}
      <div className="flex-1 max-w-md mx-auto w-full p-4 space-y-4">
        
        {!isNameSubmitted ? (
          /* NAME ENTRY SHEET */
          <div className="bg-white p-5 rounded-2xl shadow border border-slate-200 space-y-4">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Welcome Dining Guest</span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">Enter Your Name to View Menu</h3>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Your Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              onClick={() => customerName.trim() && setIsNameSubmitted(true)}
              disabled={!customerName.trim()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow"
            >
              Enter Public Menu Card
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* PUBLIC MENU GRID */
          <div className="space-y-4 pb-24">
            {/* Horizontal Categories slider */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
              <button
                onClick={() => setSelectedCatId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                  selectedCatId === 'all' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                All Items
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                    selectedCatId === cat.id ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Recipes lists */}
            <div className="space-y-3">
              {filteredItems.map(item => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {renderVegBadge(item.veg_type)}
                        <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                      </div>
                      {item.notes && <p className="text-[10px] text-slate-400 line-clamp-1 leading-normal">{item.notes}</p>}
                      <span className="text-xs font-bold font-mono text-amber-700">{cafeInfo?.currency || '₹'}{item.price}</span>
                    </div>

                    {/* Quantity selectors */}
                    <div className="shrink-0">
                      {qty > 0 ? (
                        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-1">
                          <button
                            onClick={() => adjustQty(item.id, -1)}
                            className="w-6 h-6 bg-white rounded border border-slate-200 flex items-center justify-center text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <Minus className="w-3.5 h-3.5 text-amber-700" />
                          </button>
                          <span className="text-xs font-bold font-mono text-amber-900 w-4 text-center">{qty}</span>
                          <button
                            onClick={() => adjustQty(item.id, 1)}
                            className="w-6 h-6 bg-white rounded border border-slate-200 flex items-center justify-center text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <Plus className="w-3.5 h-3.5 text-amber-700" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => adjustQty(item.id, 1)}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-sm"
                        >
                          + Add Item
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
                  No active menu items found in this category.
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Floating Checkout Drawer */}
      {isNameSubmitted && cartTotalCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4 shadow-lg z-50">
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{cartTotalCount} item(s) selected</span>
              <span className="text-sm font-extrabold font-mono text-slate-900">
                Total: {cafeInfo?.currency || '₹'}{cartTotalPrice.toLocaleString()}
              </span>
            </div>
            
            <button
              onClick={handleSubmitQR}
              disabled={loading}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
                  Dispatch QR Order
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
