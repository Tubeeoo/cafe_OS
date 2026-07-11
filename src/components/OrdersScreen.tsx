import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderItem, Table } from '../types';
import { 
  Search, 
  Receipt, 
  Edit, 
  Printer, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  ShoppingBag, 
  ArrowRight, 
  History, 
  Utensils,
  CreditCard 
} from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface OrdersScreenProps {
  cafeId: string;
  orders: Order[];
  tables: Table[];
  currency: string;
  onEditOrder: (orderId: string) => void;
  onShowReceipt: (orderId: string) => void;
  onShowKOT: (orderId: string) => void;
}

export default function OrdersScreen({
  cafeId,
  orders,
  tables,
  currency,
  onEditOrder,
  onShowReceipt,
  onShowKOT
}: OrdersScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled' | 'void'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Sort orders with newest first
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [orders]);

  // Filter orders by status and search query (ID or customer name)
  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(o => {
      const matchesSearch = 
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.table_label && o.table_label.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'active') {
        return o.status === 'open' || o.status === 'kot_sent' || o.status === 'served' || o.status === 'held';
      }
      if (statusFilter === 'settled') {
        return o.status === 'settled';
      }
      if (statusFilter === 'void') {
        return o.status === 'void';
      }
      return true;
    });
  }, [sortedOrders, searchQuery, statusFilter]);

  // Selected order details object
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Auto select first order if none selected
  useEffect(() => {
    if (filteredOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  // Fetch items for selected order
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderItems([]);
      return;
    }

    let active = true;
    const fetchOrderItems = async () => {
      setIsLoadingItems(true);
      try {
        const itemsRef = collection(db, 'cafes', cafeId, 'orders', selectedOrderId, 'items');
        const snap = await getDocs(itemsRef);
        if (active) {
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as OrderItem[];
          setSelectedOrderItems(items);
        }
      } catch (err) {
        console.error('Error fetching order items:', err);
      } finally {
        if (active) setIsLoadingItems(false);
      }
    };

    fetchOrderItems();
    return () => {
      active = false;
    };
  }, [selectedOrderId, cafeId]);

  // Helper for status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'settled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Settled
          </span>
        );
      case 'held':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
            <Clock className="w-3 h-3" /> Held
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
            Draft
          </span>
        );
      case 'kot_sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
            KOT Sent
          </span>
        );
      case 'served':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
            Served
          </span>
        );
      case 'void':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Voided
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
      {/* LEFT PANEL: Orders List (5/12) */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        
        {/* Search & Filters */}
        <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Order ID, table, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', 'active', 'settled', 'void'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  statusFilter === filter
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredOrders.map((o) => {
            const isSelected = o.id === selectedOrderId;
            const orderDate = o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected ? 'bg-slate-50 border-l-4 border-amber-600' : 'hover:bg-slate-50/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {o.order_type === 'takeout' ? '🛍️ Takeout' : `🍽️ ${o.table_label}`}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      #{o.id.replace('ord_', '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-medium">{o.customer_name || 'Walk-in'}</span>
                    <span>•</span>
                    <span>{orderDate}</span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span className="block font-bold text-slate-900 font-mono text-xs">
                    {currency}{o.total.toFixed(2)}
                  </span>
                  <div>
                    {renderStatusBadge(o.status)}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <Receipt className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-3" />
              <p className="text-xs font-semibold">No orders matched criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Order Detail/Preview (7/12) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {selectedOrder ? (
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Detail Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-950 text-base uppercase">
                    {selectedOrder.order_type === 'takeout' ? '🛍️ Takeout Order' : `🍽️ ${selectedOrder.table_label}`}
                  </h3>
                  {renderStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-slate-500">
                  ID: <span className="font-mono font-bold text-slate-800">{selectedOrder.id}</span> • {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : ''}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Edit allowed for open/held orders */}
                {selectedOrder.status !== 'settled' && selectedOrder.status !== 'void' ? (
                  <button
                    onClick={() => onEditOrder(selectedOrder.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit Order
                  </button>
                ) : null}

                {/* Settle Bill for held/open orders */}
                {selectedOrder.status === 'open' || selectedOrder.status === 'held' ? (
                  <button
                    onClick={() => onEditOrder(selectedOrder.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Settle Bill
                  </button>
                ) : null}

                {/* Print button */}
                {selectedOrder.status === 'settled' ? (
                  <button
                    onClick={() => onShowReceipt(selectedOrder.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Reprint Bill
                  </button>
                ) : (
                  <button
                    onClick={() => onShowKOT(selectedOrder.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    KOT
                  </button>
                )}
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Customer & Staff Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer Details</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-800">{selectedOrder.customer_name || 'Walk-in Customer'}</span>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Served By</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-semibold text-slate-800">{selectedOrder.staff_name || 'Cashier'}</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Items</h4>
                {isLoadingItems ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading order items...</div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {selectedOrderItems.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-900">{item.menu_item_name}</span>
                          {item.note && (
                            <p className="text-[10px] text-amber-700 italic">“{item.note}”</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="block text-xs font-mono font-medium text-slate-600">
                            {currency}{item.unit_price} x {item.quantity}
                          </span>
                          <span className="block text-xs font-mono font-bold text-slate-900 mt-0.5">
                            {currency}{(item.unit_price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {selectedOrderItems.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">No items found in this order.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Summary Calculations */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500 uppercase tracking-wider">
                  <span>Subtotal</span>
                  <span className="font-mono">{currency}{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrder.discount_percent > 0 && (
                  <div className="flex justify-between text-red-600 font-bold uppercase tracking-wider">
                    <span>Discount ({selectedOrder.discount_percent}%)</span>
                    <span className="font-mono">-{currency}{(selectedOrder.subtotal * (selectedOrder.discount_percent / 100)).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 uppercase tracking-wider">
                  <span>Round-Off</span>
                  <span className="font-mono">
                    {selectedOrder.round_off >= 0 ? '+' : ''}{currency}{selectedOrder.round_off.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2.5 mt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-900 uppercase">Total Bill</span>
                  <span className="text-amber-800 text-lg font-mono font-black">{currency}{selectedOrder.total.toFixed(2)}</span>
                </div>
                
                {/* Payment Method details */}
                <div className="pt-2.5 mt-2 border-t border-slate-200/60 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Payment Method</span>
                  <span className="font-black text-slate-800 font-sans">
                    {selectedOrder.payment_mode ? selectedOrder.payment_mode.toUpperCase() : (selectedOrder.status === 'held' ? 'HELD TAB' : 'DRAFT')}
                  </span>
                </div>
              </div>

              {/* Edit History Log */}
              {selectedOrder.orderEditHistory && selectedOrder.orderEditHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Order Edit Audit Log
                  </h4>
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                    {selectedOrder.orderEditHistory.map((log, idx) => (
                      <div key={idx} className="relative text-xs">
                        {/* Dot */}
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
                        <div className="text-[10px] text-slate-400 font-medium">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div className="text-slate-700 font-semibold mt-0.5">
                          Total modified by <span className="text-slate-900">{log.edited_by}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 mt-0.5">
                          <span>{currency}{log.previous_total.toFixed(2)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-slate-800">{currency}{log.new_total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20">
            <Utensils className="w-16 h-16 stroke-1 text-slate-200 mb-3 animate-pulse" />
            <p className="text-xs font-semibold">Select an order from the list</p>
            <p className="text-[10px] text-slate-400 mt-1">Click any order on the left panel to preview its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
