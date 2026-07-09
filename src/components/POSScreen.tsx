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
  FileSpreadsheet,
  Edit
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
  editingOrderId: string | null;
  onClearEditingOrder: () => void;
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
  onShowKOT,
  editingOrderId,
  onClearEditingOrder
}: POSScreenProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout'>('dine_in');
  
  // Local cart items for the currently selected table
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [discountRupees, setDiscountRupees] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');

  // Find the active order (supporting both Dine-in tables, Takeout, or explicit Editing)
  const activeOrder = useMemo(() => {
    if (editingOrderId) {
      return orders.find(o => o.id === editingOrderId) || null;
    }
    if (orderType === 'takeout') {
      return null; // Takeout orders are loaded explicitly via editing from Orders list or start empty
    }
    if (!selectedTableId) return null;
    return orders.find(o => o.table_id === selectedTableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'served' || o.status === 'held'));
  }, [orders, selectedTableId, editingOrderId, orderType]);

  const isReadOnly = useMemo(() => {
    return activeOrder?.status === 'settled' || activeOrder?.status === 'void';
  }, [activeOrder]);

  // State for Add Custom Item modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customVeg, setCustomVeg] = useState<'veg' | 'egg' | 'nonveg'>('veg');

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const price = parseFloat(customPrice) || 0;
    
    const customLineItem: OrderItem = {
      id: `custom_${Date.now()}_${Math.floor(Math.random() * 100)}`,
      menu_item_id: `custom_item_${Date.now()}`,
      menu_item_name: `${customName.trim()} (Special)`,
      quantity: 1,
      unit_price: price,
      gst_rate: 5, // default 5% GST
      veg_type: customVeg,
      note: ''
    };
    
    setCart([...cart, customLineItem]);
    setCustomName('');
    setCustomPrice('');
    setCustomVeg('veg');
    setShowCustomModal(false);
  };

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

  // Load the order line items if there is an active order
  useEffect(() => {
    let active = true;
    const loadItems = async () => {
      if (activeOrder) {
        setCustomerName(activeOrder.customer_name || '');
        setOrderType(activeOrder.order_type || 'dine_in');
        if (activeOrder.payment_mode) {
          setPaymentMode(activeOrder.payment_mode as 'cash' | 'upi' | 'card');
        } else {
          setPaymentMode('cash');
        }
        if (activeOrder.order_type === 'dine_in' && activeOrder.table_id && activeOrder.table_id !== 'takeout') {
          setSelectedTableId(activeOrder.table_id);
        }
        
        // Fetch subcollection /cafes/{cafeId}/orders/{orderId}/items
        const itemsRef = collection(db, 'cafes', cafeId, 'orders', activeOrder.id, 'items');
        try {
          const snap = await getDocs(itemsRef);
          if (active) {
            const items = snap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as OrderItem[];
            setCart(items);

            // Calculate loaded subtotal & GST to compute rupee discount
            const sub = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const gst = items.reduce((sum, item) => {
              const base = item.quantity * item.unit_price;
              return sum + (base * (item.gst_rate / 100));
            }, 0);
            const discPercent = activeOrder.discount_percent || 0;
            const discRupees = Math.round((sub + gst) * (discPercent / 100));
            setDiscountRupees(discRupees);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, `cafes/${cafeId}/orders/${activeOrder.id}/items`);
        }
      } else {
        // Reset cart for a completely free state
        setCart([]);
        setDiscountRupees(0);
        setCustomerName('');
        setOrderNotes('');
        setPaymentMode('cash');
      }
    };

    loadItems();
    return () => {
      active = false;
    };
  }, [activeOrder, selectedTableId, cafeId]);

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

  const discountAmount = discountRupees;

  const calculatedDiscountPercent = useMemo(() => {
    const totalBeforeDiscount = subtotal + gstCollected;
    return totalBeforeDiscount > 0 ? (discountRupees / totalBeforeDiscount) * 100 : 0;
  }, [subtotal, gstCollected, discountRupees]);

  const discountPercent = calculatedDiscountPercent;

  const grossTotal = useMemo(() => {
    const raw = (subtotal + gstCollected) - discountAmount;
    return Math.max(0, Math.round(raw)); // standard round-off enforced
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

  // Dispatch Action: SAVE DRAFT or SEND KOT or HOLD
  const handleSaveOrder = async (status: 'open' | 'kot_sent' | 'held') => {
    if (orderType === 'dine_in' && !selectedTableId) return;
    if (cart.length === 0) return;

    try {
      const targetTable = orderType === 'dine_in' ? tables.find(t => t.id === selectedTableId) : null;
      const isNew = !activeOrder;
      const orderId = isNew ? `ord_${Date.now()}` : activeOrder!.id;
      const prevTotal = isNew ? 0 : activeOrder!.total;

      // Check if total is modified to write into edit history
      let history = activeOrder?.orderEditHistory || [];
      if (!isNew && prevTotal !== grossTotal) {
        history = [
          ...history,
          {
            timestamp: new Date().toISOString(),
            previous_total: prevTotal,
            new_total: grossTotal,
            edited_by: staff.name
          }
        ];
      }

      const orderData: Order = {
        id: orderId,
        table_id: orderType === 'dine_in' ? selectedTableId : 'takeout',
        table_label: orderType === 'dine_in' ? (targetTable?.label || 'Table') : 'Takeout',
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
        created_at: isNew ? new Date().toISOString() : activeOrder!.created_at,
        order_type: orderType,
        orderEditHistory: history
      };

      // 1. Create/Update Order Doc
      const orderDocRef = doc(db, 'cafes', cafeId, 'orders', orderId);
      await setDoc(orderDocRef, orderData);

      // 2. Set table status to occupied if dine-in
      if (orderType === 'dine_in' && selectedTableId) {
        const tableRef = doc(db, 'cafes', cafeId, 'tables', selectedTableId);
        await updateDoc(tableRef, { status: 'occupied' });
      }

      // 3. Save line items to /cafes/{cafeId}/orders/{orderId}/items subcollection
      // Delete old ones first if updating
      const oldItemsRef = collection(db, 'cafes', cafeId, 'orders', orderId, 'items');
      const oldSnap = await getDocs(oldItemsRef);
      for (const d of oldSnap.docs) {
        await deleteDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', d.id));
      }

      for (const cartItem of cart) {
        await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', cartItem.id), cartItem);
      }

      // Clear editing state from parent if we finished editing
      if (editingOrderId) {
        onClearEditingOrder();
      }

      if (status === 'kot_sent') {
        onShowKOT(orderId);
      }

      // Reset states for a fresh slate when holding/saving takeout or editing is complete
      if (editingOrderId || orderType === 'takeout') {
        setCart([]);
        setDiscountRupees(0);
        setCustomerName('');
        setOrderNotes('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dispatch Action: SETTLE & CLOSE (BILL & PAY)
  const handleSettlePay = async (mode: 'cash' | 'upi' | 'card') => {
    if (!activeOrder && cart.length === 0) return;
    
    try {
      // If order doesn't exist, save it as open first
      let orderId = activeOrder?.id;
      const isNew = !activeOrder;
      const prevTotal = isNew ? 0 : activeOrder!.total;

      let history = activeOrder?.orderEditHistory || [];
      if (!isNew && prevTotal !== grossTotal) {
        history = [
          ...history,
          {
            timestamp: new Date().toISOString(),
            previous_total: prevTotal,
            new_total: grossTotal,
            edited_by: staff.name
          }
        ];
      }

      if (!orderId) {
        orderId = `ord_${Date.now()}`;
        const targetTable = orderType === 'dine_in' ? tables.find(t => t.id === selectedTableId) : null;
        const orderData: Order = {
          id: orderId,
          table_id: orderType === 'dine_in' ? selectedTableId : 'takeout',
          table_label: orderType === 'dine_in' ? (targetTable?.label || 'Table') : 'Takeout',
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
          created_at: new Date().toISOString(),
          order_type: orderType,
          orderEditHistory: history
        };
        await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId), orderData);
        for (const cartItem of cart) {
          await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', cartItem.id), cartItem);
        }
      } else {
        // Update items first
        const oldItemsRef = collection(db, 'cafes', cafeId, 'orders', orderId, 'items');
        const oldSnap = await getDocs(oldItemsRef);
        for (const d of oldSnap.docs) {
          await deleteDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', d.id));
        }

        for (const cartItem of cart) {
          await setDoc(doc(db, 'cafes', cafeId, 'orders', orderId, 'items', cartItem.id), cartItem);
        }
      }

      // Mark order as settled
      const orderRef = doc(db, 'cafes', cafeId, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'settled',
        payment_mode: mode,
        settled_at: new Date().toISOString(),
        subtotal: subtotal,
        discount_percent: discountPercent,
        round_off: roundOff,
        total: grossTotal,
        order_type: orderType,
        orderEditHistory: history
      });

      // Liberate table status if dine-in
      if (orderType === 'dine_in' && selectedTableId) {
        const tableRef = doc(db, 'cafes', cafeId, 'tables', selectedTableId);
        await updateDoc(tableRef, { status: 'free' });
      }

      // Trigger modal invoice representation
      onShowReceipt(orderId);

      // Clear parent editing state
      if (editingOrderId) {
        onClearEditingOrder();
      }

      // Reset states
      setCart([]);
      setDiscountRupees(0);
      setCustomerName('');
      setOrderNotes('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="pos-screen" className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-8rem)]">
      {editingOrderId && (
        <div className="col-span-full bg-amber-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Edit className="w-4.5 h-4.5" />
            <span className="text-xs font-bold uppercase tracking-wider">Editing Order #{editingOrderId.replace('ord_', '')}</span>
          </div>
          <button
            onClick={onClearEditingOrder}
            className="text-xs underline hover:text-amber-100 font-bold"
          >
            Cancel Edit & Start New
          </button>
        </div>
      )}
      
      {/* COLUMN 1: Category Sidebar (2/12 columns) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto animate-fade-in shrink-0">
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

      {/* COLUMN 2: Tables + Menu Catalog (5/12 columns) */}
      <div className="lg:col-span-5 flex flex-col gap-4 h-full overflow-hidden">
        
        {/* Dine-in vs Takeout Selector */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-2xl shrink-0 border border-slate-200">
          <button
            onClick={() => setOrderType('dine_in')}
            className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              orderType === 'dine_in'
                ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🍽️ Dine-in
          </button>
          <button
            onClick={() => setOrderType('takeout')}
            className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              orderType === 'takeout'
                ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛍️ Takeout
          </button>
        </div>

        {/* Conditionally render table selector bar or takeout notice */}
        {orderType === 'dine_in' ? (
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 overflow-x-auto shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Table:</span>
            {sortedTables.map(t => {
              const hasOrder = orders.some(o => o.table_id === t.id && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'served' || o.status === 'held'));
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
        ) : (
          <div className="bg-amber-50/55 p-3 rounded-2xl border border-amber-200/50 flex items-center gap-2 shrink-0">
            <ShoppingBag className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">Takeout Mode (No Table Assignment Required)</span>
          </div>
        )}

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
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 lg:grid-cols-2 gap-3">
          {filteredMenuItems.map((item) => {
            const cartQty = cart.find(c => c.menu_item_id === item.id)?.quantity || 0;
            return (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-500/50 shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between h-40 group relative"
              >
                {cartQty > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-black font-mono shadow-md border-2 border-white animate-scale-up z-10">
                    {cartQty}
                  </div>
                )}
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
            );
          })}

          {filteredMenuItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
              No menu items found. Go to "Menu Management" to populate categories.
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 3: Active Cart/Check panel (5/12 columns - widened) */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-full overflow-hidden relative">
        
        {/* Cart Header details */}
        <div className="border-b border-slate-200 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-950 tracking-wider uppercase text-sm flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-800" /> Current order
            </h2>
            <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
              {activeOrder ? (
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 font-mono">
                  #{activeOrder.id.replace('ord_', '')} ({activeOrder.status.toUpperCase()})
                </span>
              ) : (
                <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50 font-mono">
                  NEW DRAFT
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Side-by-side Fields: Customer Name & Table # */}
        <div className="grid grid-cols-2 gap-3 mt-4 mb-2.5 shrink-0">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Customer Name</label>
            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-950 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Table #</label>
            {orderType === 'dine_in' ? (
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-955 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all disabled:opacity-60"
              >
                <option value="">Select Table</option>
                {sortedTables.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value="Takeout"
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-extrabold"
              />
            )}
          </div>
        </div>

        {/* Add custom item button */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="w-full py-2 bg-amber-50 hover:bg-amber-100/70 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 mb-3"
          >
            <Plus className="w-4 h-4 text-amber-700" />
            Add custom item
          </button>
        )}

        {/* Scrollable list of selected order items / Empty state */}
        <div className="flex-1 overflow-y-auto my-2 pr-1 space-y-3 flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <p className="text-xs font-bold text-slate-400 tracking-wide">Tap an item to start the order</p>
            </div>
          ) : (
            cart.map((cartItem) => (
              <div key={cartItem.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex flex-col gap-2.5 animate-fade-in shrink-0">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    {cartItem.veg_type && renderVegBadge(cartItem.veg_type)}
                    <span className="text-sm font-extrabold text-slate-950">{cartItem.menu_item_name}</span>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={() => removeItem(cartItem.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-600">
                    {currency}{cartItem.unit_price} x {cartItem.quantity}
                  </span>
                  
                  {/* Adjust Quantities */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(cartItem.id, -1)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-600 hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-black text-slate-900 w-5 text-center font-mono">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(cartItem.id, 1)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-600 hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Cooking notes instruction */}
                <input
                  type="text"
                  placeholder="Special instruction (e.g. extra spicy)"
                  value={cartItem.note || ''}
                  disabled={isReadOnly}
                  onChange={(e) => updateLineItemNote(cartItem.id, e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                />
              </div>
            ))
          )}
        </div>

        {/* Checkout Summary panel */}
        <div className="border-t border-slate-200 pt-4 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl shrink-0">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Subtotal</span>
              <span className="font-mono">{currency}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>GST ({gstCollected ? 'Estimated' : '0%'})</span>
              <span className="font-mono">{currency}{gstCollected.toFixed(2)}</span>
            </div>
            
            {/* Editable Discount in ₹ */}
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Discount (₹)</span>
              {isReadOnly ? (
                <span className="font-mono text-red-600 font-extrabold">-{currency}{discountAmount.toFixed(2)}</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={subtotal + gstCollected}
                    placeholder="0"
                    value={discountRupees || ''}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setDiscountRupees(Math.min(subtotal + gstCollected, val));
                    }}
                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-right text-xs font-mono font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Round-Off</span>
              <span className="font-mono">
                {roundOff >= 0 ? '+' : ''}{currency}{roundOff.toFixed(2)}
              </span>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-slate-200 flex justify-between items-center">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider text-sm">Total</span>
              <span className="font-black text-amber-800 text-2xl font-mono">{currency}{grossTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Mode Row: equal width pill buttons */}
          <div className="border-t border-slate-200 pt-3.5 mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-2">Payment Mode</span>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'upi', 'card'] as const).map((mode) => {
                const isSelected = paymentMode === mode;
                const labels = { cash: 'Cash', upi: 'UPI', card: 'Card' };
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-amber-700 text-amber-700 bg-amber-50/50 font-extrabold'
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row Actions */}
          <div className="flex gap-3 mt-4">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleSaveOrder('held')}
                disabled={cart.length === 0}
                className="flex-1 py-3.5 rounded-xl border-2 border-slate-300 font-extrabold text-xs uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                Hold Tab
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isReadOnly) {
                  onShowReceipt(activeOrder!.id);
                } else {
                  handleSettlePay(paymentMode);
                }
              }}
              disabled={!isReadOnly && cart.length === 0}
              className={`py-3.5 rounded-xl text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 ${
                isReadOnly
                  ? 'flex-1 bg-slate-900 hover:bg-slate-800'
                  : 'flex-[2] bg-amber-800 hover:bg-amber-900 shadow-amber-900/10'
              }`}
            >
              {isReadOnly ? 'Reprint Bill' : `Pay · ₹${grossTotal.toFixed(2)}`}
            </button>
          </div>
        </div>

      </div>

      {/* Add Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-150 p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3.5 mb-4">Add Custom Item</h3>
            <form onSubmit={handleAddCustomItem} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Herbal Tea"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Price (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="0.00"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-950 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Veg Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['veg', 'egg', 'nonveg'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCustomVeg(type)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border-2 uppercase tracking-wide transition-all ${
                        customVeg === type
                          ? type === 'veg'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : type === 'egg'
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-red-500 bg-red-50 text-red-800'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setCustomName('');
                    setCustomPrice('');
                    setShowCustomModal(false);
                  }}
                  className="flex-1 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-800 hover:bg-amber-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-900/10 transition-all"
                >
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
