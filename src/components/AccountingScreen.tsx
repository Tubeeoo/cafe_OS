import React, { useState, useMemo } from 'react';
import { Expense, Order } from '../types';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Trash2, Calendar, FileText, Check, Percent, Landmark, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface AccountingScreenProps {
  cafeId: string;
  expenses: Expense[];
  orders: Order[];
  currency: string;
}

export default function AccountingScreen({ cafeId, expenses, orders, currency }: AccountingScreenProps) {
  const [expenseCategory, setExpenseCategory] = useState('raw_materials');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseGst, setExpenseGst] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Save operational expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) return;

    try {
      const expenseId = `exp_${Date.now()}`;
      const expRef = doc(db, 'cafes', cafeId, 'expenses', expenseId);

      await setDoc(expRef, {
        id: expenseId,
        date: new Date().toISOString().split('T')[0],
        category: expenseCategory,
        vendor: expenseVendor.trim() || 'General Vendor',
        amount: Number(expenseAmount),
        gst_paid: Number(expenseGst) || 0,
        notes: expenseNotes.trim(),
        created_at: new Date().toISOString()
      });

      setSuccessMsg('Operational expense logged into general ledger!');
      setExpenseVendor('');
      setExpenseAmount(0);
      setExpenseGst(0);
      setExpenseNotes('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error logging expense:', err);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await deleteDoc(doc(db, 'cafes', cafeId, 'expenses', id));
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  // 2. Financial Calculations (Month-to-Date P&L)
  const pAndL = useMemo(() => {
    const totalSalesRevenue = orders
      .filter(o => o.status === 'settled')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const totalSalesBase = orders
      .filter(o => o.status === 'settled')
      .reduce((sum, o) => sum + (o.subtotal || 0), 0);

    const totalSalesGst = totalSalesRevenue - totalSalesBase;

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalExpensesGst = expenses.reduce((sum, e) => sum + e.gst_paid, 0);

    const netProfit = totalSalesBase - (totalExpenses - totalExpensesGst);

    return {
      salesRevenue: totalSalesRevenue,
      salesBase: totalSalesBase,
      salesGst: totalSalesGst,
      expensesTotal: totalExpenses,
      expensesGst: totalExpensesGst,
      netProfit
    };
  }, [orders, expenses]);

  // 3. Tax Liability summary by Rate
  const gstLiability = useMemo(() => {
    // Collect output tax (GST from sales) grouped by rate (5%, 12%, 18%)
    // Since we don't fetch all individual items recursively here, we approximate or assume a 5% baseline, 
    // but let's calculate exact sales GST split
    const salesBase = pAndL.salesBase;
    const outputGst = pAndL.salesGst;
    
    // CGST and SGST are a 50/50 split of the total GST Collected
    const cgstCollected = outputGst / 2;
    const sgstCollected = outputGst / 2;

    const inputGst = pAndL.expensesGst;
    const cgstPaid = inputGst / 2;
    const sgstPaid = inputGst / 2;

    const netLiability = outputGst - inputGst;

    return {
      cgstCollected,
      sgstCollected,
      cgstPaid,
      sgstPaid,
      netLiability
    };
  }, [pAndL]);

  return (
    <div id="accounting-screen" className="space-y-6">
      
      {/* PROFIT AND LOSS DASH (3 metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5 text-slate-500 text-xs font-semibold">
            <span>Gross Sales (MTD)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold font-mono text-slate-900">{currency}{pAndL.salesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Excludes voided orders</p>
        </div>

        {/* Expenses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5 text-slate-500 text-xs font-semibold">
            <span>Logged Expenses (MTD)</span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold font-mono text-slate-900">{currency}{pAndL.expensesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Includes logged inventory costs</p>
        </div>

        {/* Net Operating Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5 text-slate-500 text-xs font-semibold">
            <span>Net Operating Profit</span>
            <Landmark className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className={`text-2xl font-bold font-mono ${pAndL.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {pAndL.netProfit < 0 ? '-' : ''}{currency}{Math.abs(pAndL.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Base Revenue less Base operational cost</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEDGER EXPENSE FORM (4/12 columns) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-amber-600" />
            Log Operational Expense
          </h4>

          {successMsg && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs mb-3 font-semibold">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs text-slate-600">
            <div>
              <label className="block font-semibold mb-1">Expense Classification</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
              >
                <option value="raw_materials">Raw Materials & Ingredients</option>
                <option value="utilities">Power & Electricity</option>
                <option value="rent">Property Rental</option>
                <option value="marketing">Social Ads & Prints</option>
                <option value="salary">Staff Compensation</option>
                <option value="miscellaneous">Other Miscellaneous</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Vendor / Recipient</label>
              <input
                type="text"
                placeholder="e.g. Metro Wholesale Foods"
                required
                value={expenseVendor}
                onChange={(e) => setExpenseVendor(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Gross Spend *</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  required
                  value={expenseAmount || ''}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Included GST Paid</label>
                <input
                  type="number"
                  placeholder="e.g. 250"
                  value={expenseGst || ''}
                  onChange={(e) => setExpenseGst(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Brief Description</label>
              <input
                type="text"
                placeholder="Notes about invoice"
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-sm pt-2"
            >
              Post Expense Entry
            </button>
          </form>
        </div>

        {/* GENERAL LEDGER & GST FILING (8/12 columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* GST TAX SUMMARY CARD */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-amber-600" />
              Tax Liability Ledger (GST Breakdown)
            </h4>
            <p className="text-xs text-slate-400 mb-4">Detailed tax filing breakdown split between Output (Sales Collected) and Input Tax Credits (ITC).</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="block font-bold text-slate-500 mb-1">CGST / SGST Collected</span>
                <span className="font-mono text-slate-900 block font-semibold">{currency}{gstLiability.cgstCollected.toFixed(2)} CGST</span>
                <span className="font-mono text-slate-900 block font-semibold">{currency}{gstLiability.sgstCollected.toFixed(2)} SGST</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="block font-bold text-slate-500 mb-1">ITC Claimable (Purchases)</span>
                <span className="font-mono text-slate-900 block font-semibold">{currency}{gstLiability.cgstPaid.toFixed(2)} CGST</span>
                <span className="font-mono text-slate-900 block font-semibold">{currency}{gstLiability.sgstPaid.toFixed(2)} SGST</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="block font-bold text-slate-500 mb-1">Net GST Liability</span>
                <span className={`font-mono block font-bold text-base ${gstLiability.netLiability >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {currency}{gstLiability.netLiability.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Due to authorities</span>
              </div>
            </div>
          </div>

          {/* LEDGER TRANSACTION LIST */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              General Ledger Expenses
            </h4>

            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5">Vendor</th>
                    <th className="py-2.5">Notes</th>
                    <th className="py-2.5 font-mono text-right">GST Paid</th>
                    <th className="py-2.5 font-mono text-right">Amount</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-500">{exp.date}</td>
                      <td className="py-2.5 font-semibold text-slate-800 capitalize">{exp.category.replace('_', ' ')}</td>
                      <td className="py-2.5 text-slate-900">{exp.vendor}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[150px]">{exp.notes || 'No description'}</td>
                      <td className="py-2.5 font-mono text-right text-slate-500">{currency}{exp.gst_paid.toFixed(2)}</td>
                      <td className="py-2.5 font-mono text-right font-extrabold text-slate-900">{currency}{exp.amount.toFixed(2)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-400">
                        No general ledger expense records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
