import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderItem } from '../types';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Flame, Clock, CheckCircle2, AlertCircle, RefreshCw, ChefHat } from 'lucide-react';

interface KitchenScreenProps {
  cafeId: string;
  orders: Order[];
}

interface KitchenKOTItem {
  id: string;
  order: Order;
  items: OrderItem[];
  elapsedSeconds: number;
}

export default function KitchenScreen({ cafeId, orders }: KitchenScreenProps) {
  const [kotList, setKotList] = useState<KitchenKOTItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Dynamic seconds counter to increment KOT ticket timers in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter and compile active cooking tickets
  const activeKOTs = useMemo(() => {
    return orders.filter(o => o.status === 'kot_sent' || o.status === 'open');
  }, [orders]);

  // Load line items for each active cooking ticket
  useEffect(() => {
    let active = true;
    const loadAllLineItems = async () => {
      setLoading(true);
      const compiled: KitchenKOTItem[] = [];
      
      for (const order of activeKOTs) {
        try {
          const itemsSnap = await getDocs(collection(db, 'cafes', cafeId, 'orders', order.id, 'items'));
          const lineItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OrderItem[];
          
          const createdTime = order.created_at ? new Date(order.created_at).getTime() : Date.now();
          const elapsed = Math.floor((currentTime - createdTime) / 1000);

          compiled.push({
            id: order.id,
            order,
            items: lineItems,
            elapsedSeconds: elapsed > 0 ? elapsed : 0
          });
        } catch (err) {
          console.error(err);
        }
      }

      if (active) {
        // Sort by creation time (oldest first to ensure FIFO kitchen logic!)
        compiled.sort((a, b) => {
          const tA = new Date(a.order.created_at).getTime();
          const tB = new Date(b.order.created_at).getTime();
          return tA - tB;
        });
        setKotList(compiled);
        setLoading(false);
      }
    };

    if (activeKOTs.length > 0) {
      loadAllLineItems();
    } else {
      setKotList([]);
    }

    return () => {
      active = false;
    };
  }, [activeKOTs, cafeId]);

  // Real-time calculated elapsed seconds for ticket cards
  const getElapsedFormatted = (createdAtStr: string) => {
    const elapsedMs = currentTime - new Date(createdAtStr).getTime();
    const totalSecs = Math.max(0, Math.floor(elapsedMs / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPriorityColor = (createdAtStr: string) => {
    const elapsedMs = currentTime - new Date(createdAtStr).getTime();
    const mins = Math.floor(elapsedMs / (1000 * 60));
    if (mins >= 15) return 'border-red-500 bg-red-50/50 text-red-900'; // High delay alert
    if (mins >= 8) return 'border-amber-500 bg-amber-50/50 text-amber-900'; // Warning delay
    return 'border-slate-200 bg-white text-slate-800'; // Safe prep speed
  };

  // Dispatch Action: Mark active ticket as SERVED (KOT Completion)
  const handleCompleteKOT = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'cafes', cafeId, 'orders', orderId);
      await updateDoc(orderRef, { status: 'served' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="kitchen-screen" className="space-y-6">
      
      {/* Visual Kitchen KPI summary */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ChefHat className="w-5 h-5 text-amber-600 animate-pulse" />
            Active Kitchen Prep Queue (KOT)
          </h4>
          <p className="text-xs text-slate-400">First-In, First-Out (FIFO) cooking order sheet with live speed audit meters.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 font-mono">Tickets cooking: {kotList.length}</span>
        </div>
      </div>

      {loading && kotList.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Updating live kitchen sheets...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {kotList.map((kot) => {
            const priorityClass = getPriorityColor(kot.order.created_at);
            const isCritical = (currentTime - new Date(kot.order.created_at).getTime()) / (1000 * 60) >= 15;
            
            return (
              <div
                key={kot.id}
                className={`border rounded-xl shadow-sm overflow-hidden flex flex-col justify-between transition-all ${priorityClass}`}
              >
                {/* Card Title block */}
                <div className="p-3 border-b border-slate-200/60 flex items-center justify-between bg-slate-900 text-white">
                  <div>
                    <h5 className="font-extrabold text-sm">{kot.order.table_label}</h5>
                    <span className="text-[10px] text-slate-400 font-mono">Ref: #{kot.id.substring(0, 8)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold">
                    <Clock className={`w-3.5 h-3.5 ${isCritical ? 'text-red-500 animate-bounce' : 'text-amber-500'}`} />
                    <span>{getElapsedFormatted(kot.order.created_at)}</span>
                  </div>
                </div>

                {/* Recipes list */}
                <div className="p-4 flex-1 space-y-3">
                  {kot.items.map((line) => (
                    <div key={line.id} className="border-b border-slate-100/50 pb-2 text-xs">
                      <div className="flex items-start justify-between font-extrabold text-slate-900">
                        <span>{line.menu_item_name}</span>
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">x {line.quantity}</span>
                      </div>
                      {line.note && (
                        <div className="mt-1 text-[10px] text-red-600 bg-red-50 p-1.5 border border-red-100 rounded font-bold">
                          Prep Notes: {line.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Complete / dispatch action button */}
                <div className="p-3 bg-slate-50 border-t border-slate-150 flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-slate-400 font-medium font-mono">FIFO order priority</span>
                  <button
                    onClick={() => handleCompleteKOT(kot.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Served
                  </button>
                </div>

              </div>
            );
          })}

          {kotList.length === 0 && (
            <div className="col-span-full py-24 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white flex flex-col items-center justify-center">
              <ChefHat className="w-12 h-12 text-slate-300 stroke-1 mb-2" />
              <p className="font-semibold text-slate-500">Kitchen stove is completely idle!</p>
              <p className="text-[10px] text-slate-400 mt-1">Pending order requests will automatically populate this cooking monitor.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
