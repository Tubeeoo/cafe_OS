import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  Cafe, 
  Staff, 
  Category, 
  MenuItem, 
  Table, 
  Order, 
  Expense, 
  InventoryItem, 
  Shift, 
  UserRole 
} from './types';

// Components
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import POSScreen from './components/POSScreen';
import MenuScreen from './components/MenuScreen';
import TableScreen from './components/TableScreen';
import ShiftsScreen from './components/ShiftsScreen';
import AccountingScreen from './components/AccountingScreen';
import InventoryScreen from './components/InventoryScreen';
import QRMenuScreen from './components/QRMenuScreen';
import KitchenScreen from './components/KitchenScreen';
import OrdersScreen from './components/OrdersScreen';
import SettingsScreen from './components/SettingsScreen';

// Modals
import ReceiptModal from './components/ReceiptModal';
import KOTModal from './components/KOTModal';

// Icons
import { 
  Coffee, 
  LayoutDashboard, 
  Receipt, 
  Flame, 
  Sliders, 
  Building, 
  Briefcase, 
  ShieldAlert, 
  LogOut, 
  ChefHat, 
  Percent, 
  LineChart, 
  ShoppingBag, 
  BookOpen, 
  Users,
  Grid,
  Settings
} from 'lucide-react';

export default function App() {
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  // Core synchronized data states
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [syncError, setSyncError] = useState<{ source: string; message: string } | null>(null);

  // Navigation states
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Modal print target IDs
  const [printReceiptId, setPrintReceiptId] = useState<string | null>(null);
  const [printKOTId, setPrintKOTId] = useState<string | null>(null);

  // Check URL query parameters for public QR ordering
  const [qrUrlParams, setQrUrlParams] = useState<{ cafeId: string; tableId: string } | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qCafeId = urlParams.get('cafeId');
    const qTableId = urlParams.get('tableId');
    if (qCafeId && qTableId) {
      setQrUrlParams({ cafeId: qCafeId, tableId: qTableId });
    }
  }, []);

  // 1. Launch a fully populated real demo sandbox
  const handleLaunchDemo = async () => {
    const demoId = 'demo-cafe';
    
    // Clear existing collections for demo-cafe to reset back to seed state
    const collectionsToClear = ['orders', 'categories', 'menu_items', 'tables', 'inventory_items'];
    for (const colName of collectionsToClear) {
      try {
        const colRef = collection(db, 'cafes', demoId, colName);
        const snap = await getDocs(colRef);
        for (const docSnap of snap.docs) {
          // If it's orders, also delete nested items subcollection
          if (colName === 'orders') {
            try {
              const itemsSnap = await getDocs(collection(db, 'cafes', demoId, 'orders', docSnap.id, 'items'));
              for (const itemDoc of itemsSnap.docs) {
                await deleteDoc(doc(db, 'cafes', demoId, 'orders', docSnap.id, 'items', itemDoc.id));
              }
            } catch (innerErr) {
              console.error('Error clearing nested items:', innerErr);
            }
          }
          await deleteDoc(doc(db, 'cafes', demoId, colName, docSnap.id));
        }
      } catch (err) {
        console.error(`Error clearing ${colName} for demo reset:`, err);
      }
    }
    
    // Quick creation of demo cafe documents
    const cafeRef = doc(db, 'cafes', demoId);
    const demoCafe: Cafe = {
      id: demoId,
      name: 'Coffee Lab Demo',
      address: '24 MG Road, Indiranagar, Bangalore',
      phone_1: '+91 98765 43210',
      phone_2: '',
      gstin: '29AAAAA1111A1Z1',
      fssai_license: '12345678901234',
      open_time: '08:00 AM',
      close_time: '11:00 PM',
      logo_url: '',
      receipt_footer: 'Thank you for dining with the Cafe Lab Companion POS!',
      table_count: 6,
      currency: '₹',
      created_at: new Date().toISOString()
    };
    await setDoc(cafeRef, demoCafe);

    // Staff Owner
    const demoStaff: Staff = {
      id: 'demo-cashier',
      authUid: 'demo-cashier',
      name: 'Simran Singh',
      role: 'owner',
      active: true,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'cafes', demoId, 'staff', 'demo-cashier'), demoStaff);

    // Categories
    const demoCats = [
      { id: 'cat_coffee', name: 'Hot Brews', sort_order: 1, icon: 'Coffee' },
      { id: 'cat_beverages', name: 'Cold Mocktails', sort_order: 2, icon: 'IceCream' },
      { id: 'cat_sandwich', name: 'Hot Toasties', sort_order: 3, icon: 'Cookie' },
      { id: 'cat_dessert', name: 'House Bakes', sort_order: 4, icon: 'Cake' }
    ];
    for (const cat of demoCats) {
      await setDoc(doc(db, 'cafes', demoId, 'categories', cat.id), cat);
    }

    // Menu Items
    const demoItems = [
      { id: 'mi_cappuccino', category_id: 'cat_coffee', name: 'Artisan Cappuccino', price: 180, is_veg: true, veg_type: 'veg', gst_rate: 5, hsn_code: '2101', is_available: true, notes: 'Double shot espresso, creamy foam with cocoa dust' },
      { id: 'mi_latte', category_id: 'cat_coffee', name: 'Caramel Macchiato', price: 210, is_veg: true, veg_type: 'veg', gst_rate: 5, hsn_code: '2101', is_available: true, notes: 'Velvety espresso with sweet buttery caramel syrup' },
      { id: 'mi_icetea', category_id: 'cat_beverages', name: 'Peach Iced Tea', price: 140, is_veg: true, veg_type: 'veg', gst_rate: 18, hsn_code: '2202', is_available: true, notes: 'Brewed black tea with cold peach pulp & fresh mint' },
      { id: 'mi_sandwich_v', category_id: 'cat_sandwich', name: 'Triple Cheese Toastie', price: 195, is_veg: true, veg_type: 'veg', gst_rate: 5, hsn_code: '2106', is_available: true, notes: 'Sharp cheddar, mozzarella, and gouda toastie' },
      { id: 'mi_sandwich_nv', category_id: 'cat_sandwich', name: 'Spiced Chicken Club', price: 240, is_veg: false, veg_type: 'nonveg', gst_rate: 5, hsn_code: '2106', is_available: true, notes: 'Shredded chicken tikka, layered fried egg, spicy mayo' },
      { id: 'mi_brownie', category_id: 'cat_dessert', name: 'Sizzling Eggless Brownie', price: 160, is_veg: true, veg_type: 'veg', gst_rate: 18, hsn_code: '1905', is_available: true, notes: 'Served warm with rich dark chocolate fudge syrup' }
    ];
    for (const item of demoItems) {
      await setDoc(doc(db, 'cafes', demoId, 'menu_items', item.id), item);
    }

    // Seating Tables
    for (let i = 1; i <= 6; i++) {
      await setDoc(doc(db, 'cafes', demoId, 'tables', `table_${i}`), {
        id: `table_${i}`,
        label: `Table ${i}`,
        table_number: i,
        capacity: i <= 2 ? 2 : i <= 4 ? 4 : 8,
        status: 'free'
      });
    }

    // Pantry Inventory ingredients
    const demoPantry = [
      { id: 'pantry_milk', name: 'Organic Full Cream Milk', unit: 'ltr', current_stock: 45, min_stock: 15, cost_per_unit: 72 },
      { id: 'pantry_beans', name: 'Premium Arabica Coffee Beans', unit: 'kg', current_stock: 12, min_stock: 4, cost_per_unit: 850 },
      { id: 'pantry_bread', name: 'Sourdough Bread Loaves', unit: 'pcs', current_stock: 8, min_stock: 10, cost_per_unit: 90 }
    ];
    for (const p of demoPantry) {
      await setDoc(doc(db, 'cafes', demoId, 'inventory_items', p.id), p);
    }

    setCafeId(demoId);
    setCurrentUser(demoStaff);
    setRole('owner');
  };

  const handleLoginSuccess = (cid: string, cuser: Staff, crole: UserRole) => {
    setCafeId(cid);
    setCurrentUser(cuser);
    setRole(crole);
  };

  // Realtime Snapshot Synchronizer
  useEffect(() => {
    if (!cafeId) return;

    // A. Cafe profile listener
    const unsubCafe = onSnapshot(
      doc(db, 'cafes', cafeId),
      (snap) => {
        if (snap.exists()) {
          setCafe(snap.data() as Cafe);
        }
      },
      (error) => {
        console.error('Firestore sync error for Cafe profile:', error);
        setSyncError({ source: 'Café Profile', message: error.message || String(error) });
      }
    );

    // B. Categories listener
    const unsubCats = onSnapshot(
      collection(db, 'cafes', cafeId, 'categories'),
      (snap) => {
        setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[]);
      },
      (error) => {
        console.error('Firestore sync error for Categories:', error);
        setSyncError({ source: 'Categories List', message: error.message || String(error) });
      }
    );

    // C. Menu Items listener
    const unsubItems = onSnapshot(
      collection(db, 'cafes', cafeId, 'menu_items'),
      (snap) => {
        setMenuItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuItem[]);
      },
      (error) => {
        console.error('Firestore sync error for Menu Items:', error);
        setSyncError({ source: 'Menu Items', message: error.message || String(error) });
      }
    );

    // D. Physical Seating Tables listener
    const unsubTables = onSnapshot(
      collection(db, 'cafes', cafeId, 'tables'),
      (snap) => {
        setTables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Table[]);
      },
      (error) => {
        console.error('Firestore sync error for Tables:', error);
        setSyncError({ source: 'Tables Mapping', message: error.message || String(error) });
      }
    );

    // E. Orders ledger listener
    const unsubOrders = onSnapshot(
      collection(db, 'cafes', cafeId, 'orders'),
      (snap) => {
        setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
      },
      (error) => {
        console.error('Firestore sync error for Orders:', error);
        setSyncError({ source: 'Orders Ledger', message: error.message || String(error) });
      }
    );

    // F. Expenses ledger listener
    const unsubExpenses = onSnapshot(
      collection(db, 'cafes', cafeId, 'expenses'),
      (snap) => {
        setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[]);
      },
      (error) => {
        console.error('Firestore sync error for Expenses:', error);
        setSyncError({ source: 'Expenses Ledger', message: error.message || String(error) });
      }
    );

    // G. Pantry Inventory listener
    const unsubInventory = onSnapshot(
      collection(db, 'cafes', cafeId, 'inventory_items'),
      (snap) => {
        setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
      },
      (error) => {
        console.error('Firestore sync error for Pantry Inventory:', error);
        setSyncError({ source: 'Pantry Inventory', message: error.message || String(error) });
      }
    );

    // H. Staff directory listener
    const unsubStaff = onSnapshot(
      collection(db, 'cafes', cafeId, 'staff'),
      (snap) => {
        setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[]);
      },
      (error) => {
        console.error('Firestore sync error for Staff directory:', error);
        setSyncError({ source: 'Staff Directory', message: error.message || String(error) });
      }
    );

    // I. Cashier Shifts listener
    const unsubShifts = onSnapshot(
      collection(db, 'cafes', cafeId, 'shifts'),
      (snap) => {
        const allShifts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[];
        setShifts(allShifts);
        const active = allShifts.find(s => s.status === 'open');
        setCurrentShift(active || null);
      },
      (error) => {
        console.error('Firestore sync error for Cashier Shifts:', error);
        setSyncError({ source: 'Cashier Shifts', message: error.message || String(error) });
      }
    );

    return () => {
      unsubCafe();
      unsubCats();
      unsubItems();
      unsubTables();
      unsubOrders();
      unsubExpenses();
      unsubInventory();
      unsubStaff();
      unsubShifts();
    };
  }, [cafeId]);

  // Handle open cashier shifts
  const handleOpenShift = async (openingCash: number) => {
    if (!cafeId || !currentUser) return;
    try {
      const shiftId = `shift_${Date.now()}`;
      const shiftRef = doc(db, 'cafes', cafeId, 'shifts', shiftId);

      const newShift: Shift = {
        id: shiftId,
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        opened_at: new Date().toISOString(),
        opening_cash: openingCash,
        closed_at: '',
        closing_cash: 0,
        sales_cash: 0,
        sales_upi: 0,
        sales_card: 0,
        actual_closing_cash: 0,
        status: 'open'
      };

      await setDoc(shiftRef, newShift);
    } catch (err) {
      console.error('Error opening register shift:', err);
    }
  };

  // Close Register Shift
  const handleCloseShift = async (closingCash: number) => {
    if (!cafeId || !currentShift) return;
    try {
      const shiftRef = doc(db, 'cafes', cafeId, 'shifts', currentShift.id);
      
      // Compile shift sales numbers
      const shiftOrders = orders.filter(o => o.shift_id === currentShift.id && o.status === 'settled');
      const cashSales = shiftOrders.filter(o => o.payment_mode === 'cash').reduce((sum, o) => sum + o.total, 0);
      const upiSales = shiftOrders.filter(o => o.payment_mode === 'upi').reduce((sum, o) => sum + o.total, 0);
      const cardSales = shiftOrders.filter(o => o.payment_mode === 'card').reduce((sum, o) => sum + o.total, 0);

      await updateDoc(shiftRef, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_cash: currentShift.opening_cash + cashSales,
        sales_cash: cashSales,
        sales_upi: upiSales,
        sales_card: cardSales,
        actual_closing_cash: closingCash
      });
    } catch (err) {
      console.error('Error closing register shift:', err);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setCafeId(null);
    setCurrentUser(null);
    setRole(null);
    setActiveTab('pos');
  };

  const handleEditOrder = (orderId: string) => {
    setEditingOrderId(orderId);
    setActiveTab('pos');
  };

  // 2. Handle direct Public QR menu routing
  if (qrUrlParams) {
    return (
      <QRMenuScreen
        cafeId={qrUrlParams.cafeId}
        tableId={qrUrlParams.tableId}
        categories={categories}
        menuItems={menuItems}
      />
    );
  }

  // 3. Render Authentication screen if not logged in
  if (!cafeId || !currentUser || !cafe) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess}
        onSetDemoMode={handleLaunchDemo}
      />
    );
  }

  // Define tab navigation elements
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'cashier'] },
    { id: 'tables', label: 'Tables', icon: Users, roles: ['owner', 'manager', 'cashier'] },
    { id: 'pos', label: 'New Order', icon: Receipt, roles: ['owner', 'manager', 'cashier'] },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, roles: ['owner', 'manager', 'cashier'] },
    { id: 'shifts', label: 'Shifts', icon: Sliders, roles: ['owner', 'manager', 'cashier'] },
    { id: 'menu', label: 'Menu', icon: BookOpen, roles: ['owner', 'manager'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['owner', 'manager'] }
  ];

  const allowedTabs = allTabs.filter(tab => tab.roles.includes(role || 'cashier'));

  const currency = cafe.currency || '₹';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      
      {/* GLOBAL HUB NAVBAR HEADER (no-print) */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md px-6 py-4 flex items-center justify-between flex-wrap gap-4 no-print shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-700 rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-lg border border-amber-600/30">
            CC
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-slate-100">{cafe.name}</h1>
            <span className="text-[10px] text-amber-500 block font-mono font-bold uppercase tracking-widest">ID • CAFE/{cafe.id.toUpperCase()}</span>
          </div>
        </div>

        {/* Tab switcher buttons */}
        <nav className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl">
          {allowedTabs.map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  active ? 'bg-amber-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Cashier stats & Sign out */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-xs font-bold text-slate-200">{currentUser.name}</span>
            <span className="block text-[10px] text-amber-500 uppercase tracking-widest font-extrabold">{role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
            title="Log Out Console"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* COMPONENT BODY */}
      <main className="flex-1 p-6 max-w-full w-full space-y-6 pb-12">
        {syncError && (
          <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-bold shadow-sm no-print">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5 animate-pulse" />
              <div>
                <span className="block font-black uppercase text-[10px] tracking-wider text-red-700">Database Sync Error ({syncError.source})</span>
                <p className="mt-0.5 font-medium">{syncError.message}</p>
                <p className="mt-1 text-[9px] text-red-500 font-mono">Ensure your authenticated staff profile has the required Firestore permissions.</p>
              </div>
            </div>
            <button
              onClick={() => setSyncError(null)}
              className="text-[10px] uppercase font-black tracking-wider px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardScreen 
            orders={orders}
            tables={tables}
            menuItems={menuItems}
            currency={currency}
          />
        )}

        {activeTab === 'pos' && (
          <POSScreen
            cafeId={cafe.id}
            categories={categories}
            menuItems={menuItems}
            tables={tables}
            orders={orders}
            staff={currentUser}
            currentShift={currentShift}
            currency={currency}
            onShowReceipt={(id) => setPrintReceiptId(id)}
            onShowKOT={(id) => setPrintKOTId(id)}
            editingOrderId={editingOrderId}
            onClearEditingOrder={() => setEditingOrderId(null)}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersScreen
            cafeId={cafe.id}
            orders={orders}
            tables={tables}
            currency={currency}
            onEditOrder={handleEditOrder}
            onShowReceipt={(id) => setPrintReceiptId(id)}
            onShowKOT={(id) => setPrintKOTId(id)}
          />
        )}

        {activeTab === 'menu' && (
          <MenuScreen 
            cafeId={cafe.id}
            categories={categories}
            menuItems={menuItems}
            userRole={role}
          />
        )}

        {activeTab === 'tables' && (
          <TableScreen 
            cafeId={cafe.id}
            tables={tables}
            orders={orders}
            onEditOrder={handleEditOrder}
          />
        )}

        {activeTab === 'shifts' && (
          <ShiftsScreen
            cafeId={cafe.id}
            shifts={shifts}
            orders={orders}
            currentShift={currentShift}
            currentUser={currentUser}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
            currency={currency}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            cafeId={cafe.id}
            cafe={cafe}
            tables={tables}
            staff={staff}
          />
        )}
      </main>

      {/* RENDER EMBEDDED MODALS */}
      {printReceiptId && (
        <ReceiptModal
          cafeId={cafe.id}
          orderId={printReceiptId}
          onClose={() => setPrintReceiptId(null)}
          currency={currency}
        />
      )}

      {printKOTId && (
        <KOTModal
          cafeId={cafe.id}
          orderId={printKOTId}
          onClose={() => setPrintKOTId(null)}
        />
      )}

    </div>
  );
}
