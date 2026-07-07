import React, { useState } from 'react';
import { Category, MenuItem, VegType } from '../types';
import { doc, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Trash2, Edit2, Upload, FileSpreadsheet, Sparkles, Check, AlertCircle, ShoppingBag, FolderHeart } from 'lucide-react';

interface MenuScreenProps {
  cafeId: string;
  categories: Category[];
  menuItems: MenuItem[];
}

export default function MenuScreen({ cafeId, categories, menuItems }: MenuScreenProps) {
  // Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Menu Item Form State
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState<number>(0);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemVegType, setItemVegType] = useState<VegType>('veg');
  const [itemGstRate, setItemGstRate] = useState<number>(5);
  const [itemHsnCode, setItemHsnCode] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');
  const [csvError, setCsvError] = useState('');

  // 1. CRUD Category actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const catId = editingCatId || `cat_${Date.now()}`;
      const catRef = doc(db, 'cafes', cafeId, 'categories', catId);
      await setDoc(catRef, {
        id: catId,
        name: newCatName.trim(),
        sort_order: categories.length + 1,
        icon: 'Coffee'
      });
      setNewCatName('');
      setEditingCatId(null);
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Any items in this category will remain, but lose their classification.')) return;
    try {
      await deleteDoc(doc(db, 'cafes', cafeId, 'categories', id));
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  // 2. CRUD Menu Item actions
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCategoryId) {
      alert('Please fill out the name and category fields.');
      return;
    }

    try {
      const itemId = editingItemId || `item_${Date.now()}`;
      const itemRef = doc(db, 'cafes', cafeId, 'menu_items', itemId);
      
      const itemData: any = {
        id: itemId,
        category_id: itemCategoryId,
        name: itemName.trim(),
        price: Number(itemPrice),
        is_veg: itemVegType === 'veg',
        veg_type: itemVegType,
        gst_rate: Number(itemGstRate),
        hsn_code: itemHsnCode.trim() || '2101',
        is_available: true,
        notes: itemNotes.trim(),
        created_at: new Date().toISOString()
      };

      await setDoc(itemRef, itemData);

      // Reset
      setItemName('');
      setItemPrice(0);
      setItemCategoryId('');
      setItemVegType('veg');
      setItemGstRate(5);
      setItemHsnCode('');
      setItemNotes('');
      setEditingItemId(null);
    } catch (err) {
      console.error('Error saving menu item:', err);
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemPrice(item.price);
    setItemCategoryId(item.category_id);
    setItemVegType(item.veg_type);
    setItemGstRate(item.gst_rate);
    setItemHsnCode(item.hsn_code);
    setItemNotes(item.notes);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await deleteDoc(doc(db, 'cafes', cafeId, 'menu_items', id));
    } catch (err) {
      console.error('Error deleting menu item:', err);
    }
  };

  // 3. Client-side CSV Importer Parse engine
  const handleCsvImport = async () => {
    setCsvSuccess('');
    setCsvError('');

    if (!csvText.trim()) {
      setCsvError('Please paste some CSV data or enter some values.');
      return;
    }

    try {
      const lines = csvText.split('\n');
      let count = 0;

      // Extract headers from line 1
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      // Let's check matching columns
      // Expected headers: category, name, price, is_veg, is_available, gst_rate, hsn_code, notes
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Splitting on commas but respecting double quotes
        const values: string[] = [];
        let currentVal = '';
        let insideQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(currentVal.trim());
            currentVal = '';
          } else {
            currentVal += char;
          }
        }
        values.push(currentVal.trim());

        if (values.length < 3) continue;

        // Extracting fields or map indices
        const catName = values[0] || 'Uncategorized';
        const name = values[1] || 'Imported Item';
        const price = Number(values[2]) || 0;
        const vegVal = (values[3] || 'veg').toLowerCase();
        const available = values[4] ? (values[4].toLowerCase() !== 'false') : true;
        const gst = Number(values[5]) || 5;
        const hsn = values[6] || '2106';
        const notes = values[7] || '';

        // Match category name to existing or create a new category
        let category = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        let catId = '';
        
        if (!category) {
          // Create new Category
          catId = `cat_${Date.now()}_${Math.floor(Math.random() * 100)}`;
          const newCatRef = doc(db, 'cafes', cafeId, 'categories', catId);
          await setDoc(newCatRef, {
            id: catId,
            name: catName,
            sort_order: categories.length + 1 + count,
            icon: 'Coffee'
          });
          category = { id: catId, name: catName, sort_order: categories.length + 1, icon: 'Coffee' };
        } else {
          catId = category.id;
        }

        // Determine FSSAI Type
        let fssaiType: VegType = 'veg';
        if (vegVal === 'nonveg' || vegVal === 'red' || vegVal === 'false') {
          fssaiType = 'nonveg';
        } else if (vegVal === 'egg' || vegVal === 'yellow') {
          fssaiType = 'egg';
        }

        const itemId = `item_${Date.now()}_${count}_${Math.floor(Math.random() * 100)}`;
        const itemRef = doc(db, 'cafes', cafeId, 'menu_items', itemId);

        await setDoc(itemRef, {
          id: itemId,
          category_id: catId,
          name: name,
          price: price,
          is_veg: fssaiType === 'veg',
          veg_type: fssaiType,
          gst_rate: gst,
          hsn_code: hsn,
          is_available: available,
          notes: notes,
          created_at: new Date().toISOString()
        });

        count++;
      }

      setCsvSuccess(`Successfully imported ${count} menu items and created relevant categories!`);
      setCsvText('');
    } catch (err: any) {
      console.error(err);
      setCsvError(`Failed to parse CSV: ${err.message || String(err)}`);
    }
  };

  return (
    <div id="menu-screen" className="space-y-6">
      
      {/* Upper Category and CSV Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CATEGORIES CRUD PANEL (4/12 columns) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2">
              <FolderHeart className="w-4 h-4 text-amber-600" />
              Manage Categories
            </h4>
            <p className="text-xs text-slate-400 mb-4">Classify menu cards for visual POS layout filters.</p>
            
            <form onSubmit={handleSaveCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Category Name e.g. Hot Coffee"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 shrink-0"
              >
                {editingCatId ? 'Save' : 'Add'}
              </button>
            </form>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium">
                  <span className="text-slate-800">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingCatId(cat.id); setNewCatName(cat.name); }}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CSV BULK IMPORTER (8/12 columns) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              CSV Bulk Menu Import
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Paste standard comma-separated lines. Expected order: <code className="bg-slate-100 p-0.5 rounded font-mono text-[10px] text-amber-700">category, name, price, veg_type (veg/egg/nonveg), is_available, gst_rate, hsn_code, notes</code>
            </p>

            {csvSuccess && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs mb-3">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{csvSuccess}</span>
              </div>
            )}
            {csvError && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs mb-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{csvError}</span>
              </div>
            )}

            <textarea
              rows={4}
              placeholder="Hot Coffee, Espresso, 120, veg, true, 5, 2101, Standard hot shot&#10;Cold Beverages, Iced Latte, 160, veg, true, 5, 2101, Espresso with chilled milk and ice"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
            <span className="text-[10px] text-slate-400">Lines will create categories dynamically if not found.</span>
            <button
              onClick={handleCsvImport}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              Start Bulk Import
            </button>
          </div>
        </div>

      </div>

      {/* LOWER PANEL: Menu Items CRUD & Catalog Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ITEM FORM (4/12 columns) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-amber-600" />
            {editingItemId ? 'Edit Recipe' : 'Add Recipe Item'}
          </h4>

          <form onSubmit={handleSaveMenuItem} className="space-y-3.5 text-xs text-slate-600">
            <div>
              <label className="block font-semibold mb-1">Item Name *</label>
              <input
                type="text"
                placeholder="e.g. Mocha Latte"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Base Price (excluding GST) *</label>
                <input
                  type="number"
                  placeholder="e.g. 180"
                  required
                  value={itemPrice || ''}
                  onChange={(e) => setItemPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Category *</label>
                <select
                  required
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">FSSAI Classification</label>
                <select
                  value={itemVegType}
                  onChange={(e) => setItemVegType(e.target.value as VegType)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
                >
                  <option value="veg">Veg (Green)</option>
                  <option value="egg">Egg (Yellow)</option>
                  <option value="nonveg">Non-Veg (Red)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">GST Rate %</label>
                <select
                  value={itemGstRate}
                  onChange={(e) => setItemGstRate(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
                >
                  <option value="5">5% (Cafe Food)</option>
                  <option value="12">12% (Beverages)</option>
                  <option value="18">18% (Luxury Chocolates)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">HSN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 2101"
                  value={itemHsnCode}
                  onChange={(e) => setItemHsnCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Preparation Description</label>
                <input
                  type="text"
                  placeholder="Notes for cashiers/clients"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm"
              >
                {editingItemId ? 'Save Changes' : 'Add Item'}
              </button>
              {editingItemId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemId(null);
                    setItemName('');
                    setItemPrice(0);
                    setItemCategoryId('');
                    setItemVegType('veg');
                    setItemGstRate(5);
                    setItemHsnCode('');
                    setItemNotes('');
                  }}
                  className="px-3.5 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* CATALOG LIST (8/12 columns) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Active Menu Catalog</h4>
                <p className="text-xs text-slate-400">List of all items sold at checkout.</p>
              </div>
              <ShoppingBag className="w-5 h-5 text-slate-400" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="py-2.5">Classification</th>
                    <th className="py-2.5">Item Name</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5 font-mono">Price</th>
                    <th className="py-2.5 font-mono">GST %</th>
                    <th className="py-2.5 font-mono">HSN</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {menuItems.map((item) => {
                    const catName = categories.find(c => c.id === item.category_id)?.name || 'Uncategorized';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            {/* FSSAI badge */}
                            <div className={`w-3.5 h-3.5 border flex items-center justify-center p-0.5 rounded ${
                              item.veg_type === 'veg' ? 'border-emerald-600' : 
                              item.veg_type === 'egg' ? 'border-amber-500' : 'border-red-500'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                item.veg_type === 'veg' ? 'bg-emerald-600' : 
                                item.veg_type === 'egg' ? 'bg-amber-500' : 'bg-red-500'
                              }`} />
                            </div>
                            <span className="capitalize text-[10px]">{item.veg_type}</span>
                          </div>
                        </td>
                        <td className="py-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="py-2.5 text-slate-500">{catName}</td>
                        <td className="py-2.5 font-mono font-semibold text-slate-800">{item.price.toFixed(2)}</td>
                        <td className="py-2.5 font-mono text-slate-500">{item.gst_rate}%</td>
                        <td className="py-2.5 font-mono text-slate-400">{item.hsn_code}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-slate-400 hover:text-slate-700 p-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {menuItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No recipe items found. Add items above or trigger bulk CSV import.
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
