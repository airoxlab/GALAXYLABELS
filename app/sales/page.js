'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import InvoiceViewModal from '@/components/sales/InvoiceViewModal';
import InvoiceEditModal from '@/components/sales/InvoiceEditModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { Eye, Download, Trash2, ChevronLeft, ChevronRight, Edit3, Search, X, FileSpreadsheet, FileText, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { downloadInvoicePDF } from '@/components/sales/InvoicePDF';

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        const userId = data.user.id || data.user.userId;
        fetchSales(userId);
        fetchCustomers(userId);
        fetchSettings(userId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  }

  async function fetchSales(userId) {
    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          customers (
            customer_name,
            mobile_no
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers(userId) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('customer_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function fetchSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }

  function handleDelete(id) {
    showDeleteConfirm(
      'Delete Sale',
      'Are you sure you want to delete this sale? This action cannot be undone.',
      async () => {
        try {
          const { error } = await supabase
            .from('sales_invoices')
            .delete()
            .eq('id', id);

          if (error) throw error;
          notify.success('Sale deleted successfully!');
          if (user) fetchSales(user.id || user.userId);
        } catch (error) {
          console.error('Error deleting sale:', error);
          notify.error('Error: ' + error.message);
        }
      }
    );
  }

  async function handleDownloadPDF(sale) {
    try {
      // Fetch invoice items
      const { data: items, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          products (name)
        `)
        .eq('invoice_id', sale.id);

      if (error) throw error;

      // Format items for PDF
      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.products?.name || 'Unknown Product'
      }));

      await downloadInvoicePDF(sale, formattedItems, settings, { showLogo: true, showQR: true });
      notify.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      notify.error('Error downloading PDF: ' + error.message);
    }
  }

  function handleViewDetails(sale) {
    setSelectedInvoiceId(sale.id);
    setShowViewModal(true);
  }

  function handleEditInvoice(saleId) {
    setSelectedInvoiceId(saleId);
    setShowEditModal(true);
  }

  function handleEditModalSave() {
    setShowEditModal(false);
    setSelectedInvoiceId(null);
    if (user) fetchSales(user.id || user.userId);
  }

  async function handleExportPDF() {
    try {
      const { generateSalesReportPDF } = await import('@/components/sales/InvoicePDF');
      await generateSalesReportPDF(filteredSales, totalAmount);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF: ' + error.message);
    }
  }

  function handleExportExcel() {
    try {
      const excelData = filteredSales.map(sale => ({
        'Invoice #': sale.invoice_no || '-',
        'Customer': sale.customers?.customer_name || '-',
        'Customer Mobile': sale.customers?.mobile_no || '-',
        'Invoice Date': formatDate(sale.invoice_date),
        'Customer PO': sale.customer_po || '-',
        'Subtotal': sale.subtotal || 0,
        'GST Amount': sale.gst_amount || 0,
        'Total Amount': sale.total_amount || 0,
        'Created At': new Date(sale.created_at).toLocaleDateString('en-GB')
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
      XLSX.writeFile(wb, `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel: ' + error.message);
    }
  }

  function handleClearFilters() {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedCustomer('');
    setCurrentPage(1);
  }

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.invoice_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_po?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customers?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate =
      (!startDate || new Date(sale.invoice_date) >= new Date(startDate)) &&
      (!endDate || new Date(sale.invoice_date) <= new Date(endDate));

    const matchesCustomer =
      !selectedCustomer || sale.customer_id === parseInt(selectedCustomer);

    return matchesSearch && matchesDate && matchesCustomer;
  });

  const totalAmount = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0);

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Convert customers to dropdown options
  const customerOptions = [
    { value: '', label: 'All Customers' },
    ...customers.map(c => ({ value: c.id.toString(), label: c.customer_name }))
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">Sales</h1>
            <p className="text-[10px] text-neutral-500">Manage your sales invoices</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5",
                  "bg-white border border-neutral-200 rounded-lg",
                  "text-xs font-medium text-neutral-700",
                  "hover:bg-neutral-50 transition-all"
                )}
              >
                <Download className="w-3 h-3" />
                Export
              </button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className={cn(
                    "absolute right-0 mt-1 w-40",
                    "bg-white",
                    "border border-neutral-200 rounded-lg",
                    "shadow-lg",
                    "z-20 overflow-hidden"
                  )}>
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors border-t border-neutral-100"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={cn(
          "bg-white rounded-lg p-3",
          "border border-neutral-200"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice, customer..."
                className={cn(
                  "w-full pl-8 pr-3 py-1.5",
                  "bg-neutral-50 border border-neutral-200 rounded-lg",
                  "text-xs placeholder:text-neutral-400",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                )}
              />
            </div>

            {/* Customer Dropdown */}
            <div>
              <SearchableDropdown
                options={customerOptions}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                placeholder="All Customers"
                searchPlaceholder="Search customers..."
                allowClear={false}
                className="text-xs"
              />
            </div>

            {/* Start Date */}
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50 border border-neutral-200 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                )}
              />
            </div>

            {/* End Date */}
            <div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50 border border-neutral-200 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                )}
              />
            </div>
          </div>

          {/* Filter Summary */}
          <div className="mt-2 flex justify-between items-center">
            <div className="text-[11px] text-neutral-600">
              Total: <span className="font-semibold text-neutral-900">{formatCurrency(totalAmount)}</span>
              <span className="text-neutral-400 ml-1.5">({filteredSales.length} invoices)</span>
            </div>
            {(searchQuery || selectedCustomer || startDate || endDate) && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={cn(
          "bg-white rounded-lg",
          "border border-neutral-200",
          "overflow-hidden"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Invoice #</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Customer</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Date</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Amount</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {currentSales.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-2 py-8 text-center">
                      <div className="text-neutral-400">
                        <FileText className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
                        <p className="text-xs">No sales found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-neutral-900 text-[11px]">{sale.invoice_no || '-'}</div>
                        {sale.customer_po && (
                          <div className="text-[10px] text-neutral-500">PO: {sale.customer_po}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-neutral-900 text-[11px]">
                          {sale.customers?.customer_name || '-'}
                        </div>
                        {sale.customers?.mobile_no && (
                          <div className="text-[10px] text-neutral-500">{sale.customers.mobile_no}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-700">{formatDate(sale.invoice_date)}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-semibold text-neutral-900 text-[11px]">
                          {formatCurrency(sale.total_amount)}
                        </div>
                        {sale.gst_amount > 0 && (
                          <div className="text-[10px] text-neutral-500">
                            GST: {formatCurrency(sale.gst_amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => handleViewDetails(sale)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="View details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleEditInvoice(sale.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Edit invoice"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(sale)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(sale.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Delete sale"
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
            <div className="border-t border-neutral-200 px-2 py-1.5 flex items-center justify-between bg-neutral-50/50">
              <div className="text-[10px] text-neutral-600">
                {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} of {filteredSales.length}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded transition-all",
                        currentPage === pageNum
                          ? "bg-neutral-900 text-white font-medium"
                          : "hover:bg-neutral-100 text-neutral-700"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <InvoiceViewModal
        invoiceId={selectedInvoiceId}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedInvoiceId(null);
        }}
        settings={settings}
      />

      {/* Edit Modal */}
      <InvoiceEditModal
        invoiceId={selectedInvoiceId}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedInvoiceId(null);
        }}
        onSave={handleEditModalSave}
        userId={user?.id || user?.userId}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={hideConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </DashboardLayout>
  );
}
