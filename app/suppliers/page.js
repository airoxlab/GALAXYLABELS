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
  ChevronsRight,
  X,
  Phone,
  Mail,
  MapPin,
  FileText as NtnIcon,
  MessageCircle,
  User,
  DollarSign,
  UserCheck
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
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [showViewSidebar, setShowViewSidebar] = useState(false);

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
    setViewingSupplier(supplier);
    setShowViewSidebar(true);
  }

  function closeViewSidebar() {
    setShowViewSidebar(false);
    setViewingSupplier(null);
  }

  function handleEditFromView() {
    setShowViewSidebar(false);
    setEditingSupplier(viewingSupplier);
    setIsDrawerOpen(true);
    setViewingSupplier(null);
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
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Suppliers
              </h1>
              <p className="text-sm text-neutral-500">
                Manage your supplier database
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
                "shadow-lg shadow-emerald-500/20",
                "hover:from-emerald-600 hover:to-teal-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Suppliers</p>
                <p className="text-xl font-bold text-blue-900">{suppliers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Active</p>
                <p className="text-xl font-bold text-emerald-900">{suppliers.filter(s => s.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl border border-amber-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Payables</p>
                <p className="text-xl font-bold text-amber-900">
                  {formatCurrency(suppliers.reduce((sum, s) => sum + Math.max(0, s.current_balance || 0), 0))}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Inactive</p>
                <p className="text-xl font-bold text-violet-900">{suppliers.filter(s => !s.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
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
              placeholder="Search suppliers by name, mobile, or email..."
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
                    Supplier
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Contact
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Email
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Balance
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
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{supplier.supplier_name}</div>
                          {supplier.contact_person && (
                            <div className="text-xs text-neutral-500">{supplier.contact_person}</div>
                          )}
                          {supplier.ntn && (
                            <div className="text-xs text-neutral-500">NTN: {supplier.ntn}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-700">{supplier.mobile_no || '-'}</div>
                        {supplier.whatsapp_no && (
                          <div className="text-xs text-neutral-500">WA: {supplier.whatsapp_no}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-700">{supplier.email || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "text-sm font-medium",
                          supplier.current_balance > 0
                            ? 'text-red-600'
                            : supplier.current_balance < 0
                            ? 'text-green-600'
                            : 'text-neutral-600'
                        )}>
                          {formatCurrency(supplier.current_balance)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleActive(supplier.id, supplier.is_active)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all",
                            supplier.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          )}
                        >
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            supplier.is_active ? 'bg-green-500' : 'bg-neutral-400'
                          )}></span>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetails(supplier)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit supplier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete supplier"
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

      {/* View Supplier Sidebar */}
      {showViewSidebar && viewingSupplier && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeViewSidebar}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Supplier Details</h2>
              <button
                onClick={closeViewSidebar}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Supplier Name & Status */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">{viewingSupplier.supplier_name}</h3>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                  viewingSupplier.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-100 text-neutral-600'
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    viewingSupplier.is_active ? 'bg-green-500' : 'bg-neutral-400'
                  )}></span>
                  {viewingSupplier.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Balance Card */}
              <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                <div className="text-xs text-neutral-500 mb-1">Current Balance</div>
                <div className={cn(
                  "text-xl font-bold",
                  viewingSupplier.current_balance > 0
                    ? 'text-red-600'
                    : viewingSupplier.current_balance < 0
                    ? 'text-green-600'
                    : 'text-neutral-900'
                )}>
                  {formatCurrency(viewingSupplier.current_balance)}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">
                  {viewingSupplier.current_balance > 0 ? 'Payable' : viewingSupplier.current_balance < 0 ? 'Receivable' : 'Settled'}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Contact Information</h4>

                {viewingSupplier.contact_person && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Contact Person</div>
                      <div className="text-sm text-neutral-900">{viewingSupplier.contact_person}</div>
                    </div>
                  </div>
                )}

                {viewingSupplier.mobile_no && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Mobile</div>
                      <div className="text-sm text-neutral-900">{viewingSupplier.mobile_no}</div>
                    </div>
                  </div>
                )}

                {viewingSupplier.whatsapp_no && (
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">WhatsApp</div>
                      <div className="text-sm text-neutral-900">{viewingSupplier.whatsapp_no}</div>
                    </div>
                  </div>
                )}

                {viewingSupplier.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Email</div>
                      <div className="text-sm text-neutral-900">{viewingSupplier.email}</div>
                    </div>
                  </div>
                )}

                {viewingSupplier.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Address</div>
                      <div className="text-sm text-neutral-900">{viewingSupplier.address}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tax Information */}
              {(viewingSupplier.ntn || viewingSupplier.str) && (
                <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Tax Information</h4>

                  {viewingSupplier.ntn && (
                    <div className="flex items-start gap-3">
                      <NtnIcon className="w-4 h-4 text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-neutral-500">NTN</div>
                        <div className="text-sm text-neutral-900">{viewingSupplier.ntn}</div>
                      </div>
                    </div>
                  )}

                  {viewingSupplier.str && (
                    <div className="flex items-start gap-3">
                      <NtnIcon className="w-4 h-4 text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-neutral-500">STR</div>
                        <div className="text-sm text-neutral-900">{viewingSupplier.str}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {viewingSupplier.notes && (
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">Notes</h4>
                  <p className="text-sm text-neutral-600">{viewingSupplier.notes}</p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-neutral-200 flex gap-2">
              <button
                onClick={handleEditFromView}
                className={cn(
                  "flex-1 py-2.5 rounded-lg font-medium text-sm",
                  "bg-neutral-900 text-white",
                  "hover:bg-neutral-800",
                  "flex items-center justify-center gap-2 transition-colors"
                )}
              >
                <Edit3 className="w-4 h-4" />
                Edit Supplier
              </button>
              <button
                onClick={() => router.push(`/suppliers/${viewingSupplier.id}`)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg font-medium text-sm",
                  "bg-neutral-100 text-neutral-700",
                  "hover:bg-neutral-200",
                  "flex items-center justify-center gap-2 transition-colors"
                )}
              >
                <Eye className="w-4 h-4" />
                Full Details
              </button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
