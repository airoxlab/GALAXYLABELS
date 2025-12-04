'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import SaleOrderViewModal from '@/components/sales/SaleOrderViewModal';
import SaleOrderEditModal from '@/components/sales/SaleOrderEditModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import { Eye, Download, Trash2, ChevronLeft, ChevronRight, Edit3, Search, X, FileSpreadsheet, FileText, Plus, Receipt, TrendingUp, Calendar, Users, Printer, Loader2, Share2, MoreVertical } from 'lucide-react';
import * as XLSX from 'xlsx';
import { downloadInvoicePDF, downloadSaleOrderPDF } from '@/components/sales/InvoicePDF';
import { usePermissions } from '@/hooks/usePermissions';
import { isWhatsAppAvailable, sendSaleOrderWhatsApp, generateSaleOrderPDFBase64 } from '@/lib/whatsapp';

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
  const [editingOrderId, setEditingOrderId] = useState(null);
  const { confirmState, showConfirm, showDeleteConfirm, hideConfirm } = useConfirm();
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [openShareMenu, setOpenShareMenu] = useState(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(null);
  const itemsPerPage = 10;

  // Permission checks
  // Note: Sale orders use sales_invoice permissions for edit/delete since they're related
  const { hasPermission, isSuperadmin } = usePermissions();
  const canAddSaleOrder = isSuperadmin || hasPermission('sales_order_add');
  const canEditSaleOrder = isSuperadmin || hasPermission('sales_invoice_edit');
  const canDeleteSaleOrder = isSuperadmin || hasPermission('sales_invoice_delete');

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
      // Fetch sale orders
      const { data: orders, error: ordersError } = await supabase
        .from('sale_orders')
        .select(`
          *,
          customers (
            customer_name,
            mobile_no,
            whatsapp_no,
            current_balance
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch all invoices to check which orders have been converted
      const { data: invoices, error: invoicesError } = await supabase
        .from('sales_invoices')
        .select('order_id, invoice_no')
        .eq('user_id', userId);

      if (invoicesError) throw invoicesError;

      // Create a map of order_id to invoice info
      const invoiceMap = {};
      if (invoices) {
        invoices.forEach(inv => {
          if (inv.order_id) {
            invoiceMap[inv.order_id] = inv;
          }
        });
      }

      // Add invoice info to orders
      const ordersWithInvoiceInfo = orders.map(order => ({
        ...order,
        hasInvoice: !!invoiceMap[order.id],
        invoiceNo: invoiceMap[order.id]?.invoice_no
      }));

      setSales(ordersWithInvoiceInfo || []);
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
      'Delete Sale Order',
      'Are you sure you want to delete this sale order? This action cannot be undone.',
      async () => {
        try {
          const { error } = await supabase
            .from('sale_orders')
            .delete()
            .eq('id', id);

          if (error) throw error;
          notify.success('Sale order deleted successfully!');
          if (user) fetchSales(user.id || user.userId);
        } catch (error) {
          console.error('Error deleting sale order:', error);
          notify.error('Error: ' + error.message);
        }
      }
    );
  }

  async function handleDownloadPDF(sale) {
    try {
      // Fetch order items with category and units
      const { data: items, error } = await supabase
        .from('sale_order_items')
        .select(`
          *,
          products (name, categories(name), units(symbol, name))
        `)
        .eq('order_id', sale.id);

      if (error) throw error;

      // Format items for PDF with category and unit
      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.product_name || item.products?.name || 'Unknown Product',
        category: item.products?.categories?.name || '',
        unit: item.unit || item.products?.units?.symbol || item.products?.units?.name || 'PCS'
      }));

      await downloadSaleOrderPDF(sale, formattedItems, settings, { showLogo: true });
      notify.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      notify.error('Error downloading PDF: ' + error.message);
    }
  }

  async function handlePrint(sale) {
    try {
      const { data: items, error } = await supabase
        .from('sale_order_items')
        .select(`
          *,
          products (name, categories(name), units(symbol, name))
        `)
        .eq('order_id', sale.id);

      if (error) throw error;

      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.product_name || item.products?.name || 'Unknown Product',
        category: item.products?.categories?.name || '',
        unit: item.unit || item.products?.units?.symbol || item.products?.units?.name || 'PCS'
      }));

      await downloadSaleOrderPDF(sale, formattedItems, settings, { showLogo: true }, true);
    } catch (error) {
      console.error('Error printing:', error);
      notify.error('Error printing: ' + error.message);
    }
  }

  async function handleShareWhatsApp(sale) {
    if (!isWhatsAppAvailable()) {
      notify.error('WhatsApp is only available in the desktop app');
      return;
    }

    // Check if customer has a phone number
    const customerPhone = sale.customers?.whatsapp_no || sale.customers?.mobile_no;
    if (!customerPhone) {
      notify.error('Customer does not have a phone number');
      return;
    }

    setSendingWhatsApp(sale.id);
    setOpenShareMenu(null);

    try {
      // Fetch order items
      const { data: items, error } = await supabase
        .from('sale_order_items')
        .select(`
          *,
          products (name, categories(name), units(symbol, name))
        `)
        .eq('order_id', sale.id);

      if (error) throw error;

      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.product_name || item.products?.name || 'Unknown Product',
        category: item.products?.categories?.name || '',
        unit: item.unit || item.products?.units?.symbol || item.products?.units?.name || 'PCS'
      }));

      // Generate PDF as base64
      const pdfBase64 = await generateSaleOrderPDFBase64(sale, formattedItems, settings);

      // Send WhatsApp message
      await sendSaleOrderWhatsApp({
        order: sale,
        settings,
        pdfBase64,
        onSuccess: () => {
          notify.success('Sale order sent via WhatsApp!');
        },
        onError: (error) => {
          notify.error(error || 'Failed to send WhatsApp message');
        }
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      notify.error('Error sending WhatsApp: ' + error.message);
    } finally {
      setSendingWhatsApp(null);
    }
  }

  function handleViewDetails(sale) {
    setSelectedInvoiceId(sale.id);
    setShowViewModal(true);
  }

  function handleEditOrder(orderId) {
    setEditingOrderId(orderId);
    setShowEditModal(true);
  }

  function handleEditSaved() {
    if (user) fetchSales(user.id || user.userId);
    setShowEditModal(false);
    setEditingOrderId(null);
  }

  function handleConvertToInvoice(sale) {
    showConfirm({
      title: 'Convert to Invoice',
      message: `Are you sure you want to convert sale order "${sale.order_no}" to an invoice? This action cannot be undone.`,
      type: 'warning',
      onConfirm: () => performConvertToInvoice(sale)
    });
  }

  async function performConvertToInvoice(sale) {
    try {
      const userId = user.parentUserId || user.id;

      // Fetch order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('sale_order_items')
        .select('*')
        .eq('order_id', sale.id);

      if (itemsError) throw itemsError;

      // Generate invoice number
      const invoicePrefix = settings?.sale_invoice_prefix || 'INV';
      const invoiceNumber = settings?.sale_invoice_next_number || 1;
      const invoiceNo = `${invoicePrefix}-${String(invoiceNumber).padStart(4, '0')}`;

      // Create invoice
      const invoiceData = {
        user_id: userId,
        invoice_no: invoiceNo,
        order_id: sale.id,
        customer_id: sale.customer_id,
        customer_po: sale.customer_po,
        invoice_date: new Date().toISOString().split('T')[0],
        delivery_date: sale.delivery_date,
        subtotal: sale.subtotal,
        gst_percentage: sale.gst_percentage,
        gst_amount: sale.gst_amount,
        total_amount: sale.total_amount,
        previous_balance: 0,
        final_balance: sale.total_amount,
        status: 'finalized',
        bill_situation: sale.bill_situation,
        box: sale.box,
        notes: sale.notes,
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItemsData = orderItems.map(item => ({
        user_id: userId,
        invoice_id: invoice.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        weight: item.weight,
        net_weight: item.net_weight,
      }));

      const { error: itemsInsertError } = await supabase
        .from('sales_invoice_items')
        .insert(invoiceItemsData);

      if (itemsInsertError) throw itemsInsertError;

      // Update settings
      await supabase
        .from('settings')
        .update({
          sale_invoice_next_number: (settings?.sale_invoice_next_number || 1) + 1
        })
        .eq('user_id', userId);

      notify.success('Sale order converted to invoice successfully!');

      // Refresh settings and sales
      await fetchSettings(userId);
      await fetchSales(userId);
    } catch (error) {
      console.error('Error converting to invoice:', error);
      notify.error('Error converting to invoice: ' + error.message);
    }
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
        'Order No': sale.order_no || '-',
        'Date': formatDate(sale.order_date),
        'Customer': sale.customers?.customer_name || '-',
        'Customer Mobile': sale.customers?.mobile_no || '-',
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
    const searchLower = searchQuery.toLowerCase();
    const searchNumber = parseFloat(searchQuery.replace(/,/g, ''));

    const matchesSearch =
      sale.order_no?.toLowerCase().includes(searchLower) ||
      sale.customer_po?.toLowerCase().includes(searchLower) ||
      sale.customers?.customer_name?.toLowerCase().includes(searchLower) ||
      (!isNaN(searchNumber) && (
        parseFloat(sale.total_amount) === searchNumber ||
        parseFloat(sale.subtotal) === searchNumber
      ));

    const matchesDate =
      (!startDate || new Date(sale.order_date) >= new Date(startDate)) &&
      (!endDate || new Date(sale.order_date) <= new Date(endDate));

    const matchesCustomer =
      !selectedCustomer || sale.customer_id === parseInt(selectedCustomer);

    return matchesSearch && matchesDate && matchesCustomer;
  });

  const totalAmount = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0);
  const totalGST = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.gst_amount) || 0), 0);
  const uniqueCustomers = new Set(filteredSales.map(s => s.customer_id)).size;

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

  const formatCurrency = (amount) => {
    return 'Rs ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
    <ProtectedRoute requiredPermission="sales_order_view" showUnauthorized>
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Sales History</h1>
              <p className="text-sm text-neutral-500">View and manage your sale orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
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
                    "absolute right-0 mt-2 w-48",
                    "bg-white",
                    "border border-neutral-200 rounded-lg",
                    "shadow-lg",
                    "z-20 overflow-hidden"
                  )}>
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors border-t border-neutral-100"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>
            {canAddSaleOrder && (
              <button
                onClick={() => router.push('/sales/sale-order')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  "bg-neutral-900 text-white hover:bg-neutral-800"
                )}
              >
                <Plus className="w-4 h-4" />
                New Sale
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-lg border border-violet-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Total Orders</p>
                <p className="text-lg font-bold text-violet-900">{filteredSales.length}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-lg border border-emerald-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Total Sales</p>
                <p className="text-lg font-bold text-emerald-900">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border border-blue-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total GST</p>
                <p className="text-lg font-bold text-blue-900">{formatCurrency(totalGST)}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-lg border border-amber-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Customers</p>
                <p className="text-lg font-bold text-amber-900">{uniqueCustomers}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
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

        {/* Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Sale Orders</h2>
          </div>

          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No sale orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Sale Order #</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer PO</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Subtotal</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Total</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {currentSales.map((sale) => (
                    <tr key={sale.id} className={cn(
                      "transition-colors",
                      sale.hasInvoice
                        ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                        : "hover:bg-neutral-50"
                    )}>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{formatDate(sale.order_date)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-900">{sale.order_no || '-'}</span>
                          {sale.hasInvoice && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Invoice
                            </span>
                          )}
                        </div>
                        {sale.hasInvoice && sale.invoiceNo && (
                          <div className="text-xs text-emerald-700 mt-0.5">
                            {sale.invoiceNo}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-neutral-900">
                          {sale.customers?.customer_name || '-'}
                        </div>
                        {sale.customers?.mobile_no && (
                          <div className="text-xs text-neutral-500">{sale.customers.mobile_no}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{sale.customer_po || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-neutral-700">
                          {formatCurrency(sale.subtotal)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold text-neutral-900">
                          {formatCurrency(sale.total_amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Button */}
                          <button
                            onClick={() => handlePrint(sale)}
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
                                if (sendingWhatsApp === sale.id) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenShareMenu(openShareMenu?.id === sale.id ? null : { id: sale.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenActionMenu(null);
                              }}
                              disabled={sendingWhatsApp === sale.id}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                sendingWhatsApp === sale.id
                                  ? "text-green-500 bg-green-50"
                                  : "text-neutral-600 hover:text-green-600 hover:bg-green-50"
                              )}
                              title="Share"
                            >
                              {sendingWhatsApp === sale.id ? (
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
                                setOpenActionMenu(openActionMenu?.id === sale.id ? null : { id: sale.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenShareMenu(null);
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-neutral-200 px-4 py-3 flex items-center justify-between bg-neutral-50">
              <div className="text-sm text-neutral-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} of {filteredSales.length} orders
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
      <SaleOrderViewModal
        orderId={selectedInvoiceId}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedInvoiceId(null);
        }}
        settings={settings}
      />

      {/* Edit Modal */}
      <SaleOrderEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingOrderId(null);
        }}
        orderId={editingOrderId}
        userId={user?.id || user?.userId}
        customers={customers}
        onSave={handleEditSaved}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={hideConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.type === 'danger' ? 'Delete' : 'Convert'}
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
                const sale = currentSales.find(s => s.id === openShareMenu.id);
                if (sale) handleShareWhatsApp(sale);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-neutral-700 hover:bg-green-50 transition-colors"
            >
              <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share to WhatsApp
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
                const sale = currentSales.find(s => s.id === openActionMenu.id);
                if (sale) handleViewDetails(sale);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
            {canEditSaleOrder && (
              <button
                onClick={() => {
                  handleEditOrder(openActionMenu.id);
                  setOpenActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Order
              </button>
            )}
            <button
              onClick={() => {
                const sale = currentSales.find(s => s.id === openActionMenu.id);
                if (sale && !sale.hasInvoice) handleConvertToInvoice(sale);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Convert to Invoice
            </button>
            <button
              onClick={() => {
                const sale = currentSales.find(s => s.id === openActionMenu.id);
                if (sale) handleDownloadPDF(sale);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            {canDeleteSaleOrder && (
              <button
                onClick={() => {
                  handleDelete(openActionMenu.id);
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
