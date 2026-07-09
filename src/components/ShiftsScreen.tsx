import React, { useState, useMemo } from 'react';
import { Shift, Order, Staff } from '../types';
import { 
  Briefcase, 
  Clock, 
  Coins, 
  Smartphone, 
  CreditCard, 
  TrendingUp, 
  Calendar, 
  ShieldAlert, 
  Check, 
  Users, 
  Lock, 
  Unlock, 
  ChevronRight, 
  AlertCircle, 
  Layers
} from 'lucide-react';

interface ShiftsScreenProps {
  cafeId: string;
  shifts: Shift[];
  orders: Order[];
  currentShift: Shift | null;
  currentUser: Staff;
  onOpenShift: (openingCash: number) => void;
  onCloseShift: (closingCash: number) => void;
  currency: string;
}

export default function ShiftsScreen({
  cafeId,
  shifts,
  orders,
  currentShift,
  currentUser,
  onOpenShift,
  onCloseShift,
  currency
}: ShiftsScreenProps) {
  const [openingCashInput, setOpeningCashInput] = useState<string>('1000');
  const [actualClosingCashInput, setActualClosingCashInput] = useState<string>('');
  const [closingError, setClosingError] = useState<string | null>(null);

  // 1. Calculate live sales for the active shift (if any)
  const activeShiftStats = useMemo(() => {
    if (!currentShift) return { cash: 0, upi: 0, card: 0, total: 0 };
    
    // Filter settled orders belonging to this specific shift
    const shiftOrders = orders.filter(
      o => o.shift_id === currentShift.id && o.status === 'settled'
    );
    
    const cash = shiftOrders.filter(o => o.payment_mode === 'cash').reduce((sum, o) => sum + o.total, 0);
    const upi = shiftOrders.filter(o => o.payment_mode === 'upi').reduce((sum, o) => sum + o.total, 0);
    const card = shiftOrders.filter(o => o.payment_mode === 'card').reduce((sum, o) => sum + o.total, 0);
    const total = cash + upi + card;

    return { cash, upi, card, total };
  }, [currentShift, orders]);

  // Expected cash in drawer is Opening Float + Cash Sales
  const expectedClosingCash = useMemo(() => {
    if (!currentShift) return 0;
    return currentShift.opening_cash + activeShiftStats.cash;
  }, [currentShift, activeShiftStats]);

  // Discrepancy: Actual closing cash entered vs Expected closing cash
  const discrepancy = useMemo(() => {
    const entered = parseFloat(actualClosingCashInput) || 0;
    return entered - expectedClosingCash;
  }, [actualClosingCashInput, expectedClosingCash]);

  // 2. Filter shifts history to only include closed ones
  const closedShifts = useMemo(() => {
    return shifts
      .filter(s => s.status === 'closed')
      .sort((a, b) => {
        const dateA = new Date(a.closed_at || a.opened_at).getTime();
        const dateB = new Date(b.closed_at || b.opened_at).getTime();
        return dateB - dateA;
      });
  }, [shifts]);

  const handleOpenRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const float = parseFloat(openingCashInput);
    if (isNaN(float) || float < 0) {
      alert('Please enter a valid opening float amount.');
      return;
    }
    onOpenShift(float);
  };

  const handleCloseRegister = () => {
    const entered = parseFloat(actualClosingCashInput);
    if (isNaN(entered) || entered < 0) {
      setClosingError('Please enter the actual physical cash counted in the drawer.');
      return;
    }
    setClosingError(null);
    onCloseShift(entered);
    setActualClosingCashInput('');
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div id="shifts-screen" className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-700" />
            Cashier Drawer Shifts
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Initialize opening floats, track cash reconciliation, view live sales breakdown, and audit register history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            currentShift 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentShift ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`}></span>
            {currentShift ? 'Register Open' : 'Register Closed'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ACTIVE DRAWER CONTROL (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {currentShift ? (
            /* ACTIVE SHIFT PANEL */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between h-full">
              
              {/* Active Header */}
              <div className="bg-emerald-50/50 border-b border-slate-100 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700">
                      <Unlock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900">Active Shift Session</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Opened by <span className="font-bold text-slate-700">{currentShift.staff_name}</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Session ID</span>
                    <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-150 px-2 py-0.5 rounded shadow-sm">
                      {currentShift.id.replace('shift_', '')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-6 border-t border-slate-100 pt-4">
                  <div>
                    <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400">Opened At</span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(currentShift.opened_at)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400">Opening Cash Float</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono mt-1 block">
                      {currency}{currentShift.opening_cash.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Sales Breakdown */}
              <div className="p-6 space-y-5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Live Sales Summary (Settled Bills)
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-center">
                    <div className="w-8 h-8 mx-auto bg-white rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 mb-2">
                      <Coins className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cash Sales</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono mt-0.5 block">{currency}{activeShiftStats.cash.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-center">
                    <div className="w-8 h-8 mx-auto bg-white rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 mb-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">UPI Sales</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono mt-0.5 block">{currency}{activeShiftStats.upi.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-center">
                    <div className="w-8 h-8 mx-auto bg-white rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 mb-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Card Sales</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono mt-0.5 block">{currency}{activeShiftStats.card.toFixed(2)}</span>
                  </div>
                </div>

                {/* Expected Reconciled Cash */}
                <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/70 flex justify-between items-center">
                  <div>
                    <span className="block text-xs font-bold text-amber-900">Expected Cash in Drawer</span>
                    <span className="text-[10px] text-amber-700 block mt-0.5">Opening Float ({currency}{currentShift.opening_cash}) + Cash Sales ({currency}{activeShiftStats.cash})</span>
                  </div>
                  <span className="text-lg font-black text-amber-800 font-mono">{currency}{expectedClosingCash.toFixed(2)}</span>
                </div>
              </div>

              {/* Close Shift Form */}
              <div className="border-t border-slate-100 p-6 bg-slate-50 rounded-b-3xl">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3.5">Reconcile & Close Register</h4>
                
                {closingError && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs mb-4 font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    {closingError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Actual Physical Cash Counted in Drawer *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400 font-mono font-bold text-sm">{currency}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Counted physical cash"
                        value={actualClosingCashInput}
                        onChange={(e) => {
                          setActualClosingCashInput(e.target.value);
                          setClosingError(null);
                        }}
                        className="w-full pl-7 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Real-time Discrepancy indicator */}
                  {actualClosingCashInput.trim() !== '' && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                      discrepancy === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : discrepancy < 0
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                      <div>
                        <span>Status: </span>
                        {discrepancy === 0 ? (
                          <span className="font-extrabold">Drawer Reconciled Perfectly</span>
                        ) : discrepancy < 0 ? (
                          <span className="font-extrabold">Cash Shortage</span>
                        ) : (
                          <span className="font-extrabold">Cash Surplus</span>
                        )}
                      </div>
                      <span className="font-mono font-black text-sm">
                        {discrepancy >= 0 ? '+' : ''}{currency}{discrepancy.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleCloseRegister}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-red-900/10 transition-all"
                  >
                    Close Shift & Lock Register
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* CLOSED SHIFT - INITIALIZE OPEN REGISTER */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center flex flex-col justify-center items-center py-16 h-full">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center border-2 border-amber-100 mb-6 animate-pulse">
                <Lock className="w-7 h-7 text-amber-700" />
              </div>
              
              <h3 className="text-lg font-black text-slate-900">Shift Register is Locked</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                Before you can process orders or complete checkouts in the POS, you must initialize the register with an opening cash float.
              </p>

              <form onSubmit={handleOpenRegister} className="w-full max-w-sm mt-8 space-y-4">
                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Opening Cash Float (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400 font-mono font-bold text-sm">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 1000"
                      value={openingCashInput}
                      onChange={(e) => setOpeningCashInput(e.target.value)}
                      className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 italic font-mono">This is the cash starting balance in the drawer today.</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-amber-800 hover:bg-amber-900 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-amber-900/10 transition-all flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  Initialize & Open Register
                </button>
              </form>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: QUICK STATS & HISTORY LEDGER (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* STATS CARD */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-850 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <Layers className="w-32 h-32" />
            </div>
            
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">Overview</span>
            <h3 className="text-base font-black uppercase tracking-tight mt-1">Shifts Ledger</h3>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Total Shifts</span>
                <span className="text-lg font-black font-mono mt-1 block">{shifts.length}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Closed History</span>
                <span className="text-lg font-black font-mono mt-1 block text-amber-500">{closedShifts.length}</span>
              </div>
            </div>
          </div>

          {/* HISTORICAL LEDGER */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              Shift History Log
            </h3>

            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {closedShifts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="text-xs font-bold italic">No past closed shifts recorded</span>
                </div>
              ) : (
                closedShifts.map((shift) => {
                  const cashSales = shift.sales_cash || 0;
                  const upiSales = shift.sales_upi || 0;
                  const cardSales = shift.sales_card || 0;
                  const totalRev = cashSales + upiSales + cardSales;
                  const expectedCash = shift.opening_cash + cashSales;
                  const actualCash = shift.actual_closing_cash ?? expectedCash;
                  const diff = actualCash - expectedCash;

                  return (
                    <div 
                      key={shift.id} 
                      className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl transition-all relative group"
                    >
                      {/* Top row */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="block text-xs font-black text-slate-900">{shift.staff_name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono font-bold mt-0.5">ID: {shift.id.replace('shift_', '')}</span>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-300/30 uppercase">
                          Closed
                        </span>
                      </div>

                      {/* Timeline */}
                      <div className="mt-3 text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-2 flex justify-between items-center flex-wrap gap-1">
                        <span>O: {formatDate(shift.opened_at)}</span>
                        <span>C: {formatDate(shift.closed_at)}</span>
                      </div>

                      {/* Metrics block */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] bg-white p-2.5 rounded-xl border border-slate-150 font-mono">
                        <div>
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-semibold">Opening Float</span>
                          <span className="font-bold text-slate-700">{currency}{shift.opening_cash}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-semibold">Total Revenue</span>
                          <span className="font-bold text-emerald-700">{currency}{totalRev}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-semibold">Actual Drawer</span>
                          <span className="font-extrabold text-slate-800">{currency}{actualCash}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-semibold">Variance</span>
                          <span className={`font-black ${diff === 0 ? 'text-slate-500' : diff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {diff >= 0 ? '+' : ''}{diff}
                          </span>
                        </div>
                      </div>

                      {/* Drawer breakdown details */}
                      <div className="mt-2 flex gap-3 text-[9px] text-slate-400 font-bold justify-between font-mono px-1">
                        <span>CASH: {currency}{cashSales}</span>
                        <span>UPI: {currency}{upiSales}</span>
                        <span>CARD: {currency}{cardSales}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
