import React, { useState } from 'react';
import { Category, MenuItem, VegType, UserRole } from '../types';
import { doc, setDoc, deleteDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Trash2, Edit2, Upload, FileSpreadsheet, Sparkles, Check, AlertCircle, ShoppingBag, FolderHeart, FileText, Loader2, ArrowRight } from 'lucide-react';

interface MenuScreenProps {
  cafeId: string;
  categories: Category[];
  menuItems: MenuItem[];
  userRole?: UserRole | null;
}

export default function MenuScreen({ cafeId, categories, menuItems, userRole }: MenuScreenProps) {
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

  // PDF Import State
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [previewItems, setPreviewItems] = useState<{
    tempId: string;
    category: string;
    name: string;
    price: number;
    is_veg: boolean;
    gst_rate: number;
    hsn_code: string;
    notes: string;
  }[]>([]);

  // Category Cleanup tool states
  const [dupGroups, setDupGroups] = useState<{
    name: string;
    survivor: Category;
    duplicates: Category[];
    affectedItemCount: number;
  }[]>([]);
  const [scanAttempted, setScanAttempted] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupSuccess, setCleanupSuccess] = useState('');
  const [cleanupError, setCleanupError] = useState('');

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

  const handleScanDuplicates = () => {
    setCleanupSuccess('');
    setCleanupError('');
    const groups: { [key: string]: Category[] } = {};
    categories.forEach(cat => {
      const norm = cat.name.trim().toLowerCase();
      if (!groups[norm]) {
        groups[norm] = [];
      }
      groups[norm].push(cat);
    });

    const getCategoryAgeScore = (cat: Category) => {
      const match = cat.id.match(/^cat_(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
      if (cat.id.startsWith('cat_') && isNaN(Number(cat.id.substring(4)))) {
        return 0;
      }
      return cat.sort_order * 1000000;
    };

    const detected: {
      name: string;
      survivor: Category;
      duplicates: Category[];
      affectedItemCount: number;
    }[] = [];

    Object.entries(groups).forEach(([name, cats]) => {
      if (cats.length > 1) {
        const sorted = [...cats].sort((a, b) => getCategoryAgeScore(a) - getCategoryAgeScore(b));
        const survivor = sorted[0];
        const duplicates = sorted.slice(1);
        
        // Count affected items
        const duplicateIds = duplicates.map(d => d.id);
        const affectedItems = menuItems.filter(item => duplicateIds.includes(item.category_id));

        detected.push({
          name: cats[0].name, // Keep the original name format of the first one
          survivor,
          duplicates,
          affectedItemCount: affectedItems.length
        });
      }
    });

    setDupGroups(detected);
    setScanAttempted(true);
    if (detected.length === 0) {
      setCleanupSuccess('No duplicate categories found! Your catalog is perfectly clean.');
    }
  };

  const handleCommitCleanup = async () => {
    if (dupGroups.length === 0) return;
    setCleaning(true);
    setCleanupError('');
    setCleanupSuccess('');

    try {
      const batch = writeBatch(db);
      let opsCount = 0;
      
      let totalMergedCats = 0;
      let totalReassignedItems = 0;

      for (const group of dupGroups) {
        const survivorId = group.survivor.id;
        
        for (const dup of group.duplicates) {
          totalMergedCats++;
          
          // Reassign items pointing to this duplicate
          const affectedItems = menuItems.filter(item => item.category_id === dup.id);
          for (const item of affectedItems) {
            const itemRef = doc(db, 'cafes', cafeId, 'menu_items', item.id);
            batch.update(itemRef, { category_id: survivorId });
            totalReassignedItems++;
            opsCount++;
          }

          // Delete the duplicate category
          const catRef = doc(db, 'cafes', cafeId, 'categories', dup.id);
          batch.delete(catRef);
          opsCount++;
        }
      }

      if (opsCount > 0) {
        await batch.commit();
      }

      setCleanupSuccess(`Successfully merged duplicate categories! Merged duplicate groups into their oldest surviving categories and reassigned ${totalReassignedItems} recipes.`);
      setDupGroups([]);
      setScanAttempted(false);
    } catch (err: any) {
      console.error("Cleanup error:", err);
      setCleanupError(`Cleanup failed: ${err.message || String(err)}`);
    } finally {
      setCleaning(false);
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
      let itemId = editingItemId;
      if (!itemId) {
        if (cafeId === 'demo-cafe') {
          const allowedIds = Array.from({ length: 15 }, (_, i) => `item_${i + 1}`);
          const existingIds = menuItems.map(m => m.id);
          const unusedId = allowedIds.find(id => !existingIds.includes(id));
          if (unusedId) {
            itemId = unusedId;
          } else {
            alert('Demo limit reached: A demo café can have at most 15 custom menu items.');
            return;
          }
        } else {
          itemId = `item_${Date.now()}`;
        }
      }
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
  const parseAndImportCsv = async (text: string) => {
    try {
      const lines = text.split('\n');
      let count = 0;
      const localCategories = [...categories];

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
        const catName = (values[0] || 'Uncategorized').trim();
        const name = values[1] || 'Imported Item';
        const price = Number(values[2]) || 0;
        const vegVal = (values[3] || 'veg').toLowerCase();
        const available = values[4] ? (values[4].toLowerCase() !== 'false') : true;
        const gst = Number(values[5]) || 5;
        const hsn = values[6] || '2106';
        const notes = values[7] || '';

        // Match category name to existing or create a new category
        let category = localCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        let catId = '';
        
        if (!category) {
          // Create new Category
          catId = `cat_${Date.now()}_${Math.floor(Math.random() * 100)}`;
          const newCatRef = doc(db, 'cafes', cafeId, 'categories', catId);
          const newCategory = {
            id: catId,
            name: catName,
            sort_order: categories.length + 1 + count,
            icon: 'Coffee'
          };
          await setDoc(newCatRef, newCategory);
          localCategories.push(newCategory);
          category = newCategory;
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

  const handleCsvImport = async () => {
    setCsvSuccess('');
    setCsvError('');

    if (cafeId === 'demo-cafe') {
      setCsvError('Bulk CSV import is disabled in the demo café to prevent data abuse.');
      return;
    }

    if (!csvText.trim()) {
      setCsvError('Please paste some CSV data or enter some values.');
      return;
    }

    await parseAndImportCsv(csvText);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvSuccess('');
    setCsvError('');

    const file = e.target.files?.[0];
    if (!file) return;

    if (cafeId === 'demo-cafe') {
      setCsvError('Bulk CSV import is disabled in the demo café to prevent data abuse.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        await parseAndImportCsv(text);
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read CSV file.');
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  // PDF AI Extraction engine
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (cafeId === 'demo-cafe') {
      setPdfError('PDF import is disabled in the demo café to prevent data abuse.');
      return;
    }

    setPdfLoading(true);
    setPdfError('');
    setPdfSuccess('');
    setPreviewItems([]);

    try {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        throw new Error('Please upload a valid PDF file.');
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = event.target?.result as string;
          const base64Data = result.split(',')[1];

          const response = await fetch('/api/import-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pdfBase64: base64Data }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned error ${response.status}`);
          }

          const data = await response.json();
          if (data && Array.isArray(data.items)) {
            const formatted = data.items.map((item: any, idx: number) => ({
              tempId: `preview_${Date.now()}_${idx}`,
              category: item.category || 'Uncategorized',
              name: item.name || 'New Item',
              price: typeof item.price === 'number' ? item.price : Number(item.price) || 0,
              is_veg: typeof item.is_veg === 'boolean' ? item.is_veg : true,
              gst_rate: typeof item.gst_rate === 'number' ? item.gst_rate : Number(item.gst_rate) || 5,
              hsn_code: item.hsn_code || '2101',
              notes: item.notes || '',
            }));
            setPreviewItems(formatted);
            setPdfSuccess(`PDF processed successfully! Extracted ${formatted.length} items. Please review, edit, and click "Confirm Import" below.`);
          } else {
            throw new Error('Invalid response structure received from PDF analyzer.');
          }
        } catch (err: any) {
          console.error(err);
          setPdfError(err.message || String(err));
        } finally {
          setPdfLoading(false);
        }
      };
      reader.onerror = () => {
        setPdfError('Failed to read the PDF file.');
        setPdfLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setPdfError(err.message || String(err));
      setPdfLoading(false);
    } finally {
      // Reset file input value so user can upload the same file again if desired
      e.target.value = '';
    }
  };

  const handleUpdatePreviewItem = (tempId: string, field: string, value: any) => {
    setPreviewItems(prev => prev.map(item => {
      if (item.tempId === tempId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeletePreviewItem = (tempId: string) => {
    setPreviewItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleConfirmImport = async () => {
    if (cafeId === 'demo-cafe') {
      setPdfError('Bulk import is disabled in the demo café to prevent data abuse.');
      return;
    }

    if (previewItems.length === 0) {
      setPdfError('No items to import.');
      return;
    }

    try {
      setPdfLoading(true);
      setPdfError('');
      setPdfSuccess('');

      let count = 0;
      const localCategories = [...categories];

      for (const item of previewItems) {
        if (!item.name.trim() || !item.category.trim()) continue;

        const catName = item.category.trim();

        // Match category or create one
        let category = localCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        let catId = '';

        if (!category) {
          catId = `cat_${Date.now()}_${Math.floor(Math.random() * 100)}`;
          const newCatRef = doc(db, 'cafes', cafeId, 'categories', catId);
          const newCategory = {
            id: catId,
            name: catName,
            sort_order: categories.length + 1 + count,
            icon: 'Coffee'
          };
          await setDoc(newCatRef, newCategory);
          localCategories.push(newCategory);
          category = newCategory;
        } else {
          catId = category.id;
        }

        const itemId = `item_${Date.now()}_${count}_${Math.floor(Math.random() * 100)}`;
        const itemRef = doc(db, 'cafes', cafeId, 'menu_items', itemId);

        const fssaiType = item.is_veg ? 'veg' : 'nonveg';

        await setDoc(itemRef, {
          id: itemId,
          category_id: catId,
          name: item.name.trim(),
          price: Number(item.price) || 0,
          is_veg: item.is_veg,
          veg_type: fssaiType,
          gst_rate: Number(item.gst_rate) || 5,
          hsn_code: item.hsn_code.trim() || '2101',
          is_available: true,
          notes: item.notes.trim(),
          created_at: new Date().toISOString()
        });

        count++;
      }

      setPdfSuccess(`Successfully imported ${count} menu items from PDF!`);
      setPreviewItems([]);
    } catch (err: any) {
      console.error(err);
      setPdfError(`Failed to save imported items: ${err.message || String(err)}`);
    } finally {
      setPdfLoading(false);
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

            {/* Cleanup Tool for Owners/Managers */}
            {(userRole === 'owner' || userRole === 'manager') && (
              <div className="border-t border-slate-100 pt-4 mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Maintenance</span>
                  <button
                    onClick={handleScanDuplicates}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Scan Duplicates
                  </button>
                </div>

                {cleanupSuccess && (
                  <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg font-medium">
                    {cleanupSuccess}
                  </p>
                )}
                {cleanupError && (
                  <p className="text-[10px] text-red-700 bg-red-50 border border-red-100 p-2 rounded-lg font-medium">
                    {cleanupError}
                  </p>
                )}

                {dupGroups.length > 0 && (
                  <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2 text-[11px]">
                    <p className="font-bold text-amber-800">Duplicate Group Summary:</p>
                    <div className="space-y-1 text-slate-600 max-h-32 overflow-y-auto font-medium">
                      {dupGroups.map((g, idx) => (
                        <div key={idx} className="flex justify-between border-b border-amber-100/30 pb-1">
                          <span>Found {g.duplicates.length + 1} duplicate "{g.name}" categories</span>
                          <span className="text-slate-500 font-mono text-[10px]">merge to 1 ({g.affectedItemCount} recipes)</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleCommitCleanup}
                        disabled={cleaning}
                        className="flex-1 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {cleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Commit Merge'}
                      </button>
                      <button
                        onClick={() => { setDupGroups([]); setScanAttempted(false); }}
                        disabled={cleaning}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CSV & PDF FILE IMPORTERS (8/12 columns) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Menu Import Hub
              </h4>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">CSV or PDF (AI)</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Import entire menu listings in bulk. Choose either standard CSV format or upload a menu PDF for instant AI extraction.
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

            {pdfSuccess && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs mb-3">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{pdfSuccess}</span>
              </div>
            )}
            {pdfError && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs mb-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}

            {/* DUAL FILE UPLOAD GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: CSV Upload */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-5 hover:border-emerald-500 cursor-pointer bg-slate-50/50 hover:bg-emerald-50/10 transition group text-center min-h-[120px]">
                <FileSpreadsheet className="w-7 h-7 text-slate-400 group-hover:text-emerald-500 mb-2 transition-transform group-hover:scale-105" />
                <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">Upload CSV file</span>
                <span className="text-[10px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
                  Imports categories & recipes from standard comma-separated file.
                </span>
                <input type="file" accept=".csv" onChange={handleCsvFileChange} className="hidden" />
              </label>

              {/* Option B: PDF AI Import */}
              <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-5 hover:border-amber-500 cursor-pointer bg-slate-50/50 hover:bg-amber-50/10 transition group text-center min-h-[120px] relative ${pdfLoading ? 'pointer-events-none opacity-60' : ''}`}>
                {pdfLoading ? (
                  <Loader2 className="w-7 h-7 text-amber-500 animate-spin mb-2" />
                ) : (
                  <Sparkles className="w-7 h-7 text-slate-400 group-hover:text-amber-500 mb-2 transition-transform group-hover:scale-105" />
                )}
                <span className="text-xs font-bold text-slate-700 group-hover:text-amber-700">Import from PDF</span>
                <span className="text-[10px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
                  {pdfLoading ? 'Analyzing menu via Gemini...' : 'AI reads, categorizes, and extracts items from a menu image or PDF.'}
                </span>
                <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" disabled={pdfLoading} />
              </label>
            </div>
          </div>

          {/* MANUAL TEXTAREA FALLBACK BELOW IT */}
          <div className="border-t border-slate-100 pt-3.5 mt-4">
            <details className="group">
              <summary className="flex items-center justify-between text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-900 select-none">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-slate-400 group-open:rotate-90 transition-transform" />
                  Or paste CSV data manually (legacy fallback)
                </span>
                <span className="text-[10px] font-medium text-slate-400">Expand</span>
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-[10px] text-slate-400 font-medium">
                  Expected order: <code className="bg-slate-100 p-0.5 rounded font-mono text-[10px] text-amber-700">category, name, price, veg_type (veg/egg/nonveg), is_available, gst_rate, hsn_code, notes</code>
                </p>
                <textarea
                  rows={3}
                  placeholder="Hot Coffee, Espresso, 120, veg, true, 5, 2101, Standard hot shot&#10;Cold Beverages, Iced Latte, 160, veg, true, 5, 2101, Espresso with chilled milk and ice"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Lines will create categories dynamically if not found.</span>
                  <button
                    onClick={handleCsvImport}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Start Manual Import
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>

      </div>

      {/* Extracted PDF Menu Items Review/Preview Table */}
      {previewItems.length > 0 && (
        <div id="pdf-preview-panel" className="bg-amber-50/30 border border-amber-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-amber-200 pb-3 gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                Review AI Extracted Menu Items
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                AI extracted the following items. Please verify and correct categories, names, and prices before saving to the menu.
              </p>
            </div>
            <div className="flex gap-2 self-end sm:self-auto">
              <button
                onClick={() => setPreviewItems([])}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Clear All
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={pdfLoading}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                {pdfLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Confirm & Import {previewItems.length} Items
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[350px] overflow-y-auto bg-white rounded-lg border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                  <th className="p-3 w-1/4">Category *</th>
                  <th className="p-3 w-1/4">Item Name *</th>
                  <th className="p-3 w-20">Price (₹) *</th>
                  <th className="p-3 w-28">Type</th>
                  <th className="p-3 w-24">GST %</th>
                  <th className="p-3 w-24">HSN</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {previewItems.map((item) => (
                  <tr key={item.tempId} className="hover:bg-slate-50/50">
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.category}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'category', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                        placeholder="Category"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-900"
                        placeholder="Item name"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={item.price || ''}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                        placeholder="0.00"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.is_veg ? 'veg' : 'nonveg'}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'is_veg', e.target.value === 'veg')}
                        className="w-full px-1.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="veg">Veg (Green)</option>
                        <option value="nonveg">Non-Veg (Red)</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={item.gst_rate}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'gst_rate', parseInt(e.target.value) || 5)}
                        className="w-full px-1.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="5">5% (Food)</option>
                        <option value="12">12% (Drinks)</option>
                        <option value="18">18% (Luxury)</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.hsn_code}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'hsn_code', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                        placeholder="HSN"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleUpdatePreviewItem(item.tempId, 'notes', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Notes"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDeletePreviewItem(item.tempId)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
