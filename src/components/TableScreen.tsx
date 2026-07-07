import React, { useState } from 'react';
import { Table, TableStatus } from '../types';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Trash2, Edit2, QrCode, Copy, Check, Users, Armchair, HelpCircle, AlertCircle } from 'lucide-react';

interface TableScreenProps {
  cafeId: string;
  tables: Table[];
}

export default function TableScreen({ cafeId, tables }: TableScreenProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(4);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  // Reservation Form State
  const [reserveTableId, setReserveTableId] = useState<string | null>(null);
  const [reserveName, setReserveName] = useState('');
  const [reserveTime, setReserveTime] = useState('');

  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // 1. Save or Update Table
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    try {
      const tableId = editingTableId || `table_${Date.now()}`;
      const tableRef = doc(db, 'cafes', cafeId, 'tables', tableId);
      
      const tableData: Table = {
        id: tableId,
        label: newLabel.trim(),
        table_number: tables.length + 1,
        capacity: Number(newCapacity) || 4,
        status: 'free'
      };

      await setDoc(tableRef, tableData);

      setNewLabel('');
      setNewCapacity(4);
      setEditingTableId(null);
    } catch (err) {
      console.error('Error saving table:', err);
    }
  };

  // 2. Change Table Status
  const handleUpdateStatus = async (tableId: string, status: TableStatus) => {
    try {
      const tableRef = doc(db, 'cafes', cafeId, 'tables', tableId);
      const updateData: any = { status };
      if (status !== 'reserved') {
        updateData.reserved_name = '';
        updateData.reserved_time = '';
      }
      await updateDoc(tableRef, updateData);
    } catch (err) {
      console.error('Error updating table status:', err);
    }
  };

  // 3. Save Reservation
  const handleSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserveTableId || !reserveName.trim()) return;

    try {
      const tableRef = doc(db, 'cafes', cafeId, 'tables', reserveTableId);
      await updateDoc(tableRef, {
        status: 'reserved',
        reserved_name: reserveName.trim(),
        reserved_time: reserveTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      setReserveTableId(null);
      setReserveName('');
      setReserveTime('');
    } catch (err) {
      console.error('Error reserving table:', err);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      await deleteDoc(doc(db, 'cafes', cafeId, 'tables', id));
    } catch (err) {
      console.error('Error deleting table:', err);
    }
  };

  // 4. Generate QR Link
  const getQRLink = (tableId: string) => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}?cafeId=${cafeId}&tableId=${tableId}`;
  };

  const handleCopyLink = (tableId: string) => {
    const url = getQRLink(tableId);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTableId(tableId);
      setTimeout(() => setCopiedTableId(null), 2000);
    });
  };

  return (
    <div id="tables-screen" className="space-y-6 animate-fade-in">
      
      {/* Upper Create & Reserve Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CREATE / EDIT TABLE (5/12 columns) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-4 flex items-center gap-1.5">
            <Armchair className="w-4 h-4 text-amber-700" />
            {editingTableId ? 'Edit Table Info' : 'Provision Seating Table'}
          </h4>

          <form onSubmit={handleSaveTable} className="space-y-3.5 text-xs text-slate-600">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-1">Table Label / ID *</label>
              <input
                type="text"
                placeholder="e.g. Table 1, Pool Side 4"
                required
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-1">Max Capacity (Seats) *</label>
              <input
                type="number"
                min="1"
                required
                value={newCapacity || ''}
                onChange={(e) => setNewCapacity(parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-955 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors uppercase tracking-wider text-[11px]"
              >
                {editingTableId ? 'Save changes' : 'Provision Table'}
              </button>
              {editingTableId && (
                <button
                  type="button"
                  onClick={() => { setEditingTableId(null); setNewLabel(''); setNewCapacity(4); }}
                  className="px-3.5 py-2.5 bg-slate-100 text-slate-600 font-semibold border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* RESERVE MODAL / PANEL (7/12 columns) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-700" />
              Manage Reservations
            </h4>
            <p className="text-xs text-slate-400 mb-4 font-medium">Select an unoccupied table and add booking details.</p>

            {reserveTableId ? (
              <form onSubmit={handleSaveReservation} className="space-y-3.5 text-xs text-slate-600">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-1">Patron / Booker Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram Seth"
                      required
                      value={reserveName}
                      onChange={(e) => setReserveName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-1">Time of Booking</label>
                    <input
                      type="text"
                      placeholder="e.g. 07:30 PM"
                      value={reserveTime}
                      onChange={(e) => setReserveTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl transition-colors uppercase tracking-wider text-[11px]"
                  >
                    Confirm Booking
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReserveTableId(null); setReserveName(''); setReserveTime(''); }}
                    className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center h-32">
                <HelpCircle className="w-8 h-8 text-slate-300 stroke-1 mb-1.5 animate-pulse" />
                <p className="font-semibold text-slate-700">Booking Desk Offline</p>
                <p className="text-[10px] text-slate-400 mt-1">Click "Reserve" on any free table card below to open booking sheets.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* LOWER PANEL: Table Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">Physical Tables Layout</h4>
            <p className="text-xs text-slate-400 font-medium">Click actions to swap status or launch public QR menu ordering views.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.sort((a,b) => a.table_number - b.table_number).map((table) => {
            return (
              <div
                key={table.id}
                className={`bg-white p-5 rounded-2xl border-2 shadow-sm flex flex-col justify-between transition-all relative overflow-hidden ${
                  table.status === 'occupied' ? 'border-amber-500/50 ring-4 ring-amber-500/5 bg-amber-50/5' :
                  table.status === 'reserved' ? 'border-blue-500/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Visual Accent bar depending on state */}
                <div className={`absolute top-0 inset-x-0 h-1.5 ${
                  table.status === 'occupied' ? 'bg-amber-500' :
                  table.status === 'reserved' ? 'bg-blue-500' : 'bg-slate-900'
                }`} />

                <div>
                  <div className="flex items-start justify-between gap-1 mb-3">
                    <div>
                      <h5 className="text-sm font-black text-slate-900 uppercase tracking-wide">{table.label}</h5>
                      <span className="text-[10px] text-slate-400 font-bold font-mono flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-amber-500" />
                        CAPACITY: {table.capacity} PAX
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                      table.status === 'occupied' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      table.status === 'reserved' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      {table.status}
                    </span>
                  </div>

                  {/* Reservation display if present */}
                  {table.status === 'reserved' && table.reserved_name && (
                    <div className="bg-blue-50/80 p-2.5 border border-blue-200 rounded-xl text-[10px] text-blue-800 mb-2 font-medium">
                      Booked for <strong className="font-bold text-blue-900">{table.reserved_name}</strong> at <strong className="font-bold text-blue-900">{table.reserved_time}</strong>
                    </div>
                  )}
                </div>

                {/* Operations buttons */}
                <div className="space-y-3 mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {table.status === 'free' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(table.id, 'occupied')}
                          className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Occupied
                        </button>
                        <button
                          onClick={() => setReserveTableId(table.id)}
                          className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Reserve
                        </button>
                      </>
                    )}

                    {table.status !== 'free' && (
                      <button
                        onClick={() => handleUpdateStatus(table.id, 'free')}
                        className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                      >
                        Free Table
                      </button>
                    )}
                  </div>

                  {/* Public QR Link scanner representation */}
                  <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-bold font-mono text-[9px] truncate max-w-[110px]">
                      {getQRLink(table.id)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={getQRLink(table.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                        title="Open Customer QR Menu Ordering page in a new tab"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleCopyLink(table.id)}
                        className="p-1 text-slate-500 hover:text-emerald-700 rounded"
                        title="Copy QR Order Link"
                      >
                        {copiedTableId === table.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
