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
  Trash2
} from 'lucide-react';

export default function WarehousesPage() {
  const router = useRouter();
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const [warehouses, setWarehouses] = useState([]);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (warehouse.location && warehouse.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className={cn(
                "p-1.5 rounded-lg transition-all flex-shrink-0",
                "hover:bg-neutral-100"
              )}
            >
              <ChevronLeft className="w-4 h-4 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight">Warehouses</h1>
              <p className="text-[10px] text-neutral-500">Manage your warehouse locations</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium text-xs",
                "bg-neutral-900 text-white",
                "shadow-md shadow-neutral-900/20",
                "hover:bg-neutral-800",
                "transition-all duration-200",
                "flex items-center gap-1.5"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Warehouse
            </button>
          </div>
        </div>

        {/* Search Bar and Stats */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search warehouses by name or location..."
                className={cn(
                  "w-full pl-8 pr-3 py-1.5",
                  "bg-white/80 backdrop-blur-xl border border-neutral-200/60 rounded-lg",
                  "text-xs placeholder:text-neutral-400",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>
          </div>

          {/* Stats */}
          <div className={cn(
            "flex items-center gap-4 px-3 py-1.5",
            "bg-white/80 backdrop-blur-xl rounded-lg",
            "border border-neutral-200/60"
          )}>
            <div className="text-center">
              <div className="text-sm font-semibold text-neutral-900">{warehouses.length}</div>
              <div className="text-[10px] text-neutral-500">Total</div>
            </div>
            <div className="w-px h-6 bg-neutral-200"></div>
            <div className="text-center">
              <div className="text-sm font-semibold text-green-600">
                {warehouses.filter(w => w.is_active).length}
              </div>
              <div className="text-[10px] text-neutral-500">Active</div>
            </div>
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
              <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Warehouse
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
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
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">{warehouse.name}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{warehouse.location || '-'}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => toggleActive(warehouse.id, warehouse.is_active)}
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all",
                            warehouse.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          )}
                        >
                          <span className={cn(
                            "w-1 h-1 rounded-full",
                            warehouse.is_active ? 'bg-green-500' : 'bg-neutral-400'
                          )}></span>
                          {warehouse.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-0">
                          <button
                            onClick={() => handleEdit(warehouse)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Edit warehouse"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(warehouse.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Delete warehouse"
                          >
                            <Trash2 className="w-3 h-3" />
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
    </DashboardLayout>
  );
}
