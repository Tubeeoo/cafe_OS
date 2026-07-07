import React, { useState, useEffect } from 'react';
import { Order, OrderItem } from '../types';
import { doc, getDocs, getDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { Printer, X, Flame } from 'lucide-react';

interface KOTModalProps {
  cafeId: string;
  orderId: string;
  onClose: () => void;
}

export default function KOTModal({ cafeId, orderId, onClose }: KOTModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKOTData = async () => {
      try {
        const orderSnap = await getDoc(doc(db, 'cafes', cafeId, 'orders', orderId));
        if (orderSnap.exists()) {
          setOrder({ id: orderSnap.id, ...orderSnap.data() } as Order);
        }

        const itemsSnap = await getDocs(collection(db, 'cafes', cafeId, 'orders', orderId, 'items'));
        setItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OrderItem[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchKOTData();
  }, [cafeId, orderId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">Generating Kitchen Order Ticket (KOT)...</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl text-center space-y-4 max-w-xs">
          <X className="w-8 h-8 text-red-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">Error rendering kitchen ticket</h4>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col h-[80vh]">
        
        {/* Header bar */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0 no-print">
          <h5 className="font-bold text-sm flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
            Kitchen Order Ticket (KOT)
          </h5>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE KOT FRAME */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 font-mono text-xs text-slate-900 flex justify-center print-area">
          <div className="bg-white p-5 border border-slate-200 w-full max-w-sm rounded shadow-sm relative shrink-0 h-fit">
            
            <div className="text-center pb-3 border-b border-dashed border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">KITCHEN TICKET</span>
              <h3 className="text-xl font-extrabold text-slate-950 mt-1 uppercase">KOT DISPATCH</h3>
            </div>

            {/* KOT Metadata logs */}
            <div className="py-3 border-b border-dashed border-slate-200 space-y-0.5 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span>KOT Ref: #{order.id.substring(0, 8)}</span>
                <span>Date: {new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm mt-1">
                <span>Table: {order.table_label}</span>
                <span>Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Cashier: {order.staff_name}
              </div>
            </div>

            {/* KOT Recipes listing with notes */}
            <div className="my-4 border-b border-dashed border-slate-200 pb-4">
              <div className="grid grid-cols-12 gap-1.5 font-bold text-slate-800 pb-1.5 border-b border-slate-100 mb-2">
                <span className="col-span-10">Item Name</span>
                <span className="col-span-2 text-right">Qty</span>
              </div>

              <div className="space-y-3 text-xs">
                {items.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 gap-1.5 border-b border-slate-50 pb-2">
                    <div className="col-span-10">
                      <span className="font-extrabold text-slate-950 text-sm">{line.menu_item_name}</span>
                      {line.note && (
                        <span className="block text-[10px] text-red-600 bg-red-50 p-1 border border-red-100 rounded mt-1 font-bold">
                          Instruction: {line.note}
                        </span>
                      )}
                    </div>
                    <span className="col-span-2 text-right font-extrabold text-slate-950 text-sm font-mono">
                      x {line.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center pt-3 text-[9px] text-slate-400 font-mono">
              Pending preparation logs in queue.
            </div>

          </div>
        </div>

        {/* Lower actions trigger */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex gap-2 shrink-0 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Kitchen Ticket
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs"
          >
            Close Sheet
          </button>
        </div>

      </div>

      {/* Embedded print css rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 0;
            margin: 0;
            box-shadow: none;
            border: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
