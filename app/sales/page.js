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
import { Eye, Download, Trash2, ChevronLeft, ChevronRight, Edit3, Search, X, FileSpreadsheet, FileText, Plus, Receipt, TrendingUp, Calendar, Users, Printer } from 'lucide-react';
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

  async function handlePrint(sale) {
    try {
      const { data: items, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          products (name)
        `)
        .eq('invoice_id', sale.id);

      if (error) throw error;

      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.products?.name || 'Unknown Product'
      }));

      await downloadInvoicePDF(sale, formattedItems, settings, { showLogo: true, showQR: true }, true);
    } catch (error) {
      console.error('Error printing:', error);
      notify.error('Error printing: ' + error.message);
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
    const searchLower = searchQuery.toLowerCase();
    const searchNumber = parseFloat(searchQuery.replace(/,/g, ''));

    const matchesSearch =
      sale.invoice_no?.toLowerCase().includes(searchLower) ||
      sale.customer_po?.toLowerCase().includes(searchLower) ||
      sale.customers?.customer_name?.toLowerCase().includes(searchLower) ||
      (!isNaN(searchNumber) && (
        parseFloat(sale.total_amount) === searchNumber ||
        parseFloat(sale.subtotal) === searchNumber
      ));

    const matchesDate =
      (!startDate || new Date(sale.invoice_date) >= new Date(startDate)) &&
      (!endDate || new Date(sale.invoice_date) <= new Date(endDate));

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

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
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
              <p className="text-sm text-neutral-500">View and manage your sales invoices</p>
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
          </div>
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-lg border border-violet-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Total Invoices</p>
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
            <h2 className="text-sm font-semibold text-neutral-900">Sales Invoices</h2>
          </div>

          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No sales found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Invoice #</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer PO</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Subtotal</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Total</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {currentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{formatDate(sale.invoice_date)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-neutral-900">{sale.invoice_no || '-'}</div>
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
                          <button
                            onClick={() => handleViewDetails(sale)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              "text-neutral-600 hover:text-blue-600 hover:bg-blue-50"
                            )}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditInvoice(sale.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              "text-neutral-600 hover:text-amber-600 hover:bg-amber-50"
                            )}
                            title="Edit invoice"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(sale)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              "text-neutral-600 hover:text-emerald-600 hover:bg-emerald-50"
                            )}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
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
                          <button
                            onClick={() => handleDelete(sale.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              "text-neutral-600 hover:text-red-600 hover:bg-red-50"
                            )}
                            title="Delete sale"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                Showing {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} of {filteredSales.length} invoices
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
    </DashboardLayout>
  );
}
