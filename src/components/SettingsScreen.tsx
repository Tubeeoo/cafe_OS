import React, { useState } from 'react';
import { Cafe, Staff, Shift, UserRole } from '../types';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Building, 
  UserPlus, 
  Lock, 
  Percent, 
  PlusCircle, 
  UserX, 
  Briefcase, 
  Check, 
  HelpCircle, 
  TrendingUp, 
  ShieldAlert,
  Sliders,
  DollarSign
} from 'lucide-react';

interface SettingsScreenProps {
  cafeId: string;
  cafe: Cafe;
  staff: Staff[];
  currentShift: Shift | null;
  currentUser: Staff;
  onOpenShift: (openingCash: number) => void;
  onCloseShift: (closingCash: number) => void;
  currency: string;
}

export default function SettingsScreen({
  cafeId,
  cafe,
  staff,
  currentShift,
  currentUser,
  onOpenShift,
  onCloseShift,
  currency
}: SettingsScreenProps) {
  // Café Settings Form
  const [cafeName, setCafeName] = useState(cafe.name);
  const [cafeAddress, setCafeAddress] = useState(cafe.address);
  const [cafePhone, setCafePhone] = useState(cafe.phone_1);
  const [cafeGstin, setCafeGstin] = useState(cafe.gstin || '');
  const [cafeFssai, setCafeFssai] = useState(cafe.fssai_license || '');
  const [receiptFooter, setReceiptFooter] = useState(cafe.receipt_footer || '');
  const [cafeCurrency, setCafeCurrency] = useState(cafe.currency || '₹');
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Staff member Form
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>('cashier');
  const [staffUid, setStaffUid] = useState(''); // UID can be mapped manually or created
  const [staffSuccess, setStaffSuccess] = useState('');

  // Cashier Drawer Shift opening/closing states
  const [shiftAmount, setShiftAmount] = useState<number>(1000);

  // 1. Save Cafe settings
  const handleSaveCafe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cafeRef = doc(db, 'cafes', cafeId);
      await updateDoc(cafeRef, {
        name: cafeName,
        address: cafeAddress,
        phone_1: cafePhone,
        gstin: cafeGstin,
        fssai_license: cafeFssai,
        receipt_footer: receiptFooter,
        currency: cafeCurrency
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving cafe settings:', err);
    }
  };

  // 2. Add custom staff member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffUid.trim()) {
      alert('Name and System Auth UID are required.');
      return;
    }

    try {
      const staffRef = doc(db, 'cafes', cafeId, 'staff', staffUid.trim());
      await setDoc(staffRef, {
        id: staffUid.trim(),
        authUid: staffUid.trim(),
        name: staffName.trim(),
        role: staffRole,
        active: true,
        created_at: new Date().toISOString()
      });

      setStaffSuccess(`Added ${staffName} as ${staffRole}! They can now log in using their Auth UID.`);
      setStaffName('');
      setStaffEmail('');
      setStaffUid('');
      setTimeout(() => setStaffSuccess(''), 4000);
    } catch (err) {
      console.error('Error adding staff:', err);
    }
  };

  const toggleStaffStatus = async (member: Staff) => {
    if (member.authUid === currentUser.authUid) {
      alert('You cannot deactivate your own profile.');
      return;
    }
    try {
      const staffRef = doc(db, 'cafes', cafeId, 'staff', member.id);
      await updateDoc(staffRef, { active: !member.active });
    } catch (err) {
      console.error('Error toggling staff status:', err);
    }
  };

  return (
    <div id="settings-screen" className="space-y-6">
      
      {/* SHIFTS RECONCILIATION PANEL (100% width Upper) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
              Cashier Drawer Shifts
            </h4>
            <p className="text-xs text-slate-400">Reconcile opening float and cash sales targets before starting checkouts.</p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${currentShift ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {currentShift ? 'Drawer Active' : 'Drawer Closed'}
          </span>
        </div>

        {currentShift ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Active Register Staff</span>
              <span className="text-sm font-extrabold text-slate-800">{currentShift.staff_name}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Opening Float</span>
              <span className="text-sm font-extrabold text-slate-800 font-mono">{currency}{currentShift.opening_cash.toFixed(2)}</span>
            </div>
            
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Closing Cash"
                value={shiftAmount || ''}
                onChange={(e) => setShiftAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono"
              />
              <button
                onClick={() => onCloseShift(shiftAmount)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shrink-0 shadow"
              >
                Close Drawer
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-4 bg-amber-50/50 p-4 border border-amber-100 rounded-xl">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <span className="block text-xs font-bold text-amber-900">Shift Drawer is Currently Locked</span>
                <span className="block text-[11px] text-amber-700">Open register to start auditing POS billing.</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-semibold">{currency}</span>
                <input
                  type="number"
                  placeholder="Opening Float e.g. 2000"
                  value={shiftAmount || ''}
                  onChange={(e) => setShiftAmount(parseFloat(e.target.value) || 0)}
                  className="pl-6 pr-3 py-1.5 w-36 text-xs bg-white border border-slate-200 rounded-lg text-slate-950 font-mono"
                />
              </div>
              <button
                onClick={() => onOpenShift(shiftAmount)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs"
              >
                Open Register
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CAFE GENERAL CONFIG (50% Width) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-amber-600" />
            Edit Café Profile
          </h4>

          {saveSuccess && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-lg text-xs mb-3 font-semibold">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              Settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSaveCafe} className="space-y-3.5 text-xs text-slate-600">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Café Name *</label>
                <input
                  type="text"
                  required
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Primary Phone *</label>
                <input
                  type="text"
                  required
                  value={cafePhone}
                  onChange={(e) => setCafePhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Physical Address *</label>
              <input
                type="text"
                required
                value={cafeAddress}
                onChange={(e) => setCafeAddress(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">GSTIN Tax ID</label>
                <input
                  type="text"
                  placeholder="e.g. 29AAAAA1111A1Z1"
                  value={cafeGstin}
                  onChange={(e) => setCafeGstin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">FSSAI License No.</label>
                <input
                  type="text"
                  placeholder="e.g. 12345678901234"
                  value={cafeFssai}
                  onChange={(e) => setCafeFssai(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Currency Code / Icon</label>
                <input
                  type="text"
                  value={cafeCurrency}
                  onChange={(e) => setCafeCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Receipt Invoice Footer</label>
                <input
                  type="text"
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg mt-2"
            >
              Update Café Configurations
            </button>
          </form>
        </div>

        {/* STAFF & ROLES (50% Width) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-amber-600" />
              Manage Staff & Shifts
            </h4>
            <p className="text-xs text-slate-400 mb-3">Provision new team profiles or edit security access rules.</p>

            {staffSuccess && (
              <div className="flex items-start gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-lg text-xs mb-3">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{staffSuccess}</span>
              </div>
            )}

            {/* Quick Staff Creation form */}
            <form onSubmit={handleAddStaff} className="space-y-3.5 text-xs text-slate-600 border-b border-slate-100 pb-4 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-0.5">Staff Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">System Auth UID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Auth User ID"
                    value={staffUid}
                    onChange={(e) => setStaffUid(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-950 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block font-semibold mb-0.5">Role Authorization</label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as UserRole)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-950"
                  >
                    <option value="owner">Owner (Full Admin)</option>
                    <option value="manager">Manager (Menu & Desk CRUD)</option>
                    <option value="cashier">Cashier (POS Checkout only)</option>
                    <option value="kitchen_staff">Kitchen Staff (KOT viewing)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-xs self-end shadow"
                >
                  Onboard Staff
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Hint: Provision the auth user under Firebase Auth first, copy their UID from the table, and paste it here to assign tenant permissions.
              </p>
            </form>

            {/* List of current staff */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {staff.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{member.name}</span>
                    <span className="block text-[9px] uppercase font-bold text-amber-700 tracking-wide">{member.role}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${member.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {member.active ? 'Active' : 'Suspended'}
                    </span>
                    <button
                      onClick={() => toggleStaffStatus(member)}
                      className={`text-slate-400 p-1 rounded hover:bg-slate-200 transition-colors ${member.authUid === currentUser.authUid ? 'opacity-30 cursor-not-allowed' : ''}`}
                      disabled={member.authUid === currentUser.authUid}
                      title="Toggle Active Status"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
