import React, { useState, useMemo, useEffect } from 'react';
import { Category, MenuItem, Table, Order, OrderItem, Staff, Shift } from '../types';
import { 
  Coffee, 
  Search, 
  ShoppingBag, 
  Trash2, 
  Receipt, 
  Printer, 
  Coins, 
  CreditCard, 
  Smartphone, 
  Plus, 
  Minus, 
  Utensils, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  Flame,
  FileSpreadsheet
} from 'lucide-react';
import { doc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface POSScreenProps {
  cafeId: string;
  categories: Category[];
  menuItems: MenuItem[];
  tables: Table[];
  orders: Order[];
  staff: Staff;
  currentShift: Shift | null;
  currency: string;
  onShowReceipt: (orderId: string) => void;
  onShowKOT: (orderId: string) => void;
}

export default function POSScreen({
  cafeId,
  categories,
  menuItems,
  tables,
  orders,
  staff,
  currentShift,
  currency,
  onShowReceipt,
  onShowKOT
}: POSScreenProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  
  // Local cart items for the currently selected table
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');

  // Sort tables by the numeric table_number field
  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => a.table_number - b.table_number);
  }, [tables]);

  // Set the first table as selected by default if none is chosen
  useEffect(() => {
    if (sortedTables.length > 0 && !selectedTableId) {
      setSelectedTableId(sortedTables[0].id);
    }
  }, [sortedTables, selectedTableId]);

  // Find the active open/kot_sent order for the selected table to load it back
  const activeTableOrder = useMemo(() => {
    if (!selectedTableId) return null;
    return orders.find(o => o.table_id === selectedTableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'served'));
  }, [orders, selectedTableId]);

  // Load the order line items if there is an active table order
  useEffect(() => {
    let active = true;
    const loadItems = async () => {
      if (activeTableOrder) {
        setDiscountPercent(activeTableOrder.discount_percent || 0);
        setCustomerName(activeTableOrder.customer_name || '');
        
        // Fetch subcollection /cafes/{cafeId}/orders/{orderId}/items
        const itemsRef = collection(db, 'cafes', cafeId, 'orders', activeTableOrder.id, 'items');
        try {
          const snap = await getDocs(itemsRef);
          if (active) {
            const items = snap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as OrderItem[];
            setCart(items);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, `cafes/${cafeId}/orders/${activeTableOrder.id}/items`);
        }
      } else {
        // Reset cart for a completely free table
        setCart([]);
        setDiscountPercent(0);
        setCustomerName('');
        setOrderNotes('');
      }
    };

    loadItems();
    return () => {
      active = false;
    };
  }, [activeTableOrder, selectedTableId, cafeId]);

  // Handle veg/non-veg visual dot component
  const renderVegBadge = (veg_type: 'veg' | 'egg' | 'nonveg') => {
    let color = '';
    if (veg_type === 'veg') color = 'border-emerald-600 text-emerald-600';
    else if (veg_type === 'egg') color = 'border-amber-500 text-amber-500';
    else color = 'border-red-500 text-red-500';

    return (
      <div className={`w-4 h-4 border-2 flex items-center justify-center p-0.5 rounded ${color}`} title={veg_type}>
        <div className={`w-2 h-2 rounded-full ${veg_type === 'veg' ? 'bg-emerald-600' : veg_type === 'egg' ? 'bg-amber-500' : 'bg-red-500'}`} />
      </div>
    );
  };

  // Filter menu items by selected category and search input
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const catMatch = selectedCategoryId === 'all' || item.category_id === selectedCategoryId;
      const searchMatch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return catMatch && searchMatch && item.is_available;
    });
  }, [menuItems, selectedCategoryId, searchQuery]);

  // Math totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [cart]);

  const gstCollected = useMemo(() => {
    return cart.reduce((sum, item) => {
      const base = item.quantity * item.unit_price;
      const tax = base * (item.gst_rate / 100);
      return sum + tax;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal + gstCollected) * (discountPercent / 100);
  }, [subtotal, gstCollected, discountPercent]);

  const grossTotal = useMemo(() => {
    const raw = (subtotal + gstCollected) - discountAmount;
    return Math.round(raw); // standard round-off enforced
  }, [subtotal, gstCollected, discountAmount]);

  const roundOff = useMemo(() => {
    const raw = (subtotal + gstCollected) - discountAmount;
    return grossTotal - raw;
  }, [subtotal, gstCollected, discountAmount, grossTotal]);

  // Quick Action: Add item to table order cart
  const addToCart = (item: MenuItem) => {
    const existingIndex = cart.findIndex(c => c.menu_item_id === item.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      const lineItem: OrderItem = {
        id: `line_${Date.now()}_${Math.floor(Math.random() * 100)}`,
        menu_item_id: item.id,
        menu_item_name: item.name, // PITFALL #4: Denormalize name!
        quantity: 1,
        unit_price: item.price, // PITFALL #3: Snapshot price!
        gst_rate: item.gst_rate, // PITFALL #3: Snapshot rate!
        veg_type: item.veg_type,
        note: ''
      };
      setCart([...cart, lineItem]);
    }
  };

  const updateQuantity = (lineItemId: string, delta: number) => {
    const updated = cart.map(item => {
      if (item.id === lineItemId) {
        const nextQty = item.quantity + delta;
        return nextQty > 0 ? { ...item, quantity: nextQty } : null;
      }
      return item;
    }).filter(Boolean) as OrderItem[];
    setCart(updated);
  };

  const updateLineItemNote = (lineItemId: string, note: string) => {
    setCart(cart.map(item => item.id === lineItemId ? { ...item, note } : item));
  };

  const removeItem = (lineItemId: string) => {
    setCart(cart.filter(item => item.id !== lineItemId));
  };

  // Dispatch Action: SAVE DRAFT or SEND KOT
  const handleSaveOrder = async (status: 'open' | 'kot_sent') => {
    if (!selectedTableId) return;
    if (cart.length === 0) return;

    try {
      const targetTable = tables.find(t => t.id === selectedTableId);
      const isNew = !activeTableOrder;
      const orderId = isNew ? `ord_${Date.now()}` : activeTableOrder!.id;

      const orderData: Order = {
        id: orderId,
        table_id: selectedTableId,
        table_label: targetTable?.label || 'Table',
        shift_id: currentShift?.id || 'no-active-shift',
        staff_id: staff.authUid,
        staff_name: staff.name,
        source: 'staff',
        customer_name: customerName,
        status: status,
        subtotal: subtotal,
        discount_percent: discountPercent,
        round_off: roundOff,
        total: grossTotal,
        created_at: isNew ? new Date().toISOString() : activeTableOrder!.created_at
      };

      // 1. Create/Update Order Doc
      const orderDocRef = doc(db, 'cafes', cafeId, 'orders', orderId);
      await setDoc(orderDocRef, orderData);

      // 2. Set table status to occupied
      const tableRef = doc(db, 'cafes', cafeId, 'tables', selectedTableId);
      await updateDoc(tableRef, { status: 'occupied' });

      // 3. Save line items to /cafes/{cafeId}/orders/{orderId}/items subcollection
      // Delete old ones first if updating
      if (!isNew) {
        const oldItemsRef = collection(db, 'cafes', cafeId, 'orders', orderId, 'items');
        const oldSnap = await getDocs(oldItemsRef);
        for (const d of oldSnap.docs) {
          await deleteDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', d.id));
        }
      }

      for (const cartItem of cart) {
        await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', cartItem.id), cartItem);
      }

      if (status === 'kot_sent') {
        onShowKOT(orderId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dispatch Action: SETTLE & CLOSE (BILL & PAY)
  const handleSettlePay = async (mode: 'cash' | 'upi' | 'card') => {
    if (!activeTableOrder && cart.length === 0) return;
    
    try {
      // If order doesn't exist, save it as open first
      let orderId = activeTableOrder?.id;
      if (!orderId) {
        orderId = `ord_${Date.now()}`;
        const targetTable = tables.find(t => t.id === selectedTableId);
        const orderData: Order = {
          id: orderId,
          table_id: selectedTableId,
          table_label: targetTable?.label || 'Table',
          shift_id: currentShift?.id || 'no-active-shift',
          staff_id: staff.authUid,
          staff_name: staff.name,
          source: 'staff',
          customer_name: customerName,
          status: 'open',
          subtotal: subtotal,
          discount_percent: discountPercent,
          round_off: roundOff,
          total: grossTotal,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId), orderData);
        for (const cartItem of cart) {
          await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', cartItem.id), cartItem);
        }
      }

      // Mark order as settled
      const orderRef = doc(db, 'cafes', cafeId, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'settled',
        payment_mode: mode,
        settled_at: new Date().toISOString()
      });

      // Liberate table status
      const tableRef = doc(db, 'cafes', cafeId, 'tables', selectedTableId);
      await updateDoc(tableRef, { status: 'free' });

      // Trigger modal invoice representation
      onShowReceipt(orderId);

      // Reset states
      setCart([]);
      setDiscountPercent(0);
      setCustomerName('');
      setOrderNotes('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="pos-screen" className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-8rem)]">
      
      {/* COLUMN 1: Category Sidebar (2/12 columns) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto animate-fade-in">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`flex-1 lg:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 whitespace-nowrap border ${
            selectedCategoryId === 'all' 
              ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
              : 'hover:bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-600'
          }`}
        >
          <Coffee className="w-4 h-4 shrink-0 text-amber-500" />
          All Menu Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`flex-1 lg:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 whitespace-nowrap border ${
              selectedCategoryId === cat.id 
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                : 'hover:bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-600'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {cat.name}
          </button>
        ))}
      </div>

      {/* COLUMN 2: Tables + Menu Catalog (6/12 columns) */}
      <div className="lg:col-span-6 flex flex-col gap-4 h-full overflow-hidden">
        
        {/* Table Selector bar (numeric sorting) */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Table:</span>
          {sortedTables.map(t => {
            const hasOrder = orders.some(o => o.table_id === t.id && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'served'));
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border-2 ${
                  selectedTableId === t.id
                    ? 'bg-amber-50 border-amber-500 text-slate-900 shadow-sm'
                    : hasOrder 
                      ? 'bg-amber-50/40 border-amber-200 text-amber-800' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {t.label}
                {hasOrder && <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
              </button>
            );
          })}
        </div>

        {/* Menu Search and Filter */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search recipes, ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-950 shadow-sm"
          />
        </div>

        {/* Dynamic menu items grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-500/50 shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between h-40 group relative"
            >
              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2">
                  {renderVegBadge(item.veg_type)}
                  <p className="text-amber-700 font-bold font-mono text-sm">{currency}{item.price}</p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 leading-tight group-hover:text-amber-800 transition-colors line-clamp-1">{item.name}</h5>
                  {item.notes && (
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-snug">{item.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 font-mono">GST {item.gst_rate}%</span>
                <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity animate-fade-in">
                  + Add Item
                </span>
              </div>
            </div>
          ))}

          {filteredMenuItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
              No menu items found. Go to "Menu Management" to populate categories.
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 3: Active Cart/Check panel (4/12 columns) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full overflow-hidden">
        
        {/* Cart Header details */}
        <div className="border-b border-slate-200 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 tracking-wide uppercase text-sm">Current Bill</h2>
            <p className="text-xs text-slate-500 mt-1">
              Table: <span className="text-slate-900 font-bold">{tables.find(t => t.id === selectedTableId)?.label || 'None'}</span>
            </p>
          </div>
          {activeTableOrder ? (
            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
              #{activeTableOrder.id.replace('ord_', '')}
            </span>
          ) : (
            <span className="text-xs font-mono bg-slate-50 text-slate-400 px-2 py-1 rounded">
              DRAFT
            </span>
          )}
        </div>

        {/* Customer name / meta info inputs */}
        <div className="grid grid-cols-2 gap-3 my-3 shrink-0">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Customer Name</label>
            <input
              type="text"
              placeholder="e.g. John"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Discount %</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0%"
              value={discountPercent || ''}
              onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-955 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Scrollable list of selected order items */}
        <div className="flex-1 overflow-y-auto my-2 pr-1 space-y-3">
          {cart.map((cartItem) => (
            <div key={cartItem.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-2">
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-2">
                  {cartItem.veg_type && renderVegBadge(cartItem.veg_type)}
                  <span className="text-xs font-bold text-slate-900">{cartItem.menu_item_name}</span>
                </div>
                <button
                  onClick={() => removeItem(cartItem.id)}
                  className="text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">
                  {currency}{cartItem.unit_price} x {cartItem.quantity}
                </span>
                
                {/* Adjust Quantities */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => updateQuantity(cartItem.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-slate-900 w-4 text-center font-mono">{cartItem.quantity}</span>
                  <button
                    onClick={() => updateQuantity(cartItem.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cooking notes instruction */}
              <input
                type="text"
                placeholder="Special instruction (e.g. extra spicy)"
                value={cartItem.note || ''}
                onChange={(e) => updateLineItemNote(cartItem.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          ))}

          {cart.length === 0 && (
            <div className="text-center py-16 flex flex-col items-center justify-center text-slate-400">
              <Utensils className="w-12 h-12 text-slate-300 stroke-1 mb-3" />
              <p className="text-xs font-semibold">Order sheet is currently empty.</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[180px]">Select a table and click items on the left menu grid to begin.</p>
            </div>
          )}
        </div>

        {/* Checkout Summary panel */}
        <div className="border-t border-slate-200 pt-4 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-2xl">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wider">
              <span>Subtotal</span>
              <span className="font-mono">{currency}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wider">
              <span>GST ({gstCollected ? 'Estimated' : '0%'})</span>
              <span className="font-mono">{currency}{gstCollected.toFixed(2)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-xs text-red-600 uppercase tracking-wider font-semibold">
                <span>Discount ({discountPercent}%)</span>
                <span className="font-mono">-{currency}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wider">
              <span>Round-Off</span>
              <span className="font-mono">
                {roundOff >= 0 ? '+' : ''}{currency}{roundOff.toFixed(2)}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="font-bold text-slate-900 uppercase tracking-wide">Total</span>
              <span className="font-bold text-amber-700 text-lg font-mono">{currency}{grossTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons (Draft vs KOT) */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => handleSaveOrder('open')}
              disabled={cart.length === 0}
              className="py-3 rounded-xl border border-slate-300 font-bold text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              SAVE CART
            </button>
            <button
              onClick={() => handleSaveOrder('kot_sent')}
              disabled={cart.length === 0}
              className="py-3 rounded-xl bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-900/10 hover:bg-amber-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              KOT
            </button>
          </div>

          {/* Settle Drawer Pay section */}
          <div className="border-t border-slate-200/80 pt-3 mt-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-2">Settle & Pay Drawer</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSettlePay('cash')}
                disabled={cart.length === 0}
                className="py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                Cash
              </button>
              <button
                onClick={() => handleSettlePay('upi')}
                disabled={cart.length === 0}
                className="py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                UPI
              </button>
              <button
                onClick={() => handleSettlePay('card')}
                disabled={cart.length === 0}
                className="py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                Card
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
