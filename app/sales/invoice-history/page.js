'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import InvoiceViewModal from '@/components/sales/InvoiceViewModal';
import InvoiceEditModal from '@/components/sales/InvoiceEditModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { Download, Eye, Search, X, FileText, ChevronLeft, ChevronRight, Edit3, Trash2, FileSpreadsheet, Printer, TrendingUp, Calendar, Receipt, Loader2, Share2, MoreVertical } from 'lucide-react';
import * as XLSX from 'xlsx';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { usePermissions } from '@/hooks/usePermissions';
import { sendSalesInvoiceWhatsApp, generateInvoicePDFBase64, isWhatsAppAvailable } from '@/lib/whatsapp';

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
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [openShareMenu, setOpenShareMenu] = useState(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(null);
  const itemsPerPage = 15;

  // Permission checks
  const { hasPermission, isSuperadmin } = usePermissions();
  const canEditInvoice = isSuperadmin || hasPermission('sales_invoice_edit');
  const canDeleteInvoice = isSuperadmin || hasPermission('sales_invoice_delete');

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        // Use parentUserId for data queries (staff sees parent account data)
        const userId = data.user.parentUserId || data.user.id || data.user.userId;
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

  async function handlePrint(invoice) {
    try {
      const { data: items, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          products (name)
        `)
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.products?.name || 'Unknown Product'
      }));

      const { downloadInvoicePDF: downloadPDF } = await import('@/components/sales/InvoicePDF');
      await downloadPDF(invoice, formattedItems, settings, { showLogo: true, showQR: true }, true);
    } catch (error) {
      console.error('Error printing:', error);
      notify.error('Error printing: ' + error.message);
    }
  }

  function handleViewInvoice(invoiceId) {
    setSelectedInvoiceId(invoiceId);
    setShowViewModal(true);
  }

  async function handleShareWhatsApp(invoice) {
    if (!isWhatsAppAvailable()) {
      notify.error('WhatsApp is only available in the desktop app');
      return;
    }

    if (!invoice.customers?.mobile_no) {
      notify.error('Customer does not have a phone number');
      return;
    }

    setSendingWhatsApp(invoice.id);

    try {
      // Fetch invoice items
      const { data: items, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          products (name)
        `)
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.products?.name || 'Unknown Product'
      }));

      // Generate PDF as base64 if attachment is enabled
      let pdfBase64 = null;
      if (settings?.whatsapp_attach_invoice_image !== false) {
        pdfBase64 = await generateInvoicePDFBase64(invoice, formattedItems, settings);
      }

      // Send via WhatsApp
      await sendSalesInvoiceWhatsApp({
        invoice,
        items: formattedItems,
        settings,
        pdfBase64,
        onSuccess: () => {
          notify.success('Invoice sent via WhatsApp!');
        },
        onError: (error) => {
          notify.error(error);
        },
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      notify.error('Error sending via WhatsApp: ' + error.message);
    } finally {
      setSendingWhatsApp(null);
      setOpenShareMenu(null);
    }
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
          .select('*, products(categories(name))')
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
    const searchLower = searchQuery.toLowerCase();
    const searchNumber = parseFloat(searchQuery.replace(/,/g, ''));

    const matchesSearch =
      invoice.invoice_no?.toLowerCase().includes(searchLower) ||
      invoice.customer_po?.toLowerCase().includes(searchLower) ||
      invoice.customers?.customer_name?.toLowerCase().includes(searchLower) ||
      (!isNaN(searchNumber) && (
        parseFloat(invoice.total_amount) === searchNumber ||
        parseFloat(invoice.subtotal) === searchNumber
      ));

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

  return (
    <ProtectedRoute requiredPermission="sales_invoice_view" showUnauthorized>
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Invoice History</h1>
            <p className="text-sm text-neutral-500">View and download all invoices</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllInvoices}
              className={cn(
                "flex items-center gap-2 px-4 py-2",
                "bg-neutral-900 text-white rounded-lg",
                "text-sm font-medium",
                "hover:bg-neutral-800 transition-all"
              )}
            >
              <FileText className="w-4 h-4" />
              Download All
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2",
                  "bg-white border border-neutral-200 rounded-lg",
                  "text-sm font-medium text-neutral-700",
                  "hover:bg-neutral-50 transition-all"
                )}
              >
                <Download className="w-4 h-4" />
                Export
              </button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className={cn(
                    "absolute right-0 mt-1 w-44",
                    "bg-white",
                    "border border-neutral-200 rounded-lg",
                    "shadow-lg",
                    "z-20 overflow-hidden"
                  )}>
                    <button
                      onClick={handleExportAllPDF}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportAllExcel}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors border-t border-neutral-100"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice, customer, PO, price..."
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm rounded-lg transition-all",
                  "bg-white border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                )}
              />
            </div>

            {/* Customer Dropdown */}
            <div className="w-48">
              <SearchableDropdown
                options={customerOptions}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                placeholder="All Customers"
                searchPlaceholder="Search customers..."
                allowClear={false}
                className="text-sm"
              />
            </div>

            {/* Start Date */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(
                "px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            />

            {/* End Date */}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn(
                "px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            />

            {(searchQuery || selectedCustomer || startDate || endDate) && (
              <button
                onClick={handleClearFilters}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards - Colorful */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-lg border border-violet-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Total Invoices</p>
                <p className="text-lg font-bold text-violet-900">{filteredInvoices.length}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-lg border border-emerald-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Total Amount</p>
                <p className="text-lg font-bold text-emerald-900">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border border-blue-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Avg Invoice</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(filteredInvoices.length > 0 ? totalAmount / filteredInvoices.length : 0)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-lg border border-amber-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">This Month</p>
                <p className="text-lg font-bold text-amber-900">
                  {invoices.filter(inv => {
                    const invDate = new Date(inv.invoice_date);
                    const now = new Date();
                    return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Invoice List</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Invoice #</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer PO</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {currentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center">
                      <Receipt className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                      <p className="text-sm text-neutral-500">No invoices found</p>
                    </td>
                  </tr>
                ) : (
                  currentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{formatDate(invoice.invoice_date)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-neutral-900">{invoice.invoice_no || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-neutral-900">
                          {invoice.customers?.customer_name || '-'}
                        </div>
                        {invoice.customers?.mobile_no && (
                          <div className="text-xs text-neutral-500">{invoice.customers.mobile_no}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{invoice.customer_po || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-semibold text-neutral-900">
                          {formatCurrency(invoice.total_amount)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
                          invoice.bill_situation === 'added_to_account'
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          {invoice.bill_situation === 'added_to_account' ? 'Added' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Button */}
                          <button
                            onClick={() => handlePrint(invoice)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              "text-neutral-600 hover:text-violet-600 hover:bg-violet-50"
                            )}
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Share Button with WhatsApp dropdown */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenShareMenu(openShareMenu?.id === invoice.id ? null : { id: invoice.id, invoice, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenActionMenu(null);
                              }}
                              disabled={sendingWhatsApp === invoice.id}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                sendingWhatsApp === invoice.id
                                  ? "text-green-600 bg-green-50"
                                  : "text-neutral-600 hover:text-green-600 hover:bg-green-50"
                              )}
                              title="Share"
                            >
                              {sendingWhatsApp === invoice.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Share2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {/* More Actions Menu */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenActionMenu(openActionMenu?.id === invoice.id ? null : { id: invoice.id, invoice_no: invoice.invoice_no, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              }}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                              )}
                              title="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
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
            <div className="border-t border-neutral-200 px-4 py-3 flex items-center justify-between bg-neutral-50">
              <div className="text-sm text-neutral-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredInvoices.length)} of {filteredInvoices.length} invoices
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
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
                        "px-3 py-1.5 text-sm rounded-lg transition-all",
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
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
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

      {/* Share Dropdown Portal */}
      {openShareMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenShareMenu(null)}
          />
          <div
            className="fixed z-50 w-48 bg-white rounded-lg border border-neutral-200 shadow-lg overflow-hidden"
            style={{ top: openShareMenu.top, right: openShareMenu.right }}
          >
            <button
              onClick={() => {
                handleShareWhatsApp(openShareMenu.invoice);
              }}
              disabled={sendingWhatsApp === openShareMenu.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-neutral-700 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {sendingWhatsApp === openShareMenu.id ? (
                <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              )}
              {sendingWhatsApp === openShareMenu.id ? 'Sending...' : 'Share to WhatsApp'}
            </button>
          </div>
        </>
      )}

      {/* Actions Dropdown Portal */}
      {openActionMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenActionMenu(null)}
          />
          <div
            className="fixed z-50 w-44 bg-white rounded-lg border border-neutral-200 shadow-lg overflow-hidden"
            style={{ top: openActionMenu.top, right: openActionMenu.right }}
          >
            <button
              onClick={() => {
                handleViewInvoice(openActionMenu.id);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
            {canEditInvoice && (
              <button
                onClick={() => {
                  handleEditInvoice(openActionMenu.id);
                  setOpenActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Invoice
              </button>
            )}
            <button
              onClick={() => {
                const invoice = currentInvoices.find(inv => inv.id === openActionMenu.id);
                if (invoice) handleDownloadPDF(invoice);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            {canDeleteInvoice && (
              <button
                onClick={() => {
                  handleDeleteInvoice(openActionMenu.id, openActionMenu.invoice_no);
                  setOpenActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
    </ProtectedRoute>
  );
}
