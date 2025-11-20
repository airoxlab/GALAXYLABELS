'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SupplierDrawer from '@/components/suppliers/SupplierDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Plus,
  Search,
  Building2,
  Eye,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

export default function SuppliersPage() {
  const router = useRouter();
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const [suppliers, setSuppliers] = useState([]);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [userId, setUserId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUserId(data.user.id);
        fetchSuppliers(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchSuppliers(uid) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  async function handleSubmit(formData) {
    if (!userId) return;
    setIsLoading(true);
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update({
            supplier_name: formData.supplier_name,
            contact_person: formData.contact_person,
            mobile_no: formData.mobile_no,
            whatsapp_no: formData.whatsapp_no,
            email: formData.email,
            address: formData.address,
            ntn: formData.ntn,
            str: formData.str,
            notes: formData.notes,
          })
          .eq('id', editingSupplier.id)
          .eq('user_id', userId);

        if (error) throw error;
        notify.success('Supplier updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('suppliers')
          .insert([
            {
              ...formData,
              user_id: userId,
              current_balance: parseFloat(formData.opening_balance) || 0,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        if (parseFloat(formData.opening_balance) !== 0) {
          await supabase.from('supplier_ledger').insert([
            {
              user_id: userId,
              supplier_id: data.id,
              transaction_type: 'opening',
              transaction_date: new Date().toISOString().split('T')[0],
              debit: parseFloat(formData.opening_balance) > 0 ? parseFloat(formData.opening_balance) : 0,
              credit: parseFloat(formData.opening_balance) < 0 ? Math.abs(parseFloat(formData.opening_balance)) : 0,
              balance: parseFloat(formData.opening_balance),
              description: 'Opening Balance',
            },
          ]);
        }

        notify.success('Supplier created successfully!');
      }

      setEditingSupplier(null);
      setIsDrawerOpen(false);
      await fetchSuppliers(userId);
    } catch (error) {
      console.error('Error saving supplier:', error);
      notify.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDelete(id) {
    showDeleteConfirm(
      'Delete Supplier',
      'Are you sure you want to delete this supplier? This action cannot be undone.',
      async () => {
        if (!userId) return;

        try {
          const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) throw error;
          notify.success('Supplier deleted successfully!');
          fetchSuppliers(userId);
        } catch (error) {
          console.error('Error deleting supplier:', error);
          notify.error(error.message);
        }
      }
    );
  }

  async function toggleActive(id, currentStatus) {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      fetchSuppliers(userId);
    } catch (error) {
      console.error('Error toggling supplier status:', error);
      notify.error(error.message);
    }
  }

  function handleEdit(supplier) {
    setEditingSupplier(supplier);
    setIsDrawerOpen(true);
  }

  function handleCancel() {
    setEditingSupplier(null);
    setIsDrawerOpen(false);
  }

  function handleViewDetails(supplier) {
    router.push(`/suppliers/${supplier.id}`);
  }

  function handleAddNew() {
    setEditingSupplier(null);
    setIsDrawerOpen(true);
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (supplier.contact_person && supplier.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (supplier.mobile_no && supplier.mobile_no.includes(searchQuery)) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSuppliers = filteredSuppliers.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

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
              <h1 className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight">
                Suppliers
              </h1>
              <p className="text-[10px] text-neutral-500">
                Manage your supplier database
              </p>
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
              Add Supplier
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
                placeholder="Search suppliers by name, mobile, or email..."
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
              <div className="text-sm font-semibold text-neutral-900">{suppliers.length}</div>
              <div className="text-[10px] text-neutral-500">Total</div>
            </div>
            <div className="w-px h-6 bg-neutral-200"></div>
            <div className="text-center">
              <div className="text-sm font-semibold text-green-600">
                {suppliers.filter(s => s.is_active).length}
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
                    Supplier
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Balance
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
                {currentSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                          <Building2 className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 className="text-base font-medium text-neutral-900 mb-1">No suppliers found</h3>
                        <p className="text-sm text-neutral-500">
                          {searchQuery
                            ? 'Try adjusting your search criteria'
                            : 'Get started by adding your first supplier'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-2 py-1.5">
                        <div>
                          <div className="text-[11px] font-medium text-neutral-900">{supplier.supplier_name}</div>
                          {supplier.contact_person && (
                            <div className="text-[9px] text-neutral-400">{supplier.contact_person}</div>
                          )}
                          {supplier.ntn && (
                            <div className="text-[9px] text-neutral-400">NTN: {supplier.ntn}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{supplier.mobile_no || '-'}</div>
                        {supplier.whatsapp_no && (
                          <div className="text-[9px] text-neutral-400">WA: {supplier.whatsapp_no}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{supplier.email || '-'}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn(
                          "text-[11px] font-medium",
                          supplier.current_balance > 0
                            ? 'text-red-600'
                            : supplier.current_balance < 0
                            ? 'text-green-600'
                            : 'text-neutral-600'
                        )}>
                          {formatCurrency(supplier.current_balance)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => toggleActive(supplier.id, supplier.is_active)}
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all",
                            supplier.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          )}
                        >
                          <span className={cn(
                            "w-1 h-1 rounded-full",
                            supplier.is_active ? 'bg-green-500' : 'bg-neutral-400'
                          )}></span>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-0">
                          <button
                            onClick={() => handleViewDetails(supplier)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="View details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Edit supplier"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Delete supplier"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-neutral-200/60 flex items-center justify-between">
              <div className="text-sm text-neutral-500">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredSuppliers.length)} of {filteredSuppliers.length} results
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-neutral-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        currentPage === page
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      )}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === totalPages
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === totalPages
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Supplier Drawer */}
      <SupplierDrawer
        isOpen={isDrawerOpen}
        onClose={handleCancel}
        supplier={editingSupplier}
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
