'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PurchaseDrawer from '@/components/purchases/PurchaseDrawer';
import PurchaseViewModal from '@/components/purchases/PurchaseViewModal';
import PurchaseEditModal from '@/components/purchases/PurchaseEditModal';
import { notify, useConfirm } from '@/components/ui/Notifications';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ChevronLeft,
  Plus,
  Search,
  ShoppingCart,
  Download,
  FileText,
  FileSpreadsheet,
  Eye,
  Edit3,
  Trash2,
  X,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { downloadPurchaseOrderPDF } from '@/components/purchases/PurchasePDF';

export default function PurchasesPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();

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
        fetchPurchaseOrders(data.user.id);
        fetchSuppliers(data.user.id);
        fetchProducts(data.user.id);
        fetchSettings(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchPurchaseOrders(uid) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            supplier_name,
            mobile_no
          )
        `)
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  }

  async function fetchSuppliers(uid) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true)
        .order('supplier_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  async function fetchProducts(uid) {
    try {
      // First try with is_active filter
      let { data, error } = await supabase
        .from('products')
        .select('id, name, unit_price, category_id')
        .eq('user_id', uid)
        .eq('is_active', true)
        .order('name');

      console.log('fetchProducts - Active products query result:', { data, error, count: data?.length });

      if (error) throw error;

      // If no active products found, try without is_active filter
      if (!data || data.length === 0) {
        console.log('fetchProducts - No active products, trying without is_active filter');
        const result = await supabase
          .from('products')
          .select('id, name, unit_price, category_id')
          .eq('user_id', uid)
          .order('name');

        console.log('fetchProducts - All products query result:', { data: result.data, error: result.error, count: result.data?.length });

        if (!result.error) {
          data = result.data;
        }
      }

      console.log('fetchProducts - Final products set:', data?.length || 0);
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }

  async function fetchSettings(uid) {
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', uid)
        .single();

      // Fetch user currencies
      const { data: currenciesData, error: currenciesError } = await supabase
        .from('user_currencies')
        .select('code, name, symbol, rate_to_pkr, is_default')
        .eq('user_id', uid)
        .order('code');

      if (!settingsError) {
        // Merge settings with user_currencies
        setSettings({
          ...settingsData,
          user_currencies: currenciesData || [{ code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', rate_to_pkr: 1, is_default: true }]
        });
      } else {
        // If no settings, still set user_currencies
        setSettings({
          user_currencies: currenciesData || [{ code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', rate_to_pkr: 1, is_default: true }]
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }

  async function handleSubmit(formData) {
    if (!userId) return;
    setIsLoading(true);
    try {
      const purchaseData = {
        user_id: userId,
        po_no: formData.po_no,
        supplier_id: formData.supplier_id,
        po_date: formData.po_date,
        receiving_date: formData.receiving_date || null,
        currency_code: formData.currency_code || 'PKR',
        is_gst: formData.is_gst,
        gst_percentage: formData.gst_percentage,
        subtotal: formData.subtotal,
        gst_amount: formData.gst_amount,
        total_amount: formData.total_amount,
        previous_balance: formData.previous_balance,
        final_payable: formData.final_payable,
        notes: formData.notes,
        status: formData.status || 'pending'
      };

      if (editingPurchase) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update(purchaseData)
          .eq('id', editingPurchase.id)
          .eq('user_id', userId);

        if (poError) throw poError;

        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('po_id', editingPurchase.id);

        if (deleteError) throw deleteError;

        const items = formData.items.map(item => ({
          user_id: userId,
          po_id: editingPurchase.id,
          product_id: item.product_id,
          product_name: products.find(p => p.id === parseInt(item.product_id))?.name || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(items);

        if (itemsError) throw itemsError;

        const { error: supplierError } = await supabase
          .from('suppliers')
          .update({ current_balance: formData.final_payable })
          .eq('id', formData.supplier_id)
          .eq('user_id', userId);

        if (supplierError) throw supplierError;

        notify.success('Purchase order updated successfully!');
      } else {
        const { data: newPO, error: poError } = await supabase
          .from('purchase_orders')
          .insert([purchaseData])
          .select()
          .single();

        if (poError) throw poError;

        const items = formData.items.map(item => ({
          user_id: userId,
          po_id: newPO.id,
          product_id: item.product_id,
          product_name: products.find(p => p.id === parseInt(item.product_id))?.name || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(items);

        if (itemsError) throw itemsError;

        const { error: supplierError } = await supabase
          .from('suppliers')
          .update({ current_balance: formData.final_payable })
          .eq('id', formData.supplier_id)
          .eq('user_id', userId);

        if (supplierError) throw supplierError;

        notify.success('Purchase order created successfully!');
      }

      setEditingPurchase(null);
      setIsDrawerOpen(false);
      await fetchPurchaseOrders(userId);
    } catch (error) {
      console.error('Error saving purchase order:', error);
      notify.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id) {
    showDeleteConfirm(
      'Delete Purchase Order',
      'Are you sure you want to delete this purchase order? This action cannot be undone.',
      async () => {
        try {
          const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) throw error;
          notify.success('Purchase order deleted successfully!');
          fetchPurchaseOrders(userId);
        } catch (error) {
          console.error('Error deleting purchase order:', error);
          notify.error(error.message);
        }
      }
    );
  }

  async function handleEdit(po) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_items (*)
        `)
        .eq('id', po.id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      setEditingPurchase(data);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error('Error fetching purchase order details:', error);
      notify.error(`Error loading purchase order: ${error.message}`);
    }
  }

  function handleAddNew() {
    setEditingPurchase(null);
    setIsDrawerOpen(true);
  }

  function handleCancel() {
    setEditingPurchase(null);
    setIsDrawerOpen(false);
  }

  function handleViewDetails(po) {
    setSelectedPurchaseId(po.id);
    setShowViewModal(true);
  }

  function handleViewEdit(po) {
    setSelectedPurchaseId(po.id);
    setShowEditModal(true);
  }

  function handleEditModalSave() {
    setShowEditModal(false);
    setSelectedPurchaseId(null);
    if (userId) fetchPurchaseOrders(userId);
  }

  async function handleDownloadPDF(po) {
    try {
      // Fetch purchase order items
      const { data: items, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', po.id);

      if (error) throw error;

      await downloadPurchaseOrderPDF(po, items || [], settings, { showLogo: true, showQR: true });
      notify.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      notify.error(`Error downloading PDF: ${error.message}`);
    }
  }

  function handleClearFilters() {
    setSearchQuery('');
    setFilterSupplier('all');
    setFilterStatus('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }

  function handleExportPDF() {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Purchase Orders Report', 14, 20);

      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 28);
      doc.text(`Total Orders: ${filteredOrders.length}`, 14, 34);
      doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, 14, 40);

      const tableData = filteredOrders.map(po => [
        po.po_no || '-',
        po.suppliers?.supplier_name || '-',
        formatDate(po.po_date),
        formatCurrency(po.total_amount),
        formatCurrency(po.final_payable),
        po.status || 'Pending'
      ]);

      autoTable(doc, {
        startY: 46,
        head: [['PO #', 'Supplier', 'Date', 'Amount', 'Balance', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [23, 23, 23] },
        styles: { fontSize: 8 },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' }
        }
      });

      doc.save(`purchase-orders-${new Date().toISOString().split('T')[0]}.pdf`);
      setShowExportMenu(false);
      notify.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      notify.error(`Error exporting PDF: ${error.message}`);
    }
  }

  function handleExportExcel() {
    try {
      const excelData = filteredOrders.map(po => ({
        'PO #': po.po_no || '-',
        'Supplier': po.suppliers?.supplier_name || '-',
        'Supplier Mobile': po.suppliers?.mobile_no || '-',
        'PO Date': formatDate(po.po_date),
        'Subtotal': po.subtotal || 0,
        'GST %': po.gst_percentage || 0,
        'GST Amount': po.gst_amount || 0,
        'Total Amount': po.total_amount || 0,
        'Previous Balance': po.previous_balance || 0,
        'Final Payable': po.final_payable || 0,
        'Status': po.status || 'Pending',
        'Created At': new Date(po.created_at).toLocaleDateString('en-GB')
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);

      const colWidths = [
        { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
        { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
        { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');

      XLSX.writeFile(wb, `purchase-orders-${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowExportMenu(false);
      notify.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      notify.error(`Error exporting Excel: ${error.message}`);
    }
  }

  const filteredOrders = purchaseOrders.filter(po => {
    const matchesSearch =
      po.po_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.suppliers?.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSupplier =
      filterSupplier === 'all' || po.supplier_id === filterSupplier;

    const matchesStatus =
      filterStatus === 'all' || po.status === filterStatus;

    const matchesDate =
      (!startDate || new Date(po.po_date) >= new Date(startDate)) &&
      (!endDate || new Date(po.po_date) <= new Date(endDate));

    return matchesSearch && matchesSupplier && matchesStatus && matchesDate;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterSupplier, filterStatus, startDate, endDate]);

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

  const totalAmount = filteredOrders.reduce((sum, po) => sum + (parseFloat(po.total_amount) || 0), 0);
  const totalPayable = filteredOrders.reduce((sum, po) => sum + (parseFloat(po.final_payable) || 0), 0);

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
                Purchase History
              </h1>
              <p className="text-[10px] text-neutral-500">
                View and manage your purchase orders
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
              Add Purchase
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

        {/* Filters */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl p-3",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="PO #, Supplier..."
                  className={cn(
                    "w-full pl-8 pr-3 py-1.5",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "text-xs placeholder:text-neutral-400",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            {/* Supplier Filter */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Supplier
              </label>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              >
                <option value="all">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="received">Received</option>
                <option value="partial">Partial</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || filterSupplier !== 'all' || filterStatus !== 'all' || startDate || endDate) && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleClearFilters}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium",
                  "text-neutral-600 hover:text-neutral-900",
                  "hover:bg-neutral-100",
                  "transition-all duration-200",
                  "flex items-center gap-1"
                )}
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl px-3 py-2",
            "border border-neutral-200/60"
          )}>
            <div className="text-[10px] text-neutral-500">Total Orders</div>
            <div className="text-sm font-semibold text-neutral-900">{purchaseOrders.length}</div>
          </div>
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl px-3 py-2",
            "border border-neutral-200/60"
          )}>
            <div className="text-[10px] text-neutral-500">Total Amount</div>
            <div className="text-sm font-semibold text-neutral-900">{formatCurrency(totalAmount)}</div>
          </div>
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl px-3 py-2",
            "border border-neutral-200/60"
          )}>
            <div className="text-[10px] text-neutral-500">Total Payable</div>
            <div className="text-sm font-semibold text-neutral-900">{formatCurrency(totalPayable)}</div>
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
                    PO #
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    Amount
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
                {currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                          <ShoppingCart className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 className="text-base font-medium text-neutral-900 mb-1">No purchase orders found</h3>
                        <p className="text-sm text-neutral-500">
                          {searchQuery || filterSupplier !== 'all' || filterStatus !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Get started by creating your first purchase order'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">{po.po_no}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">
                          {po.suppliers?.supplier_name || '-'}
                        </div>
                        {po.suppliers?.mobile_no && (
                          <div className="text-[9px] text-neutral-400">{po.suppliers.mobile_no}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] text-neutral-600">{formatDate(po.po_date)}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">{formatCurrency(po.total_amount)}</div>
                        {po.gst_amount > 0 && (
                          <div className="text-[9px] text-neutral-400">GST: {formatCurrency(po.gst_amount)}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[11px] font-medium text-neutral-900">{formatCurrency(po.final_payable)}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium",
                          po.status === 'received'
                            ? 'bg-green-100 text-green-700'
                            : po.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-neutral-100 text-neutral-700'
                        )}>
                          {po.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-0">
                          <button
                            onClick={() => handleViewDetails(po)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="View details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleViewEdit(po)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Edit purchase order"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(po)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(po.id)}
                            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-all"
                            title="Delete purchase order"
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
                Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} results
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

      {/* Purchase Drawer */}
      <PurchaseDrawer
        isOpen={isDrawerOpen}
        onClose={handleCancel}
        purchase={editingPurchase}
        suppliers={suppliers}
        products={products}
        settings={settings}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={hideConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onConfirm={confirmState.onConfirm}
      />

      {/* View Modal */}
      <PurchaseViewModal
        purchaseId={selectedPurchaseId}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedPurchaseId(null);
        }}
        settings={settings}
      />

      {/* Edit Modal */}
      <PurchaseEditModal
        purchaseId={selectedPurchaseId}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPurchaseId(null);
        }}
        onSave={handleEditModalSave}
        userId={userId}
      />
    </DashboardLayout>
  );
}
