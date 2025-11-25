'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CustomerDrawer from '@/components/customers/CustomerDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { supabase } from '@/lib/supabase';
import { exportCustomersToPDF, exportCustomersToExcel } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Plus,
  Search,
  Users,
  Download,
  FileText,
  FileSpreadsheet,
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
  DollarSign,
  UserCheck
} from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const [customers, setCustomers] = useState([]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
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
        fetchCustomers(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchCustomers(uid) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function handleSubmit(formData) {
    if (!userId) return;
    setIsLoading(true);
    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({
            customer_name: formData.customer_name,
            contact_person: formData.contact_person,
            mobile_no: formData.mobile_no,
            whatsapp_no: formData.whatsapp_no,
            email: formData.email,
            address: formData.address,
            ntn: formData.ntn,
            str: formData.str,
            notes: formData.notes,
          })
          .eq('id', editingCustomer.id)
          .eq('user_id', userId);

        if (error) throw error;
        notify.success('Customer updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('customers')
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
          await supabase.from('customer_ledger').insert([
            {
              user_id: userId,
              customer_id: data.id,
              transaction_type: 'opening',
              transaction_date: new Date().toISOString().split('T')[0],
              debit: parseFloat(formData.opening_balance) > 0 ? parseFloat(formData.opening_balance) : 0,
              credit: parseFloat(formData.opening_balance) < 0 ? Math.abs(parseFloat(formData.opening_balance)) : 0,
              balance: parseFloat(formData.opening_balance),
              description: 'Opening Balance',
            },
          ]);
        }

        notify.success('Customer created successfully!');
      }

      setEditingCustomer(null);
      setIsDrawerOpen(false);
      await fetchCustomers(userId);
    } catch (error) {
      console.error('Error saving customer:', error);
      notify.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDelete(id) {
    showDeleteConfirm(
      'Delete Customer',
      'Are you sure you want to delete this customer? This action cannot be undone.',
      async () => {
        if (!userId) return;

        try {
          const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) throw error;
          notify.success('Customer deleted successfully!');
          fetchCustomers(userId);
        } catch (error) {
          console.error('Error deleting customer:', error);
          notify.error(error.message);
        }
      }
    );
  }

  async function toggleActive(id, currentStatus) {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      fetchCustomers(userId);
    } catch (error) {
      console.error('Error toggling customer status:', error);
      notify.error(error.message);
    }
  }

  function handleEdit(customer) {
    setEditingCustomer(customer);
    setIsDrawerOpen(true);
  }

  function handleCancel() {
    setEditingCustomer(null);
    setIsDrawerOpen(false);
  }

  function handleViewDetails(customer) {
    setViewingCustomer(customer);
    setShowViewSidebar(true);
  }

  function closeViewSidebar() {
    setShowViewSidebar(false);
    setViewingCustomer(null);
  }

  function handleEditFromView() {
    setShowViewSidebar(false);
    setEditingCustomer(viewingCustomer);
    setIsDrawerOpen(true);
    setViewingCustomer(null);
  }

  function handleAddNew() {
    setEditingCustomer(null);
    setIsDrawerOpen(true);
  }

  function handleExportPDF() {
    exportCustomersToPDF(filteredCustomers);
    setShowExportMenu(false);
  }

  function handleExportExcel() {
    exportCustomersToExcel(filteredCustomers);
    setShowExportMenu(false);
  }

  const filteredCustomers = customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.contact_person && customer.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (customer.mobile_no && customer.mobile_no.includes(searchQuery)) ||
    (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

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
                Customers
              </h1>
              <p className="text-sm text-neutral-500">
                Manage your customer database
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
                "shadow-lg shadow-blue-500/20",
                "hover:from-blue-600 hover:to-indigo-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>

            {/* Export Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium text-xs",
                  "bg-white border border-neutral-200/60 text-neutral-700",
                  "hover:bg-neutral-50 hover:border-neutral-300",
                  "transition-all duration-200",
                  "flex items-center gap-1.5"
                )}
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className={cn(
                    "absolute right-0 mt-2 w-48 z-20",
                    "bg-white/95 backdrop-blur-xl rounded-xl",
                    "border border-neutral-200/60",
                    "shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
                    "overflow-hidden"
                  )}>
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-red-500" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-500" />
                      Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Customers</p>
                <p className="text-xl font-bold text-blue-900">{customers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Active</p>
                <p className="text-xl font-bold text-emerald-900">{customers.filter(c => c.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl border border-amber-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Receivables</p>
                <p className="text-xl font-bold text-amber-900">
                  {formatCurrency(customers.reduce((sum, c) => sum + Math.max(0, c.current_balance || 0), 0))}
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
                <p className="text-xl font-bold text-violet-900">{customers.filter(c => !c.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
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
              placeholder="Search customers by name, mobile, or email..."
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
                    Customer
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
                {currentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 className="text-base font-medium text-neutral-900 mb-1">No customers found</h3>
                        <p className="text-sm text-neutral-500">
                          {searchQuery
                            ? 'Try adjusting your search criteria'
                            : 'Get started by adding your first customer'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{customer.customer_name}</div>
                          {customer.contact_person && (
                            <div className="text-xs text-neutral-500">{customer.contact_person}</div>
                          )}
                          {customer.ntn && (
                            <div className="text-xs text-neutral-500">NTN: {customer.ntn}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-700">{customer.mobile_no || '-'}</div>
                        {customer.whatsapp_no && (
                          <div className="text-xs text-neutral-500">WA: {customer.whatsapp_no}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-700">{customer.email || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "text-sm font-medium",
                          customer.current_balance > 0
                            ? 'text-red-600'
                            : customer.current_balance < 0
                            ? 'text-green-600'
                            : 'text-neutral-600'
                        )}>
                          {formatCurrency(customer.current_balance)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleActive(customer.id, customer.is_active)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all",
                            customer.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          )}
                        >
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            customer.is_active ? 'bg-green-500' : 'bg-neutral-400'
                          )}></span>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetails(customer)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(customer)}
                            className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit customer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete customer"
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
                Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} results
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

      {/* Customer Drawer */}
      <CustomerDrawer
        isOpen={isDrawerOpen}
        onClose={handleCancel}
        customer={editingCustomer}
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

      {/* View Customer Sidebar */}
      {showViewSidebar && viewingCustomer && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeViewSidebar}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Customer Details</h2>
              <button
                onClick={closeViewSidebar}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Customer Name & Status */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">{viewingCustomer.customer_name}</h3>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                  viewingCustomer.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-100 text-neutral-600'
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    viewingCustomer.is_active ? 'bg-green-500' : 'bg-neutral-400'
                  )}></span>
                  {viewingCustomer.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Balance Card */}
              <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                <div className="text-xs text-neutral-500 mb-1">Current Balance</div>
                <div className={cn(
                  "text-xl font-bold",
                  viewingCustomer.current_balance > 0
                    ? 'text-red-600'
                    : viewingCustomer.current_balance < 0
                    ? 'text-green-600'
                    : 'text-neutral-900'
                )}>
                  {formatCurrency(viewingCustomer.current_balance)}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">
                  {viewingCustomer.current_balance > 0 ? 'Receivable' : viewingCustomer.current_balance < 0 ? 'Payable' : 'Settled'}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Contact Information</h4>

                {viewingCustomer.contact_person && (
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Contact Person</div>
                      <div className="text-sm text-neutral-900">{viewingCustomer.contact_person}</div>
                    </div>
                  </div>
                )}

                {viewingCustomer.mobile_no && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Mobile</div>
                      <div className="text-sm text-neutral-900">{viewingCustomer.mobile_no}</div>
                    </div>
                  </div>
                )}

                {viewingCustomer.whatsapp_no && (
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">WhatsApp</div>
                      <div className="text-sm text-neutral-900">{viewingCustomer.whatsapp_no}</div>
                    </div>
                  </div>
                )}

                {viewingCustomer.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Email</div>
                      <div className="text-sm text-neutral-900">{viewingCustomer.email}</div>
                    </div>
                  </div>
                )}

                {viewingCustomer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-neutral-500">Address</div>
                      <div className="text-sm text-neutral-900">{viewingCustomer.address}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tax Information */}
              {(viewingCustomer.ntn || viewingCustomer.str) && (
                <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Tax Information</h4>

                  {viewingCustomer.ntn && (
                    <div className="flex items-start gap-3">
                      <NtnIcon className="w-4 h-4 text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-neutral-500">NTN</div>
                        <div className="text-sm text-neutral-900">{viewingCustomer.ntn}</div>
                      </div>
                    </div>
                  )}

                  {viewingCustomer.str && (
                    <div className="flex items-start gap-3">
                      <NtnIcon className="w-4 h-4 text-neutral-400 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-neutral-500">STR</div>
                        <div className="text-sm text-neutral-900">{viewingCustomer.str}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {viewingCustomer.notes && (
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">Notes</h4>
                  <p className="text-sm text-neutral-600">{viewingCustomer.notes}</p>
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
                Edit Customer
              </button>
              <button
                onClick={() => router.push(`/customers/${viewingCustomer.id}`)}
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
