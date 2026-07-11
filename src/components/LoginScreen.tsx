import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  collection,
  deleteDoc,
  query,
  where,
  collectionGroup,
  getDocs
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
          throw new Error(`Café with handle "${formattedCafeId}" does not exist yet. If you want to register a new café with this handle, please toggle the "Create New Cafe" tab above. Otherwise, you can click the "Launch Demo Sandbox" button at the very top to instantly explore without signing up!`);
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
      if (err && (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('auth/operation-not-allowed')))) {
        setError('Firebase Auth Error: The "Email/Password" sign-in provider is disabled in your Firebase project. To use email signup/login, please enable "Email/Password" under: Firebase Console > Authentication > Sign-in method > Add new provider > Email/Password.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    setInfo('');

    try {
      let formattedCafeId = cafeIdInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      if (isSignUp && !formattedCafeId) {
        throw new Error('Please enter a Café Handle in the field above before continuing with Google Auth.');
      }

      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      if (isSignUp) {
        if (!cafeName.trim()) {
          throw new Error('Café Name is required to register a new cafe.');
        }

        // Check if Cafe exists first
        const cafeDocRef = doc(db, 'cafes', formattedCafeId);
        const cafeSnap = await getDoc(cafeDocRef);
        if (cafeSnap.exists()) {
          throw new Error(`Café with handle "${formattedCafeId}" already exists!`);
        }

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

        // Create Owner Staff record under this Café
        const staffDocRef = doc(db, 'cafes', formattedCafeId, 'staff', user.uid);
        const ownerStaff: Staff = {
          id: user.uid,
          authUid: user.uid,
          name: user.displayName || name.trim() || 'Owner',
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

        // Default menu items
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
        // Sign In logic
        let targetCafeId = formattedCafeId;
        let staffData: Staff | null = null;

        // Auto-discovery logic if no handle entered, or if the entered handle doesn't exist/work
        if (!targetCafeId) {
          // 1. Check if they are already active staff in some café
          try {
            const staffQuery = query(collectionGroup(db, 'staff'), where('authUid', '==', user.uid));
            const staffQuerySnap = await getDocs(staffQuery);
            if (!staffQuerySnap.empty) {
              const firstDoc = staffQuerySnap.docs[0];
              staffData = firstDoc.data() as Staff;
              const refPath = firstDoc.ref.path.split('/');
              if (refPath[0] === 'cafes') {
                targetCafeId = refPath[1];
              }
            }
          } catch (e) {
            console.warn("Staff auto-discovery collection group query failed:", e);
          }

          // 2. If still not found, check if they are invited in some café
          if (!staffData && user.email) {
            try {
              const inviteEmail = user.email.trim().toLowerCase();
              const inviteQuery = query(collectionGroup(db, 'staffInvites'), where('email', '==', inviteEmail));
              const inviteQuerySnap = await getDocs(inviteQuery);
              if (!inviteQuerySnap.empty) {
                const inviteDoc = inviteQuerySnap.docs[0];
                const inviteData = inviteDoc.data();
                const refPath = inviteDoc.ref.path.split('/');
                if (refPath[0] === 'cafes') {
                  targetCafeId = refPath[1];
                  const newStaff: Staff = {
                    id: user.uid,
                    authUid: user.uid,
                    name: inviteData.name || user.displayName || 'Staff Member',
                    role: inviteData.role || 'cashier',
                    active: true,
                    created_at: new Date().toISOString()
                  };
                  const staffDocRef = doc(db, 'cafes', targetCafeId, 'staff', user.uid);
                  await setDoc(staffDocRef, newStaff);
                  await deleteDoc(inviteDoc.ref);
                  staffData = newStaff;
                }
              }
            } catch (e) {
              console.warn("Invite auto-discovery collection group query failed:", e);
            }
          }

          if (!targetCafeId) {
            throw new Error(`Your Google account (${user.email}) is not registered or invited as active staff for any Café. Please enter a Café Handle in the field above to connect.`);
          }
        } else {
          // A Café Handle was specified by the user
          // Let's check if the Café actually exists.
          const cafeDocRef = doc(db, 'cafes', targetCafeId);
          const cafeSnap = await getDoc(cafeDocRef);
          
          if (!cafeSnap.exists()) {
            // The specified café does not exist. Let's see if this user has an invite anyway in some OTHER cafe, 
            // or if we can auto-discover their invite to help them.
            if (user.email) {
              const inviteEmail = user.email.trim().toLowerCase();
              try {
                const inviteQuery = query(collectionGroup(db, 'staffInvites'), where('email', '==', inviteEmail));
                const inviteQuerySnap = await getDocs(inviteQuery);
                if (!inviteQuerySnap.empty) {
                  const inviteDoc = inviteQuerySnap.docs[0];
                  const inviteData = inviteDoc.data();
                  const refPath = inviteDoc.ref.path.split('/');
                  if (refPath[0] === 'cafes') {
                    targetCafeId = refPath[1];
                    const newStaff: Staff = {
                      id: user.uid,
                      authUid: user.uid,
                      name: inviteData.name || user.displayName || 'Staff Member',
                      role: inviteData.role || 'cashier',
                      active: true,
                      created_at: new Date().toISOString()
                    };
                    const staffDocRef = doc(db, 'cafes', targetCafeId, 'staff', user.uid);
                    await setDoc(staffDocRef, newStaff);
                    await deleteDoc(inviteDoc.ref);
                    staffData = newStaff;
                  }
                }
              } catch (e) {
                console.warn("Auto-discovery fallback for non-existent café handle failed:", e);
              }
            }

            // If we still didn't find any targetCafeId or staffData, we throw the original clear error.
            if (!staffData || targetCafeId === formattedCafeId) {
              throw new Error(`Café with handle "${formattedCafeId}" does not exist yet. Toggle the "Create New Cafe" tab above to register a new café with this handle first, or use the "Launch Demo Sandbox" button at the top to explore!`);
            }
          } else {
            // The café exists. Let's check staff document
            const staffDocRef = doc(db, 'cafes', targetCafeId, 'staff', user.uid);
            let staffSnap = await getDoc(staffDocRef);

            if (!staffSnap.exists()) {
              // Check if staff invite exists for this specific café
              if (user.email) {
                const inviteEmail = user.email.trim().toLowerCase();
                const inviteRef = doc(db, 'cafes', targetCafeId, 'staffInvites', inviteEmail);
                const inviteSnap = await getDoc(inviteRef);
                
                if (inviteSnap.exists()) {
                  const inviteData = inviteSnap.data();
                  const newStaff: Staff = {
                    id: user.uid,
                    authUid: user.uid,
                    name: inviteData.name || user.displayName || 'Staff Member',
                    role: inviteData.role || 'cashier',
                    active: true,
                    created_at: new Date().toISOString()
                  };
                  
                  const pathForStaff = `cafes/${targetCafeId}/staff/${user.uid}`;
                  try {
                    await setDoc(staffDocRef, newStaff);
                    await deleteDoc(inviteRef);
                    staffData = newStaff;
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, pathForStaff);
                  }
                }
              }
            } else {
              staffData = staffSnap.data() as Staff;
            }
          }
        }

        // Final checks
        if (!staffData) {
          throw new Error(`Your Google account (${user.email}) is not registered as active staff for Café "${targetCafeId}".`);
        }

        if (!staffData.active) {
          throw new Error('Your staff profile has been deactivated by the administrator.');
        }

        onLoginSuccess(targetCafeId, staffData, staffData.role);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Firebase Auth Error: Google Sign-In is not enabled on this Firebase project. Please enable Google provider under: Firebase Console > Authentication > Sign-in method.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-wider">
              <span className="bg-white px-2.5 text-slate-400">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl border border-slate-200 flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                {isSignUp ? 'Register with Google' : 'Sign In with Google'}
              </>
            )}
          </button>

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
