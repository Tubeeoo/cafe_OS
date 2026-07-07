import React, { useState, useEffect } from 'react';
import { Order, OrderItem, Cafe } from '../types';
import { doc, getDocs, getDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { Printer, X, Receipt, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  cafeId: string;
  orderId: string;
  onClose: () => void;
  currency: string;
}

export default function ReceiptModal({ cafeId, orderId, onClose, currency }: ReceiptModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReceiptData = async () => {
      try {
        const orderSnap = await getDoc(doc(db, 'cafes', cafeId, 'orders', orderId));
        if (orderSnap.exists()) {
          setOrder({ id: orderSnap.id, ...orderSnap.data() } as Order);
        }

        const itemsSnap = await getDocs(collection(db, 'cafes', cafeId, 'orders', orderId, 'items'));
        setItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OrderItem[]);

        const cafeSnap = await getDoc(doc(db, 'cafes', cafeId));
        if (cafeSnap.exists()) {
          setCafe(cafeSnap.data() as Cafe);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptData();
  }, [cafeId, orderId]);

  const handlePrint = () => {
    window.print();
  };

  const renderVegDot = (type?: 'veg' | 'egg' | 'nonveg') => {
    if (!type) return null;
    const color = type === 'veg' ? 'bg-emerald-600' : type === 'egg' ? 'bg-amber-500' : 'bg-red-500';
    return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} mr-1 shrink-0`} />;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">Generating invoice receipt...</span>
        </div>
      </div>
    );
  }

  if (!order || !cafe) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl text-center space-y-4 max-w-xs">
          <X className="w-8 h-8 text-red-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">Error rendering invoice</h4>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs">Close</button>
        </div>
      </div>
    );
  }

  // Calculate detailed tax liability schedule for receipt breakdown
  // CGST and SGST are standard 50-50 splits of total item tax
  const taxSummary = items.reduce((sum, item) => {
    const base = item.quantity * item.unit_price;
    const tax = base * (item.gst_rate / 100);
    return sum + tax;
  }, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col h-[90vh]">
        
        {/* Header bar */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0 no-print">
          <h5 className="font-bold text-sm flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-amber-500" />
            Invoice Receipt Details
          </h5>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE RECEIPT FRAME */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 font-mono text-xs text-slate-900 flex justify-center print-area">
          <div className="bg-white p-5 border border-slate-200 w-full max-w-sm rounded shadow-sm relative shrink-0 h-fit">
            
            {/* Settle icon representation */}
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold no-print">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              PAID
            </div>

            {/* Thermal trading header details */}
            <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-200">
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-tight">{cafe.name}</h3>
              <p className="text-[10px] text-slate-500 leading-snug">{cafe.address}</p>
              <p className="text-[10px] text-slate-500">Ph: {cafe.phone_1}</p>
              {cafe.gstin && <p className="text-[10px] text-slate-500">GSTIN: {cafe.gstin}</p>}
              {cafe.fssai_license && <p className="text-[10px] text-slate-500">FSSAI: {cafe.fssai_license}</p>}
            </div>

            {/* Cashier logs */}
            <div className="py-3 border-b border-dashed border-slate-200 space-y-0.5 text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Bill ID: #{order.id.substring(0, 8)}</span>
                <span>Date: {new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {order.staff_name}</span>
                <span>Time: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-700 mt-1">
                <span>Table: {order.table_label}</span>
                <span className="uppercase">Mode: {order.payment_mode || 'Draft'}</span>
              </div>
            </div>

            {/* Itemized shopping cart */}
            <table className="w-full text-left my-4 border-b border-dashed border-slate-200 text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 font-bold text-slate-700">
                  <th className="pb-1.5 w-1/2">Menu Item</th>
                  <th className="pb-1.5 text-center">Qty</th>
                  <th className="pb-1.5 text-right">Price</th>
                  <th className="pb-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {items.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1.5 text-slate-900 font-semibold">
                      <div className="flex items-center">
                        {renderVegDot(line.veg_type)}
                        <span className="truncate max-w-[120px]">{line.menu_item_name}</span>
                      </div>
                    </td>
                    <td className="py-1.5 text-center text-slate-600">{line.quantity}</td>
                    <td className="py-1.5 text-right text-slate-500">{line.unit_price}</td>
                    <td className="py-1.5 text-right font-bold text-slate-950">{(line.quantity * line.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial balance breakdown */}
            <div className="space-y-1.5 text-right text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Subtotal (Net base):</span>
                <span className="font-bold text-slate-800">{currency}{order.subtotal.toFixed(2)}</span>
              </div>
              
              {/* CGST + SGST split schedule */}
              <div className="flex justify-between">
                <span>CGST (Central Tax 2.5%):</span>
                <span className="font-bold text-slate-800">{currency}{(taxSummary / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (State Tax 2.5%):</span>
                <span className="font-bold text-slate-800">{currency}{(taxSummary / 2).toFixed(2)}</span>
              </div>

              {order.discount_percent > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Discount ({order.discount_percent}%):</span>
                  <span>-{currency}{((order.subtotal + taxSummary) * (order.discount_percent / 100)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Round-Off adjustment:</span>
                <span className="font-bold text-slate-800">
                  {order.round_off >= 0 ? '+' : ''}{order.round_off.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-950 border-t border-dashed border-slate-200 pt-2 mt-1">
                <span>Gross Total Payable:</span>
                <span className="font-mono text-amber-800 text-base">{currency}{order.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer receipt remarks */}
            <div className="text-center pt-5 mt-4 border-t border-dashed border-slate-200 text-[9px] text-slate-400 leading-normal">
              <p>{cafe.receipt_footer}</p>
              <p className="mt-1 font-mono text-[8px]">POS Companion Cloud Powered</p>
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
            Print Bill Invoice
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
