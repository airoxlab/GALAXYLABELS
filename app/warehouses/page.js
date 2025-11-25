'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import WarehouseDrawer from '@/components/warehouses/WarehouseDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Plus,
  Search,
  Warehouse,
  Eye,
  Edit3,
  Trash2,
  X,
  MapPin,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function WarehousesPage() {
  const router = useRouter();
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const [warehouses, setWarehouses] = useState([]);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  async function fetchWarehouses() {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  }

  async function handleSubmit(formData) {
    setIsLoading(true);
    try {
      if (editingWarehouse) {
        const { error } = await supabase
          .from('warehouses')
          .update(formData)
          .eq('id', editingWarehouse.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('warehouses')
          .insert([formData]);

        if (error) throw error;
      }

      // Clear form and reset state
      setEditingWarehouse(null);
      setIsDrawerOpen(false);
      await fetchWarehouses();
      notify.success(editingWarehouse ? 'Warehouse updated successfully!' : 'Warehouse created successfully!');
    } catch (error) {
      console.error('Error saving warehouse:', error);
      notify.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAddNew() {
    setEditingWarehouse(null);
    setIsDrawerOpen(true);
  }

  function handleDelete(id) {
    showDeleteConfirm(
      'Delete Warehouse',
      'Are you sure you want to delete this warehouse? This action cannot be undone.',
      async () => {
        try {
          const { error } = await supabase
            .from('warehouses')
            .delete()
            .eq('id', id);

          if (error) throw error;
          notify.success('Warehouse deleted successfully!');
          fetchWarehouses();
        } catch (error) {
          console.error('Error deleting warehouse:', error);
          notify.error(error.message);
        }
      }
    );
  }

  async function toggleActive(id, currentStatus) {
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchWarehouses();
    } catch (error) {
      console.error('Error toggling warehouse status:', error);
      notify.error(error.message);
    }
  }

  function handleEdit(warehouse) {
    setEditingWarehouse(warehouse);
    setIsDrawerOpen(true);
  }

  function handleCancel() {
    setEditingWarehouse(null);
    setIsDrawerOpen(false);
  }

  function handleView(warehouse) {
    setSelectedWarehouse(warehouse);
    setShowViewModal(true);
  }

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (warehouse.location && warehouse.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className={cn(
                "p-2 rounded-lg transition-all flex-shrink-0",
                "hover:bg-neutral-100"
              )}
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Warehouses</h1>
              <p className="text-sm text-neutral-500">Manage your warehouse locations</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
                "shadow-lg shadow-amber-500/20",
                "hover:from-amber-600 hover:to-orange-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Warehouse
            </button>
          </div>
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Warehouses</p>
                <p className="text-xl font-bold text-blue-900">{warehouses.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Warehouse className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Active</p>
                <p className="text-xl font-bold text-emerald-900">{warehouses.filter(w => w.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Inactive</p>
                <p className="text-xl font-bold text-violet-900">{warehouses.filter(w => !w.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search warehouses by name or location..."
              className={cn(
                "w-full pl-10 pr-4 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            />
          </div>
        </div>

        {/* Table */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "overflow-hidden"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Warehouse
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Location
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Status
                  </th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-neutral-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60">
                {filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                          <Warehouse className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 className="text-base font-medium text-neutral-900 mb-1">No warehouses found</h3>
                        <p className="text-sm text-neutral-500">
                          {searchQuery
                            ? 'Try adjusting your search criteria'
                            : 'Get started by adding your first warehouse'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((warehouse) => (
                    <tr key={warehouse.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-neutral-900">{warehouse.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-700">{warehouse.location || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleActive(warehouse.id, warehouse.is_active)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all",
                            warehouse.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          )}
                        >
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            warehouse.is_active ? 'bg-green-500' : 'bg-neutral-400'
                          )}></span>
                          {warehouse.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleView(warehouse)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(warehouse)}
                            className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit warehouse"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(warehouse.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete warehouse"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Warehouse Drawer */}
      <WarehouseDrawer
        isOpen={isDrawerOpen}
        onClose={handleCancel}
        warehouse={editingWarehouse}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={hideConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Warehouse View Modal */}
      {showViewModal && selectedWarehouse && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Warehouse Details</h2>
                    <p className="text-sm text-neutral-500">{selectedWarehouse.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-3">
                    <p className="text-xs text-blue-600 font-medium">Name</p>
                    <p className="text-sm font-semibold text-blue-900">{selectedWarehouse.name}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-600 font-medium">Status</p>
                    <p className="text-sm font-semibold text-emerald-900">
                      {selectedWarehouse.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>

                {selectedWarehouse.location && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-neutral-600 font-medium mb-1">Location</p>
                        <p className="text-sm text-neutral-900">{selectedWarehouse.location}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedWarehouse.description && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 font-medium mb-1">Description</p>
                    <p className="text-sm text-neutral-900">{selectedWarehouse.description}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-4 border-t border-neutral-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-white border border-neutral-200 text-neutral-700",
                    "hover:bg-neutral-50 transition-all"
                  )}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(selectedWarehouse);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
                    "hover:from-amber-600 hover:to-orange-700 transition-all",
                    "flex items-center gap-2"
                  )}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Warehouse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
