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
import { Download, Eye, Search, X, FileText, ChevronLeft, ChevronRight, Edit3, Trash2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InvoiceHistoryPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();
  const itemsPerPage = 15;

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
        fetchData(userId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  }

  async function fetchData(userId) {
    try {
      const [invoicesRes, customersRes, settingsRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select(`
            *,
            customers (
              customer_name,
              mobile_no
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('id, customer_name')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('customer_name'),
        supabase
          .from('settings')
          .select('*')
          .eq('user_id', userId)
          .single()
      ]);

      setInvoices(invoicesRes.data || []);
      setCustomers(customersRes.data || []);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF(invoice) {
    try {
      const { data: items, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          products (name)
        `)
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      // Format items for PDF
      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.products?.name || 'Unknown Product'
      }));

      const { downloadInvoicePDF: downloadPDF } = await import('@/components/sales/InvoicePDF');
      await downloadPDF(invoice, formattedItems, settings, { showLogo: true, showQR: true });
      notify.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      notify.error('Error downloading invoice: ' + error.message);
    }
  }

  function handleViewInvoice(invoiceId) {
    setSelectedInvoiceId(invoiceId);
    setShowViewModal(true);
  }

  function handleEditInvoice(invoiceId) {
    setSelectedInvoiceId(invoiceId);
    setShowEditModal(true);
  }

  function handleEditModalSave() {
    setShowEditModal(false);
    setSelectedInvoiceId(null);
    if (user) fetchData(user.id || user.userId);
  }

  function handleDeleteInvoice(invoiceId, invoiceNo) {
    showDeleteConfirm(
      'Delete Invoice',
      `Are you sure you want to delete invoice ${invoiceNo}? This action cannot be undone.`,
      async () => {
        try {
          const { error } = await supabase
            .from('sales_invoices')
            .delete()
            .eq('id', invoiceId);

          if (error) throw error;

          notify.success('Invoice deleted successfully');
          if (user) fetchData(user.id || user.userId);
        } catch (error) {
          console.error('Error deleting invoice:', error);
          notify.error('Error deleting invoice: ' + error.message);
        }
      }
    );
  }

  async function handleExportAllPDF() {
    try {
      const { generateSalesReportPDF } = await import('@/components/sales/InvoicePDF');
      await generateSalesReportPDF(filteredInvoices, totalAmount);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF: ' + error.message);
    }
  }

  function handleExportAllExcel() {
    try {
      const excelData = filteredInvoices.map(invoice => ({
        'Invoice #': invoice.invoice_no || '-',
        'Customer': invoice.customers?.customer_name || '-',
        'Customer Mobile': invoice.customers?.mobile_no || '-',
        'Invoice Date': formatDate(invoice.invoice_date),
        'Customer PO': invoice.customer_po || '-',
        'Subtotal': invoice.subtotal || 0,
        'GST Amount': invoice.gst_amount || 0,
        'Total Amount': invoice.total_amount || 0,
        'Status': invoice.bill_situation === 'added_to_account' ? 'Added' : 'Pending',
        'Created At': new Date(invoice.created_at).toLocaleDateString('en-GB')
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoice History');
      XLSX.writeFile(wb, `invoice-history-${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel: ' + error.message);
    }
  }

  async function handleDownloadAllInvoices() {
    if (filteredInvoices.length === 0) {
      alert('No invoices to download');
      return;
    }

    if (!confirm(`This will download ${filteredInvoices.length} invoices as PDF files. Continue?`)) {
      return;
    }

    try {
      const { generateInvoicePDF } = await import('@/components/sales/InvoicePDF');

      for (let i = 0; i < filteredInvoices.length; i++) {
        const invoice = filteredInvoices[i];

        const { data: items, error } = await supabase
          .from('sales_invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id);

        if (error) {
          console.error(`Error fetching items for invoice ${invoice.invoice_no}:`, error);
          continue;
        }

        const doc = await generateInvoicePDF(invoice, items, settings);
        doc.save(`Invoice-${invoice.invoice_no}.pdf`);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      alert(`Successfully downloaded ${filteredInvoices.length} invoices`);
    } catch (error) {
      console.error('Error downloading invoices:', error);
      alert('Error downloading invoices: ' + error.message);
    }
  }

  function handleClearFilters() {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedCustomer('');
    setCurrentPage(1);
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_po?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customers?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate =
      (!startDate || new Date(invoice.invoice_date) >= new Date(startDate)) &&
      (!endDate || new Date(invoice.invoice_date) <= new Date(endDate));

    const matchesCustomer =
      !selectedCustomer || invoice.customer_id === parseInt(selectedCustomer);

    return matchesSearch && matchesDate && matchesCustomer;
  });

  const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + (parseFloat(invoice.total_amount) || 0), 0);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = filteredInvoices.slice(startIndex, endIndex);

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
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">Sale History</h1>
            <p className="text-[10px] text-neutral-500">View and download all invoices</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownloadAllInvoices}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5",
                "bg-neutral-900 text-white rounded-lg",
                "text-xs font-medium",
                "hover:bg-neutral-800 transition-all"
              )}
            >
              <FileText className="w-3 h-3" />
              Download All
            </button>

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
                      onClick={handleExportAllPDF}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportAllExcel}
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
              <span className="text-neutral-400 ml-1.5">({filteredInvoices.length} invoices)</span>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className={cn(
            "bg-white rounded-lg p-2.5",
            "border border-neutral-200"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-neutral-100 rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-neutral-600" />
              </div>
              <div>
                <div className="text-[9px] text-neutral-500 uppercase">Total Invoices</div>
                <div className="text-sm font-semibold text-neutral-900">{filteredInvoices.length}</div>
              </div>
            </div>
          </div>

          <div className={cn(
            "bg-white rounded-lg p-2.5",
            "border border-neutral-200"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Download className="w-3.5 h-3.5 text-neutral-600" />
              </div>
              <div>
                <div className="text-[9px] text-neutral-500 uppercase">Total Amount</div>
                <div className="text-sm font-semibold text-neutral-900">{formatCurrency(totalAmount)}</div>
              </div>
            </div>
          </div>

          <div className={cn(
            "bg-white rounded-lg p-2.5",
            "border border-neutral-200"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-neutral-600" />
              </div>
              <div>
                <div className="text-[9px] text-neutral-500 uppercase">Avg Invoice</div>
                <div className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(filteredInvoices.length > 0 ? totalAmount / filteredInvoices.length : 0)}
                </div>
              </div>
            </div>
          </div>

          <div className={cn(
            "bg-white rounded-lg p-2.5",
            "border border-neutral-200"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-neutral-100 rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-neutral-600" />
              </div>
              <div>
                <div className="text-[9px] text-neutral-500 uppercase">This Month</div>
                <div className="text-sm font-semibold text-neutral-900">
                  {invoices.filter(inv => {
                    const invDate = new Date(inv.invoice_date);
                    const now = new Date();
                    return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
                  }).length}
                </div>
              </div>
            </div>
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
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {currentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-2 py-8 text-center">
                      <div className="text-neutral-400">
                        <FileText className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
                        <p className="text-xs">No invoices found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-neutral-900 text-[11px]">{invoice.invoice_no || '-'}</div>
                        {invoice.customer_po && (
                          <div className="text-[10px] text-neutral-500">PO: {invoice.customer_po}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-neutral-900 text-[11px]">
                          {invoice.customers?.customer_name || '-'}
                        </div>
                        {invoice.customers?.mobile_no && (
                          <div className="text-[10px] text-neutral-500">{invoice.customers.mobile_no}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-700">{formatDate(invoice.invoice_date)}</div>
                        <div className="text-[10px] text-neutral-500">{formatDate(invoice.created_at)}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-semibold text-neutral-900 text-[11px]">
                          {formatCurrency(invoice.total_amount)}
                        </div>
                        {invoice.gst_amount > 0 && (
                          <div className="text-[10px] text-neutral-500">
                            GST: {formatCurrency(invoice.gst_amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                          invoice.bill_situation === 'added_to_account'
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-700"
                        )}>
                          {invoice.bill_situation === 'added_to_account' ? 'Added' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => handleViewInvoice(invoice.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="View details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleEditInvoice(invoice.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Edit invoice"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(invoice)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id, invoice.invoice_no)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Delete invoice"
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
                {startIndex + 1}-{Math.min(endIndex, filteredInvoices.length)} of {filteredInvoices.length}
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
