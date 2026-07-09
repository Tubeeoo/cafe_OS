export type UserRole = 'owner' | 'manager' | 'cashier' | 'kitchen_staff';

export type VegType = 'veg' | 'egg' | 'nonveg';

export type OrderStatus = 'open' | 'kot_sent' | 'served' | 'settled' | 'void' | 'held';

export type TableStatus = 'free' | 'occupied' | 'reserved';

export interface Cafe {
  id: string;
  name: string;
  address: string;
  phone_1: string;
  phone_2: string;
  gstin: string;
  fssai_license: string;
  open_time: string;
  close_time: string;
  logo_url: string;
  receipt_footer: string;
  table_count: number;
  currency: string;
  created_at: any;
}

export interface Staff {
  id: string;
  authUid: string;
  name: string;
  role: UserRole;
  pinHash?: string;
  active: boolean;
  created_at: any;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  icon: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_veg: boolean;
  veg_type: VegType;
  gst_rate: number;
  hsn_code: string;
  is_available: boolean;
  notes: string;
  created_at: any;
}

export interface Table {
  id: string;
  label: string;
  table_number: number;
  capacity: number;
  status: TableStatus;
  reserved_name?: string;
  reserved_time?: string;
}

export interface Shift {
  id: string;
  staff_id: string;
  staff_name: string;
  opening_cash: number;
  closing_cash?: number;
  opened_at: any;
  closed_at?: any;
  sales_cash?: number;
  sales_upi?: number;
  sales_card?: number;
  actual_closing_cash?: number;
  status: 'open' | 'closed';
}

export interface Order {
  id: string;
  table_id: string;
  table_label: string;
  shift_id: string;
  staff_id: string;
  staff_name: string;
  source: 'staff' | 'qr';
  customer_name?: string;
  status: OrderStatus;
  payment_mode?: 'cash' | 'card' | 'upi';
  payment_timing?: string;
  subtotal: number;
  discount_percent: number;
  round_off: number;
  total: number;
  created_at: any;
  settled_at?: any;
  order_type?: 'dine_in' | 'takeout';
  orderEditHistory?: { timestamp: string; previous_total: number; new_total: number; edited_by: string }[];
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  note?: string;
  veg_type?: VegType; // denormalized for FSSAI indicators on KOT/receipts
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  vendor: string;
  amount: number;
  gst_paid: number;
  notes: string;
  receipt_url?: string;
  created_at: any;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  updated_at: any;
}
