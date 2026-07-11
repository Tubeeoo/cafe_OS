import React, { useState, useEffect } from 'react';
import { Cafe, Table, Staff, StaffInvite, UserRole } from '../types';
import { 
  Building, 
  MapPin, 
  Phone, 
  FileText, 
  Receipt, 
  Grid, 
  DollarSign, 
  UserCheck, 
  Save, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Users,
  UserPlus,
  Mail,
  Shield,
  Clock
} from 'lucide-react';
import { doc, setDoc, updateDoc, writeBatch, collection, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { motion } from 'motion/react';

interface SettingsScreenProps {
  cafeId: string;
  cafe: Cafe;
  tables: Table[];
  staff: Staff[];
}

export default function SettingsScreen({ cafeId, cafe, tables, staff }: SettingsScreenProps) {
  // Cafe Profile States
  const [name, setName] = useState(cafe.name || '');
  const [logoUrl, setLogoUrl] = useState(cafe.logo_url || '');
  const [address, setAddress] = useState(cafe.address || '');
  const [phone1, setPhone1] = useState(cafe.phone_1 || '');
  const [phone2, setPhone2] = useState(cafe.phone_2 || '');
  const [gstin, setGstin] = useState(cafe.gstin || '');
  const [fssaiLicense, setFssaiLicense] = useState(cafe.fssai_license || '');
  const [receiptFooter, setReceiptFooter] = useState(cafe.receipt_footer || '');
  
  // App-wide Settings States
  const [currency, setCurrency] = useState(cafe.currency || '₹');
  const [staffCanEditMenu, setStaffCanEditMenu] = useState(!!cafe.staffCanEditMenu);
  const [tableCount, setTableCount] = useState(cafe.table_count || tables.length || 6);

  // Staff Management States
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('cashier');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Live Sync Pending Invites
  useEffect(() => {
    if (!cafeId) return;
    const invitesRef = collection(db, 'cafes', cafeId, 'staffInvites');
    const unsub = onSnapshot(invitesRef, (snap) => {
      setInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StaffInvite[]);
    }, (err) => {
      console.error("Failed to sync staff invites:", err);
    });
    return unsub;
  }, [cafeId]);

  // Table Editing States
  const [editingTables, setEditingTables] = useState<Table[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize editing tables from tables prop
  useEffect(() => {
    // Sort tables by table_number to display them in order
    const sorted = [...tables].sort((a, b) => a.table_number - b.table_number);
    setEditingTables(sorted);
  }, [tables]);

  // Sync state if cafe prop updates
  useEffect(() => {
    if (cafe) {
      setName(cafe.name || '');
      setLogoUrl(cafe.logo_url || '');
      setAddress(cafe.address || '');
      setPhone1(cafe.phone_1 || '');
      setPhone2(cafe.phone_2 || '');
      setGstin(cafe.gstin || '');
      setFssaiLicense(cafe.fssai_license || '');
      setReceiptFooter(cafe.receipt_footer || '');
      setCurrency(cafe.currency || '₹');
      setStaffCanEditMenu(!!cafe.staffCanEditMenu);
      setTableCount(cafe.table_count || tables.length || 6);
    }
  }, [cafe]);

  // Handle saving cafe profile and general settings
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const cafeRef = doc(db, 'cafes', cafeId);
      const updatedCafeData = {
        name: name.trim(),
        logo_url: logoUrl.trim(),
        address: address.trim(),
        phone_1: phone1.trim(),
        phone_2: phone2.trim(),
        gstin: gstin.trim().toUpperCase(),
        fssai_license: fssaiLicense.trim(),
        receipt_footer: receiptFooter.trim(),
        currency: currency.trim(),
        staffCanEditMenu: staffCanEditMenu,
        table_count: Number(tableCount)
      };

      await updateDoc(cafeRef, updatedCafeData);
      setSuccessMsg('Café profile and settings updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save café settings.');
    } finally {
      setSaving(false);
    }
  };

  // Quick Table Configuration Actions
  const handleAddTable = () => {
    const nextNum = editingTables.length > 0 
      ? Math.max(...editingTables.map(t => t.table_number)) + 1 
      : 1;
    
    // Prevent adding past rules limits if in demo-cafe
    if (cafeId === 'demo-cafe' && editingTables.length >= 12) {
      setErrorMsg('Demo café is restricted to a maximum of 12 tables.');
      return;
    }

    const newTable: Table = {
      id: `table_${nextNum}`,
      label: `Table ${nextNum}`,
      table_number: nextNum,
      capacity: 4,
      status: 'free'
    };

    setEditingTables([...editingTables, newTable]);
    setTableCount(editingTables.length + 1);
  };

  const handleRemoveTable = (index: number) => {
    const updated = editingTables.filter((_, i) => i !== index);
    setEditingTables(updated);
    setTableCount(updated.length);
  };

  const handleTableChange = (index: number, field: keyof Table, value: any) => {
    const updated = [...editingTables];
    updated[index] = {
      ...updated[index],
      [field]: field === 'capacity' || field === 'table_number' ? Number(value) : value
    };
    setEditingTables(updated);
  };

  // Commit physical seating tables to Firestore database
  const handleSaveTablesConfig = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const batch = writeBatch(db);
      
      // 1. Fetch current tables from Firestore to know which ones to delete
      const currentTablesSnap = await getDocs(collection(db, 'cafes', cafeId, 'tables'));
      const existingIds = currentTablesSnap.docs.map(doc => doc.id);
      const targetIds = editingTables.map(t => t.id);

      // 2. Delete tables that are no longer in our list
      const idsToDelete = existingIds.filter(id => !targetIds.includes(id));
      for (const id of idsToDelete) {
        // Double check demo rules compatibility
        if (cafeId === 'demo-cafe' && !id.match(/^table_([1-9]|1[0-2])$/)) {
          continue; // skip out of bound deletion for safety
        }
        const docRef = doc(db, 'cafes', cafeId, 'tables', id);
        batch.delete(docRef);
      }

      // 3. Set or update remaining tables
      for (const table of editingTables) {
        // Enforce demo rules restrictions: Table IDs must be in standard range table_1 to table_12
        if (cafeId === 'demo-cafe' && !table.id.match(/^table_([1-9]|1[0-2])$/)) {
          throw new Error('Demo café table IDs must be strictly named format "table_1" to "table_12".');
        }
        
        const docRef = doc(db, 'cafes', cafeId, 'tables', table.id);
        batch.set(docRef, {
          id: table.id,
          label: table.label || `Table ${table.table_number}`,
          table_number: table.table_number,
          capacity: table.capacity || 4,
          status: table.status || 'free',
          ...(table.reserved_name ? { reserved_name: table.reserved_name } : {}),
          ...(table.reserved_time ? { reserved_time: table.reserved_time } : {})
        });
      }

      // 4. Update the parent cafe table_count
      const cafeRef = doc(db, 'cafes', cafeId);
      batch.update(cafeRef, { table_count: editingTables.length });

      await batch.commit();
      setTableCount(editingTables.length);
      setSuccessMsg(`Seating table configuration saved! Synced ${editingTables.length} active tables.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save tables configuration. Please check Firestore security rules.');
    } finally {
      setSaving(false);
    }
  };

  // Handle adding staff invite
  const handleAddStaffInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteRole) {
      setInviteError('Please fill in all fields.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(inviteEmail.trim())) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const emailLower = inviteEmail.trim().toLowerCase();
      
      // Check if already invited
      const inviteExists = invites.some(inv => inv.id === emailLower || inv.email === emailLower);
      if (inviteExists) {
        throw new Error(`A pending invitation already exists for "${emailLower}".`);
      }

      const inviteRef = doc(db, 'cafes', cafeId, 'staffInvites', emailLower);
      await setDoc(inviteRef, {
        id: emailLower,
        name: inviteName.trim(),
        email: emailLower,
        role: inviteRole,
        cafeId: cafeId,
        created_at: new Date().toISOString()
      });

      setInviteSuccess(`Successfully invited ${inviteName.trim()} as ${inviteRole}!`);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('cashier');
      setTimeout(() => setInviteSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setInviteError(err.message || 'Failed to send invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  // Handle canceling staff invite
  const handleCancelInvite = async (invite: StaffInvite) => {
    if (!window.confirm(`Are you sure you want to cancel the invitation for ${invite.name}?`)) {
      return;
    }

    try {
      const inviteRef = doc(db, 'cafes', cafeId, 'staffInvites', invite.id);
      await deleteDoc(inviteRef);
      setSuccessMsg(`Successfully cancelled the invitation for ${invite.name}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to cancel invitation.');
    }
  };

  // Handle deleting active staff member
  const handleDeleteStaff = async (staffMember: Staff) => {
    if (staffMember.id === 'demo-cashier' || staffMember.id === 'demo-staff') {
      setErrorMsg('Demo staff members cannot be removed.');
      return;
    }
    
    const currentUid = auth.currentUser?.uid;
    if (staffMember.id === currentUid) {
      setErrorMsg('You cannot delete your own staff profile.');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${staffMember.name} from the staff directory?`)) {
      return;
    }

    try {
      const staffRef = doc(db, 'cafes', cafeId, 'staff', staffMember.id);
      await deleteDoc(staffRef);
      setSuccessMsg(`Successfully removed ${staffMember.name} from the staff directory.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to remove staff member.');
    }
  };

  return (
    <div id="settings-screen" className="space-y-6 max-w-4xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
            <Building className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">Café Settings & Profile</h2>
            <p className="text-xs text-slate-500 font-semibold font-mono uppercase tracking-wide">Configure identity, billing rules, GST, license, and table mapping</p>
          </div>
        </div>
      </div>

      {/* STATUS BANNER */}
      {successMsg && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-bold shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Cafe Profile Form (2/3 size) */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSaveGeneralSettings} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">1. Café Identity & Invoicing</h3>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-amber-500" />
                )}
                Save Changes
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Café Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Logo URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Physical Address *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Primary Contact Phone *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={phone1}
                      onChange={(e) => setPhone1(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Secondary Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={phone2}
                      onChange={(e) => setPhone2(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    GSTIN (GST Identification)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 29AAAAA1111A1Z1"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-mono font-bold"
                  />
                  <p className="text-[9px] text-slate-400 font-medium font-mono uppercase mt-1">Include for tax invoices and reports.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    FSSAI License Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12345678901234"
                    maxLength={14}
                    value={fssaiLicense}
                    onChange={(e) => setFssaiLicense(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-mono font-bold"
                  />
                  <p className="text-[9px] text-slate-400 font-medium font-mono uppercase mt-1">Printed on receipts as food safety standard.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Receipt Footer Memo
                </label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900"
                ></textarea>
                <p className="text-[9px] text-slate-400 font-medium font-mono uppercase mt-1">A warm custom greeting printed at the bottom of customer receipts.</p>
              </div>
            </div>
          </form>

          {/* TABLE MAPPING CONTROL PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">2. Custom Seating Map Layout ({editingTables.length} Tables)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddTable}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Table
                </button>
                <button
                  type="button"
                  onClick={handleSaveTablesConfig}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  Save Map
                </button>
              </div>
            </div>

            <div className="p-5">
              <p className="text-[10px] text-slate-500 font-semibold font-mono uppercase tracking-wide leading-relaxed mb-4">
                Define the tables available for dine-in. These labels sync instantly to physical table status boards, POS checkout lists, and the public QR ordering menu system.
              </p>

              {editingTables.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Grid className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold">No active tables defined in seating layout</p>
                  <button
                    type="button"
                    onClick={handleAddTable}
                    className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                  >
                    Add Your First Table
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-12 gap-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    <div className="col-span-2">Table Number</div>
                    <div className="col-span-4">Table ID / Handle</div>
                    <div className="col-span-3">Label / Display</div>
                    <div className="col-span-2">Capacity</div>
                    <div className="col-span-1 text-center">Delete</div>
                  </div>

                  {editingTables.map((table, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-2 rounded-xl border border-slate-200/60 hover:bg-white hover:border-slate-300 transition-all">
                      {/* Table Number */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          required
                          value={table.table_number || ''}
                          onChange={(e) => handleTableChange(index, 'table_number', e.target.value)}
                          className="w-full p-1.5 text-xs text-center bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                        />
                      </div>

                      {/* Unique Table ID */}
                      <div className="col-span-4">
                        <input
                          type="text"
                          required
                          disabled={cafeId === 'demo-cafe'} // lock standard ids for demo rules
                          value={table.id}
                          onChange={(e) => handleTableChange(index, 'id', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                          className="w-full p-1.5 text-xs bg-slate-200/50 text-slate-500 border border-slate-200 rounded-lg font-mono font-bold"
                          placeholder="e.g. table_1"
                        />
                      </div>

                      {/* Table Label */}
                      <div className="col-span-3">
                        <input
                          type="text"
                          required
                          value={table.label}
                          onChange={(e) => handleTableChange(index, 'label', e.target.value)}
                          className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold"
                          placeholder="e.g. Table 1"
                        />
                      </div>

                      {/* Capacity */}
                      <div className="col-span-2">
                        <select
                          value={table.capacity || 4}
                          onChange={(e) => handleTableChange(index, 'capacity', e.target.value)}
                          className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold"
                        >
                          <option value={2}>2 Pax</option>
                          <option value={4}>4 Pax</option>
                          <option value={6}>6 Pax</option>
                          <option value={8}>8 Pax</option>
                          <option value={10}>10 Pax</option>
                          <option value={12}>12 Pax</option>
                        </select>
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveTable(index)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* STAFF MANAGEMENT & DIRECTORY */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">3. Staff Directory & Management</h3>
              </div>
            </div>

            <div className="p-5 space-y-6">
              
              {/* Add Staff Form Section */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                  <UserPlus className="w-4 h-4 text-amber-600" />
                  <span>Invite New Staff Member</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Enter their details and role. Since authentication is powered by secure Google Sign-In, they will be registered automatically upon their first login matching this invited email.
                </p>

                {inviteError && (
                  <div className="flex items-start gap-1.5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {inviteSuccess && (
                  <div className="flex items-start gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
                    <span>{inviteSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleAddStaffInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Google Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. john@gmail.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Assigned Role</label>
                    <div className="flex gap-2">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                        className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none"
                      >
                        <option value="manager">Manager</option>
                        <option value="cashier">Cashier</option>
                        <option value="kitchen_staff">Kitchen Staff</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isInviting}
                        className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                      >
                        {isInviting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-amber-500" />
                            <span>Invite</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Staff Directories List */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Staff Members ({staff.length})</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-2">
                  {staff.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold py-4 text-center">No active staff members found.</p>
                  ) : (
                    staff.map((member) => {
                      const isSelf = member.id === auth.currentUser?.uid;
                      return (
                        <div key={member.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs uppercase border border-slate-200">
                              {member.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">{member.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[8px] font-black uppercase tracking-wider rounded">You</span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                                <Shield className="w-3 h-3 text-amber-600 animate-pulse" />
                                {member.role}
                              </span>
                            </div>
                          </div>
                          
                          {/* Owner/Managers can remove other staff */}
                          {!isSelf && member.id !== 'demo-cashier' && member.role !== 'owner' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStaff(member)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                              title="Revoke access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pending Invites List */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending Invitations ({invites.length})</span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto pr-2">
                    {invites.length === 0 ? (
                      <p className="text-xs text-slate-400 font-semibold py-4 text-center">No pending invitations.</p>
                    ) : (
                      invites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200/50 flex items-center justify-center text-amber-700">
                              <Mail className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">{invite.name}</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[8px] font-black uppercase tracking-wider rounded font-mono">{invite.role}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {invite.email}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleCancelInvite(invite)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                            title="Cancel invitation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: App-wide Settings & Variables (1/3 size) */}
        <div className="space-y-6">
          
          {/* CURRENCY & ACCESS CONFIG */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">3. System & Currency</h3>
            </div>

            <div className="p-5 space-y-5">
              
              {/* Currency Symbol selection */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Display Currency Symbol</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: '₹', label: 'INR (₹)' },
                    { val: '$', label: 'USD ($)' },
                    { val: '€', label: 'EUR (€)' },
                    { val: '£', label: 'GBP (£)' }
                  ].map((cur) => (
                    <button
                      key={cur.val}
                      type="button"
                      onClick={() => setCurrency(cur.val)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                        currency === cur.val
                          ? 'bg-amber-700 border-amber-700 text-white font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cur.val}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5">
                  <input
                    type="text"
                    placeholder="Custom symbol (e.g. AED)"
                    maxLength={5}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Staff Edit Menu Rule */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-tight">Staff Menu Edits</label>
                    <p className="text-[10px] text-slate-500 font-medium">When active, Cashiers and generic Staff members can create, delete or edit live categories and menu prices.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStaffCanEditMenu(!staffCanEditMenu)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none shrink-0 cursor-pointer ${
                      staffCanEditMenu ? 'bg-amber-700' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        staffCanEditMenu ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* SECURITY AUDIT CHEATSHEET CARD */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-radial-at-t from-amber-700/10 via-transparent to-transparent opacity-50"></div>
            <div className="relative z-10 space-y-3">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-500" />
                Staff Access Matrix
              </h3>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Rules are compiled securely in Firestore security rules. Below is your current active privilege model:
              </p>
              
              <div className="space-y-2 text-[10px] font-mono leading-normal pt-1 divide-y divide-slate-800">
                <div className="pt-2 flex justify-between">
                  <span className="font-semibold text-slate-400">Cashier / Staff:</span>
                  <span className="text-emerald-500">POS, Shifts, Tables, Orders</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="font-semibold text-slate-400">Menu Customizer:</span>
                  <span className="text-amber-500">{staffCanEditMenu ? 'All Staff Allowed' : 'Owners & Managers Only'}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="font-semibold text-slate-400">Expenses / Ledger:</span>
                  <span className="text-rose-500">Owners & Managers Only</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="font-semibold text-slate-400">Inventory Items:</span>
                  <span className="text-emerald-500">Staff (Read Only)</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
