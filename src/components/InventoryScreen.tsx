import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Trash2, ShieldAlert, CheckCircle2, RotateCcw, Sparkles, Check, HelpCircle } from 'lucide-react';

interface InventoryScreenProps {
  cafeId: string;
  inventory: InventoryItem[];
  currency: string;
}

export default function InventoryScreen({ cafeId, inventory, currency }: InventoryScreenProps) {
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);
  const [costPerUnit, setCostPerUnit] = useState<number>(0);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Restocking modal states
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQuantity, setRestockQuantity] = useState<number>(10);
  const [restockGst, setRestockGst] = useState<number>(0);

  // 1. Save stock item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    try {
      const itemId = editingItemId || `inv_${Date.now()}`;
      const invRef = doc(db, 'cafes', cafeId, 'inventory_items', itemId);

      await setDoc(invRef, {
        id: itemId,
        name: itemName.trim(),
        unit: itemUnit,
        current_stock: Number(currentStock),
        min_stock: Number(minStock),
        cost_per_unit: Number(costPerUnit),
        updated_at: new Date().toISOString()
      });

      setSuccessMsg(editingItemId ? 'Ingredient metrics updated!' : 'Ingredient added to inventory!');
      setItemName('');
      setItemUnit('kg');
      setCurrentStock(0);
      setMinStock(5);
      setCostPerUnit(0);
      setEditingItemId(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving inventory:', err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;
    try {
      await deleteDoc(doc(db, 'cafes', cafeId, 'inventory_items', id));
    } catch (err) {
      console.error('Error deleting inventory:', err);
    }
  };

  // 2. Perform RESTOCK Action & Log Expense synchronously
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem || restockQuantity <= 0) return;

    try {
      const updatedStock = restockItem.current_stock + restockQuantity;
      const totalCost = restockQuantity * restockItem.cost_per_unit;

      // A. Update Inventory Stock Level
      const invRef = doc(db, 'cafes', cafeId, 'inventory_items', restockItem.id);
      await setDoc(invRef, {
        ...restockItem,
        current_stock: updatedStock,
        updated_at: new Date().toISOString()
      });

      // B. Auto-Log into Expenses (general ledger operational expense)
      const expenseId = `exp_restock_${Date.now()}`;
      const expRef = doc(db, 'cafes', cafeId, 'expenses', expenseId);
      
      await setDoc(expRef, {
        id: expenseId,
        date: new Date().toISOString().split('T')[0],
        category: 'raw_materials',
        vendor: 'Inventory Vendor',
        amount: totalCost,
        gst_paid: Number(restockGst) || 0,
        notes: `Restocked ${restockQuantity} ${restockItem.unit} of ${restockItem.name}`,
        created_at: new Date().toISOString()
      });

      setSuccessMsg(`Restocked ${restockItem.name}! Auto-logged expense of ${currency}${totalCost.toFixed(2)}.`);
      setRestockItem(null);
      setRestockQuantity(10);
      setRestockGst(0);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error restocking:', err);
    }
  };

  // Compile low stock alerts
  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.current_stock <= item.min_stock);
  }, [inventory]);

  return (
    <div id="inventory-screen" className="space-y-6">
      
      {/* ALERTS / INSIGHTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Stock Tracker */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            lowStockItems.length > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Safety Reorder Warnings</h4>
            {lowStockItems.length > 0 ? (
              <p className="text-xs text-red-600 font-semibold mt-0.5">{lowStockItems.length} ingredients are below threshold levels!</p>
            ) : (
              <p className="text-xs text-emerald-600 font-semibold mt-0.5">All stock lines are completely healthy.</p>
            )}
          </div>
        </div>

        {/* Quick Inventory Summary */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Registered Line Items</h4>
            <p className="text-xs text-slate-400 mt-0.5">{inventory.length} ingredients currently active in pantry.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* EDIT / CREATE FORM (4/12 columns) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-amber-600" />
            {editingItemId ? 'Update Ingredient' : 'Register Ingredient'}
          </h4>

          {successMsg && (
            <div className="flex items-start gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs mb-3 font-semibold">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs text-slate-600">
            <div>
              <label className="block font-semibold mb-1">Ingredient Name *</label>
              <input
                type="text"
                placeholder="e.g. Arabica Coffee Beans"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Current Stock Level</label>
                <input
                  type="number"
                  placeholder="e.g. 20"
                  required
                  value={currentStock || ''}
                  onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Unit Metric</label>
                <select
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="ltr">Liters (ltr)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="box">Boxes (box)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Min Safety Level</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  required
                  value={minStock || ''}
                  onChange={(e) => setMinStock(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Cost Per Unit</label>
                <input
                  type="number"
                  placeholder="e.g. 350"
                  required
                  value={costPerUnit || ''}
                  onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-sm"
              >
                {editingItemId ? 'Update Ingredient' : 'Register Ingredient'}
              </button>
              {editingItemId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemId(null);
                    setItemName('');
                    setCurrentStock(0);
                    setMinStock(5);
                    setCostPerUnit(0);
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold border border-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* INVENTORY LIST (8/12 columns) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Ingredients Inventory</h4>
                <p className="text-xs text-slate-400">Pantry metrics with restock cost reconciliation triggers.</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5">Ingredient Name</th>
                    <th className="py-2.5 font-mono">Current Stock</th>
                    <th className="py-2.5 font-mono">Safety Level</th>
                    <th className="py-2.5 font-mono">Unit Cost</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {inventory.map((item) => {
                    const isLow = item.current_stock <= item.min_stock;
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isLow ? 'bg-red-50/20' : ''}`}>
                        <td className="py-2.5 font-semibold">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold flex items-center gap-1 w-fit ${
                            isLow ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="py-2.5 font-mono font-bold text-slate-800">
                          {item.current_stock} {item.unit}
                        </td>
                        <td className="py-2.5 font-mono text-slate-400">
                          {item.min_stock} {item.unit}
                        </td>
                        <td className="py-2.5 font-mono font-semibold text-slate-600">{currency}{item.cost_per_unit.toFixed(2)}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setRestockItem(item)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold"
                            >
                              Restock
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemId(item.id);
                                setItemName(item.name);
                                setItemUnit(item.unit);
                                setCurrentStock(item.current_stock);
                                setMinStock(item.min_stock);
                                setCostPerUnit(item.cost_per_unit);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No pantry line items found. Register some ingredients to start auditing stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* RESTOCK DIALOG / MODAL REPRESENTATION */}
      {restockItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="bg-slate-900 p-4 text-white">
              <h5 className="font-bold text-sm flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
                Restock {restockItem.name}
              </h5>
              <p className="text-[10px] text-slate-400">Restocking automatically triggers an expense entry.</p>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-4 space-y-4 text-xs text-slate-600">
              <div>
                <label className="block font-semibold mb-1">Restock Quantity ({restockItem.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQuantity || ''}
                  onChange={(e) => setRestockQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono"
                />
                <span className="block text-[10px] text-slate-400 mt-1 font-mono">
                  Cost calculated: {restockQuantity} x {currency}{restockItem.cost_per_unit.toFixed(2)} = <strong>{currency}{(restockQuantity * restockItem.cost_per_unit).toFixed(2)}</strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Included GST Paid</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={restockGst || ''}
                  onChange={(e) => setRestockGst(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-sm"
                >
                  Post Restock & Log Cost
                </button>
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
