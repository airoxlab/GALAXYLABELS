'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { FileText, Search, Eye, Trash2, Download, Printer, Plus, X, Edit3, Calendar, User, Hash, Loader2 } from 'lucide-react';
import { downloadInvoicePDF } from '@/components/sales/InvoicePDF';
import SaleOrderEditModal from '@/components/sales/SaleOrderEditModal';
import Image from 'next/image';

export default function SalesInvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [saleOrders, setSaleOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [converting, setConverting] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrderItems, setShowOrderItems] = useState(false);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [viewingItems, setViewingItems] = useState([]);

  const [showFBRModal, setShowFBRModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [fbrLogoError, setFbrLogoError] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        const dataUserId = data.user.parentUserId || data.user.id;
        await fetchInvoices(dataUserId);
        await fetchSettings(dataUserId);
        await fetchCustomers(dataUserId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers(userId) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('customer_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function fetchInvoices(userId) {
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
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Error loading invoices', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  async function fetchSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }

  async function fetchSaleOrders(userId) {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('sale_orders')
        .select(`
          *,
          customers (
            customer_name,
            mobile_no
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'finalized')
        .order('created_at', { ascending: false});

      if (error) throw error;
      setSaleOrders(data || []);
    } catch (error) {
      console.error('Error fetching sale orders:', error);
      toast.error('Error loading sale orders', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setLoadingOrders(false);
    }
  }

  const handleOpenConvertModal = async () => {
    setShowConvertModal(true);
    await fetchSaleOrders(user.parentUserId || user.id);
  };

  const handleViewOrderItems = async (order) => {
    try {
      const { data, error } = await supabase
        .from('sale_order_items')
        .select('*')
        .eq('order_id', order.id);

      if (error) throw error;
      setSelectedOrder(order);
      setSelectedOrderItems(data || []);
      setShowOrderItems(true);
    } catch (error) {
      console.error('Error fetching order items:', error);
      toast.error('Error loading order items', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleConvertToInvoice = async () => {
    if (!selectedOrder) {
      toast.error('Please select a sale order', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setConverting(true);
    try {
      const userId = user.parentUserId || user.id;
      const invoicePrefix = settings?.sale_invoice_prefix || 'INV';
      const invoiceNumber = settings?.sale_invoice_next_number || 1;
      const invoiceNo = `${invoicePrefix}-${String(invoiceNumber).padStart(4, '0')}`;

      const invoiceData = {
        user_id: userId,
        invoice_no: invoiceNo,
        order_id: selectedOrder.id,
        customer_id: selectedOrder.customer_id,
        customer_po: selectedOrder.customer_po,
        invoice_date: new Date().toISOString().split('T')[0],
        delivery_date: selectedOrder.delivery_date,
        subtotal: selectedOrder.subtotal,
        gst_percentage: selectedOrder.gst_percentage,
        gst_amount: selectedOrder.gst_amount,
        total_amount: selectedOrder.total_amount,
        previous_balance: 0,
        final_balance: selectedOrder.total_amount,
        status: 'finalized',
        bill_situation: selectedOrder.bill_situation,
        box: selectedOrder.box,
        notes: selectedOrder.notes,
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const invoiceItemsData = selectedOrderItems.map(item => ({
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

      await supabase
        .from('settings')
        .update({
          sale_invoice_next_number: (settings?.sale_invoice_next_number || 1) + 1
        })
        .eq('user_id', userId);

      toast.success('Sale order converted to invoice successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      setShowConvertModal(false);
      setShowOrderItems(false);
      setSelectedOrder(null);
      setSelectedOrderItems([]);
      await fetchInvoices(userId);
      await fetchSettings(userId);
    } catch (error) {
      console.error('Error converting to invoice:', error);
      toast.error(error.message || 'Error converting to invoice', {
        duration: 3000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setConverting(false);
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const { data: invoice } = await supabase
        .from('sales_invoices')
        .select('*, customers(customer_name, mobile_no, address, ntn, str)')
        .eq('id', invoiceId)
        .single();

      const { data: items } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      setViewingInvoice(invoice);
      setViewingItems(items || []);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('Error loading invoice', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('sales_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success('Invoice deleted successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      await fetchInvoices(user.parentUserId || user.id);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error(error.message || 'Error deleting invoice', {
        duration: 3000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleDownloadPDF = async (invoiceId, shouldPrint = false) => {
    try {
      const { data: invoice } = await supabase
        .from('sales_invoices')
        .select('*, customers(customer_name, mobile_no, address, ntn, str)')
        .eq('id', invoiceId)
        .single();

      const { data: items } = await supabase
        .from('sales_invoice_items')
        .select('*, products(categories(name))')
        .eq('invoice_id', invoiceId);

      if (invoice && items) {
        await downloadInvoicePDF(
          { ...invoice, order_no: invoice.invoice_no },
          items,
          settings,
          shouldPrint
        );
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error generating PDF', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleOpenFBRModal = async (invoiceId) => {
    try {
      const { data: invoice } = await supabase
        .from('sales_invoices')
        .select('*, customers(customer_name, mobile_no, address, ntn, str)')
        .eq('id', invoiceId)
        .single();

      const { data: items } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      setSelectedInvoice({ ...invoice, items });
      setShowFBRModal(true);
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('Error loading invoice', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleEditInvoice = async (invoiceId) => {
    try {
      // Get the invoice to find the order_id
      const { data: invoice } = await supabase
        .from('sales_invoices')
        .select('order_id')
        .eq('id', invoiceId)
        .single();

      if (invoice?.order_id) {
        setEditingOrderId(invoice.order_id);
        setShowEditModal(true);
      } else {
        toast.error('Cannot find associated sale order', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('Error loading invoice', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleSaveInvoiceEdit = async () => {
    // After editing the sale order items, we need to update the invoice items as well
    try {
      const { data: orderItems } = await supabase
        .from('sale_order_items')
        .select('*')
        .eq('order_id', editingOrderId);

      const { data: invoice } = await supabase
        .from('sales_invoices')
        .select('id')
        .eq('order_id', editingOrderId)
        .single();

      if (invoice && orderItems) {
        // Delete existing invoice items
        await supabase
          .from('sales_invoice_items')
          .delete()
          .eq('invoice_id', invoice.id);

        // Insert new invoice items based on updated order items
        const invoiceItems = orderItems.map(item => ({
          invoice_id: invoice.id,
          user_id: user.parentUserId || user.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

        await supabase
          .from('sales_invoice_items')
          .insert(invoiceItems);

        // Recalculate and update invoice total
        const total = orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
        await supabase
          .from('sales_invoices')
          .update({ total_amount: total })
          .eq('id', invoice.id);
      }

      setShowEditModal(false);
      setEditingOrderId(null);
      await fetchInvoices(user.parentUserId || user.id);

      toast.success('Invoice updated successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error updating invoice items:', error);
      toast.error('Error updating invoice', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customers?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.fbr_invoice_no?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !filterStatus || invoice.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Sales Invoices</h1>
            <p className="text-sm text-neutral-500">Manage your sales invoices</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-neutral-200/60 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by invoice no, customer, or FBR invoice no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm rounded-lg transition-all",
                  "bg-white border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                )}
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={cn(
                "px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
            </select>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-neutral-200/60 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Invoices</h2>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Invoice No</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">FBR Invoice No</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer PO</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Total</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-neutral-900">{invoice.invoice_no}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-600">{invoice.fbr_invoice_no || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-600">{invoice.customer_po || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{invoice.customers?.customer_name || 'N/A'}</p>
                          <p className="text-xs text-neutral-500">{invoice.customers?.mobile_no || ''}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{formatDate(invoice.invoice_date)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-neutral-700">
                          Rs {formatCurrency(invoice.total_amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium",
                          invoice.status === 'finalized' ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'
                        )}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewInvoice(invoice.id)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(invoice.id, false)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(invoice.id, true)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Print"
                          >
                            <Printer className="w-4 h-4 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => handleEditInvoice(invoice.id)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                          <button
                            onClick={() => handleOpenFBRModal(invoice.id)}
                            className="px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium text-blue-600"
                            title="Push to FBR"
                          >
                            FBR
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConvertModal(false)}
          />
          <div className={cn(
            "relative bg-white rounded-2xl shadow-2xl",
            "w-full max-w-4xl max-h-[90vh] overflow-hidden",
            "mx-4"
          )}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-neutral-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Convert Sale Order to Invoice</h2>
                  <p className="text-xs text-neutral-500">Select a sale order to convert</p>
                </div>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {loadingOrders ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
                </div>
              ) : saleOrders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No finalized sale orders found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer PO</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Subtotal</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Total</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {saleOrders.map(order => (
                        <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-sm text-neutral-700">{formatDate(order.order_date)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-neutral-900">
                              {order.customers?.customer_name || '-'}
                            </div>
                            {order.customers?.mobile_no && (
                              <div className="text-xs text-neutral-500">{order.customers.mobile_no}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-neutral-700">{order.customer_po || '-'}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-neutral-700">Rs {formatCurrency(order.subtotal)}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-medium text-neutral-900">Rs {formatCurrency(order.total_amount)}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleViewOrderItems(order)}
                              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                              title="View Items"
                            >
                              <Eye className="w-4 h-4 text-neutral-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showOrderItems && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowOrderItems(false)}
          />
          <div className={cn(
            "relative bg-white rounded-2xl shadow-2xl",
            "w-full max-w-3xl max-h-[90vh] overflow-hidden",
            "mx-4"
          )}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-neutral-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Order Items</h2>
                  <p className="text-xs text-neutral-500">{selectedOrder.order_no}</p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderItems(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-medium">Customer</span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">{selectedOrder.customers?.customer_name}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">Date</span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">{formatDate(selectedOrder.order_date)}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <Hash className="w-4 h-4" />
                    <span className="text-xs font-medium">Total</span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">Rs {formatCurrency(selectedOrder.total_amount)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Product</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-neutral-700">Qty</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-neutral-700">Price</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-neutral-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {selectedOrderItems.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50">
                        <td className="py-2 px-3">
                          <span className="text-sm text-neutral-900">{item.product_name}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-sm text-neutral-700">{item.quantity}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-sm text-neutral-700">Rs {formatCurrency(item.unit_price)}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-sm font-medium text-neutral-900">Rs {formatCurrency(item.total_price)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowOrderItems(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToInvoice}
                disabled={converting}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-neutral-900 text-white",
                  "hover:bg-neutral-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2 transition-colors"
                )}
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  'Convert to Invoice'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowViewModal(false)}
          />
          <div className={cn(
            "relative bg-white rounded-2xl shadow-2xl",
            "w-full max-w-3xl max-h-[90vh] overflow-hidden",
            "mx-4"
          )}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-neutral-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Invoice Details</h2>
                  <p className="text-xs text-neutral-500">{viewingInvoice.invoice_no}</p>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-600 mb-1">Customer</p>
                  <p className="text-sm font-semibold text-neutral-900">{viewingInvoice.customers?.customer_name}</p>
                  <p className="text-xs text-neutral-500">{viewingInvoice.customers?.mobile_no}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-600 mb-1">Invoice Date</p>
                  <p className="text-sm font-semibold text-neutral-900">{formatDate(viewingInvoice.invoice_date)}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-600 mb-1">FBR Invoice No</p>
                  <p className="text-sm font-semibold text-neutral-900">{viewingInvoice.fbr_invoice_no || '-'}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-600 mb-1">Total Amount</p>
                  <p className="text-sm font-semibold text-neutral-900">Rs {formatCurrency(viewingInvoice.total_amount)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Product</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-neutral-700">Qty</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-neutral-700">Price</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-neutral-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {viewingItems.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50">
                        <td className="py-2 px-3">
                          <span className="text-sm text-neutral-900">{item.product_name}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-sm text-neutral-700">{item.quantity}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-sm text-neutral-700">Rs {formatCurrency(item.unit_price)}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-sm font-medium text-neutral-900">Rs {formatCurrency(item.total_price)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFBRModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFBRModal(false)}
          />
          <div className={cn(
            "relative bg-white rounded-2xl shadow-2xl",
            "w-full max-w-4xl max-h-[90vh] overflow-hidden",
            "mx-4"
          )}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center border border-neutral-200 p-2">
                  <img
                    src="https://brandlogovector.com/wp-content/uploads/2022/08/FBR-Logo-Small.png"
                    alt="FBR"
                    className="w-20 h-20 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Push to FBR</h2>
                  <p className="text-xs text-neutral-500">Invoice: {selectedInvoice.invoice_no}</p>
                </div>
              </div>
              <button
                onClick={() => setShowFBRModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                  <p className="text-xs text-neutral-600 mb-1">Customer</p>
                  <p className="text-sm font-semibold text-neutral-900">{selectedInvoice.customers?.customer_name}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                  <p className="text-xs text-neutral-600 mb-1">Invoice Date</p>
                  <p className="text-sm font-semibold text-neutral-900">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                  <p className="text-xs text-neutral-600 mb-1">Total Amount</p>
                  <p className="text-sm font-semibold text-neutral-900">Rs {formatCurrency(selectedInvoice.total_amount)}</p>
                </div>
              </div>

              {selectedInvoice.fbr_invoice_no && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-green-700 mb-1">FBR Invoice No</p>
                  <p className="text-sm font-semibold text-green-900">{selectedInvoice.fbr_invoice_no}</p>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Invoice Items</h3>
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-700">Product</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-700">Qty</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-700">Weight (kg)</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-700">Unit Price</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {selectedInvoice.items?.map((item, index) => (
                          <tr key={index} className="hover:bg-neutral-50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="text-sm text-neutral-900 font-medium">{item.product_name}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="text-sm text-neutral-700">{item.quantity}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm text-neutral-700">{item.weight || '-'}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm text-neutral-700">Rs {formatCurrency(item.unit_price)}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-medium text-neutral-900">Rs {formatCurrency(item.total_price)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">Total Weight:</span>
                    <span className="text-sm font-semibold text-neutral-900">
                      {(selectedInvoice.items?.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0) || 0).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">Subtotal:</span>
                    <span className="text-sm font-semibold text-neutral-900">Rs {formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">GST ({selectedInvoice.gst_percentage}%):</span>
                    <span className="text-sm font-semibold text-neutral-900">Rs {formatCurrency(selectedInvoice.gst_amount)}</span>
                  </div>
                  <div className="pt-2 border-t border-neutral-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-neutral-900">Total Amount:</span>
                      <span className="text-sm font-bold text-neutral-900">Rs {formatCurrency(selectedInvoice.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200">
              <button
                disabled={true}
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-medium",
                  "bg-neutral-900 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                Push to FBR (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      <SaleOrderEditModal
        orderId={editingOrderId}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingOrderId(null);
        }}
        onSave={handleSaveInvoiceEdit}
        userId={user?.parentUserId || user?.id}
        customers={customers}
      />
    </DashboardLayout>
  );
}
