import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  collection
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Cafe, Staff, UserRole } from '../types';
import { Coffee, KeyRound, Mail, PlusCircle, LogIn, Sparkles, Building, Phone, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLoginSuccess: (cafeId: string, staff: Staff, role: UserRole) => void;
  onSetDemoMode: () => void;
}

export default function LoginScreen({ onLoginSuccess, onSetDemoMode }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Café creation states
  const [cafeName, setCafeName] = useState('');
  const [cafeAddress, setCafeAddress] = useState('');
  const [cafePhone, setCafePhone] = useState('');
  const [cafeIdInput, setCafeIdInput] = useState(''); // e.g. "brew-haven"
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (isSignUp) {
        // Validation
        const formattedCafeId = cafeIdInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (!formattedCafeId) {
          throw new Error('Please enter a valid Café Handle (letters, numbers, hyphens only).');
        }
        if (!cafeName.trim()) {
          throw new Error('Café Name is required.');
        }

        // 1. Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Create Cafe Document
        const cafeDocRef = doc(db, 'cafes', formattedCafeId);
        const newCafe: Cafe = {
          id: formattedCafeId,
          name: cafeName.trim(),
          address: cafeAddress.trim() || 'Not specified',
          phone_1: cafePhone.trim() || 'Not specified',
          phone_2: '',
          gstin: '',
          fssai_license: '',
          open_time: '09:00 AM',
          close_time: '11:00 PM',
          logo_url: '',
          receipt_footer: 'Thank you for dining with us! Come back soon.',
          table_count: 8,
          currency: '₹',
          created_at: new Date().toISOString()
        };

        const pathForCafe = `cafes/${formattedCafeId}`;
        try {
          await setDoc(cafeDocRef, newCafe);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, pathForCafe);
        }

        // 3. Create Owner Staff record under this Café
        const staffDocRef = doc(db, 'cafes', formattedCafeId, 'staff', user.uid);
        const ownerStaff: Staff = {
          id: user.uid,
          authUid: user.uid,
          name: name.trim() || 'Owner',
          role: 'owner',
          active: true,
          created_at: new Date().toISOString()
        };

        const pathForStaff = `${pathForCafe}/staff/${user.uid}`;
        try {
          await setDoc(staffDocRef, ownerStaff);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, pathForStaff);
        }

        // Initialize default categories and tables for a fast start
        const defaultCats = [
          { id: 'hot-coffee', name: 'Hot Coffee', sort_order: 1, icon: 'Coffee' },
          { id: 'cold-beverages', name: 'Cold Beverages', sort_order: 2, icon: 'IceCream' },
          { id: 'snacks', name: 'Snacks & Bites', sort_order: 3, icon: 'Cookie' },
          { id: 'desserts', name: 'Desserts', sort_order: 4, icon: 'Cake' }
        ];

        for (const cat of defaultCats) {
          await setDoc(doc(db, 'cafes', formattedCafeId, 'categories', cat.id), cat);
        }

        // Default menu items to get them started right away
        const defaultItems = [
          { category_id: 'hot-coffee', name: 'Cappuccino', price: 180, is_veg: true, veg_type: 'veg', gst_rate: 5, hsn_code: '2101', is_available: true, notes: 'Classic Italian espresso with frothy milk', created_at: new Date().toISOString() },
          { category_id: 'hot-coffee', name: 'Cafe Latte', price: 190, is_veg: true, veg_type: 'veg', gst_rate: 5, hsn_code: '2101', is_available: true, notes: 'Rich espresso with steamed milk and light foam', created_at: new Date().toISOString() },
          { category_id: 'snacks', name: 'Paneer Tikka Sandwich', price: 220, is_veg: true, veg_type: 'veg', gst_rate: 5, hsn_code: '2106', is_available: true, notes: 'Spicy paneer tikka with green chutney', created_at: new Date().toISOString() },
          { category_id: 'snacks', name: 'Chicken Club Sandwich', price: 260, is_veg: false, veg_type: 'nonveg', gst_rate: 5, hsn_code: '2106', is_available: true, notes: 'Grilled chicken, eggs, lettuce, and mayo', created_at: new Date().toISOString() },
          { category_id: 'desserts', name: 'Warm Chocolate Brownie', price: 150, is_veg: false, veg_type: 'egg', gst_rate: 18, hsn_code: '1905', is_available: true, notes: 'Decadent brownie served warm', created_at: new Date().toISOString() }
        ];

        for (const [idx, item] of defaultItems.entries()) {
          const itemId = `item_${idx + 1}`;
          await setDoc(doc(db, 'cafes', formattedCafeId, 'menu_items', itemId), item);
        }

        // Create 6 physical tables
        for (let i = 1; i <= 6; i++) {
          const tableId = `table_${i}`;
          await setDoc(doc(db, 'cafes', formattedCafeId, 'tables', tableId), {
            id: tableId,
            label: `Table ${i}`,
            table_number: i,
            capacity: i <= 2 ? 2 : i <= 5 ? 4 : 8,
            status: 'free'
          });
        }

        onLoginSuccess(formattedCafeId, ownerStaff, 'owner');
      } else {
        // Regular Log In
        const formattedCafeId = cafeIdInput.trim().toLowerCase();
        if (!formattedCafeId) {
          throw new Error('Please enter your Café Handle.');
        }

        // Demo credentials bypass to instantly boot into demo sandbox
        if (formattedCafeId === 'demo-cafe' && (email.trim().toLowerCase() === 'demo@cafe.com' || email.trim().toLowerCase() === 'demo@example.com') && password === 'password123') {
          onSetDemoMode();
          return;
        }

        // Check if Cafe exists first
        const cafeSnap = await getDoc(doc(db, 'cafes', formattedCafeId));
        if (!cafeSnap.exists()) {
          throw new Error(`Café with handle "${formattedCafeId}" does not exist. Create a new one instead!`);
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch Staff document
        const staffSnap = await getDoc(doc(db, 'cafes', formattedCafeId, 'staff', user.uid));
        if (!staffSnap.exists()) {
          // If staff document doesn't exist, create a default one for this user if they are the creator or let's throw
          // Let's create a cashier profile as fallback or throw error
          throw new Error('Your account is not registered as active staff for this Café.');
        }

        const staffData = staffSnap.data() as Staff;
        if (!staffData.active) {
          throw new Error('Your staff profile has been deactivated by the administrator.');
        }

        onLoginSuccess(formattedCafeId, staffData, staffData.role);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-50 animate-fade-in text-slate-700">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Upper Brand panel */}
        <div className="bg-slate-900 text-white p-7 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-at-t from-amber-700/25 via-transparent to-transparent opacity-50"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 mb-3.5">
              <Coffee className="w-6 h-6 stroke-[2]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest text-white">Café Companion</h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1.5 font-mono">Multi-Tenant Billing & Real-time POS</p>
          </div>
        </div>

        {/* Demo Mode Instant Onboarding Indicator */}
        <div className="bg-amber-50/50 border-b border-amber-100 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Quick Demo Sandbox</span>
          </div>
          <button 
            onClick={onSetDemoMode}
            className="text-[10px] px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-extrabold rounded-lg transition-all uppercase tracking-wider"
          >
            Launch Demo Sandbox
          </button>
        </div>

        <div className="p-6">
          {/* Sign Up / Log In toggler */}
          <div className="flex bg-slate-50 p-1 rounded-xl mb-6 border border-slate-200">
            <button
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${!isSignUp ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-900'}`}
            >
              Sign In to Cafe
            </button>
            <button
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${isSignUp ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-900'}`}
            >
              Create New Cafe
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Cafe handle field */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Café Handle (ID Scope) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs font-bold font-mono select-none">
                  cafe/
                </span>
                <input
                  type="text"
                  required
                  placeholder={isSignUp ? "espresso-hub" : "coffee-corner"}
                  value={cafeIdInput}
                  onChange={(e) => setCafeIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  className="w-full pl-14 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-950 font-mono font-bold"
                />
              </div>
              <p className="text-[9px] text-slate-400 mt-1 font-semibold font-mono uppercase tracking-wide">
                Used to isolate your café database partition.
              </p>
            </div>

            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl"
              >
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-amber-700" />
                  Café Profile Details
                </h3>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Café Name *
                  </label>
                  <input
                    type="text"
                    required={isSignUp}
                    placeholder="e.g. The Espresso Hub"
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-950 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Contact Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={cafePhone}
                        onChange={(e) => setCafePhone(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-950"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Address / City
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Bangalore"
                        value={cafeAddress}
                        onChange={(e) => setCafeAddress(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-950"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required={isSignUp}
                  placeholder="e.g. Vikram Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-950 font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-950 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Password *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-950"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 mt-4 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : isSignUp ? (
                <>
                  <PlusCircle className="w-4 h-4 text-amber-500" />
                  Register Cafe & Owner Profile
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-amber-500" />
                  Launch POS Console
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center space-y-3">
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-left">
              <span className="block text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">
                Demo Account Credentials:
              </span>
              <div className="text-[10px] font-mono text-slate-600 space-y-0.5">
                <div><span className="font-bold text-slate-700">Café Handle:</span> <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-900 font-bold">demo-cafe</code></div>
                <div><span className="font-bold text-slate-700">Email:</span> <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-900 font-bold">demo@cafe.com</code></div>
                <div><span className="font-bold text-slate-700">Password:</span> <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-900 font-bold">password123</code></div>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-semibold font-mono uppercase tracking-wide leading-relaxed">
              Note: To use real email/password signup, enable the 'Email/Password' provider under your Firebase project console.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
