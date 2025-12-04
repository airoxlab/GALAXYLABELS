'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { FileText, Search, Eye, Trash2, Download, Printer, Plus, X, Edit3, Calendar, User, Hash, Loader2, Share2, MoreVertical } from 'lucide-react';
import { downloadInvoicePDF } from '@/components/sales/InvoicePDF';
import SaleOrderEditModal from '@/components/sales/SaleOrderEditModal';
import Image from 'next/image';
import { isWhatsAppAvailable, sendSalesInvoiceWhatsApp, generateInvoicePDFBase64 } from '@/lib/whatsapp';

// Auto-send WhatsApp helper function
async function autoSendSalesWhatsApp(invoice, items, settings, userId) {
  // Check if auto-send is enabled
  if (!settings?.whatsapp_auto_send_sales) return;

  // Check if WhatsApp is available and connected
  if (!isWhatsAppAvailable()) return;

  try {
    const status = await window.electron?.whatsapp?.getStatus();
    if (!status?.isReady) return;

    // Check if customer has phone number
    const customerPhone = invoice.customers?.whatsapp_no || invoice.customers?.mobile_no;
    if (!customerPhone) return;

    // Generate PDF if attachment is enabled
    let pdfBase64 = null;
    if (settings?.whatsapp_attach_invoice_image !== false) {
      pdfBase64 = await generateInvoicePDFBase64(invoice, items, settings);
    }

    // Send WhatsApp message
    await sendSalesInvoiceWhatsApp({
      invoice: { ...invoice, user_id: userId },
      items,
      settings,
      pdfBase64,
      onSuccess: () => {
        toast.success('Invoice sent via WhatsApp!', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      },
      onError: (error) => {
        console.error('Auto-send WhatsApp failed:', error);
      }
    });
  } catch (error) {
    console.error('Error in auto-send WhatsApp:', error);
  }
}

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
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [openShareMenu, setOpenShareMenu] = useState(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(null);

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
            mobile_no,
            whatsapp_no,
            current_balance
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

      // Auto-send WhatsApp if enabled
      // Fetch the full invoice with customer data for WhatsApp
      const { data: fullInvoice } = await supabase
        .from('sales_invoices')
        .select('*, customers(customer_name, mobile_no, whatsapp_no, current_balance)')
        .eq('id', invoice.id)
        .single();

      if (fullInvoice) {
        const formattedItems = invoiceItemsData.map(item => ({
          ...item,
          product_name: item.product_name || 'Unknown Product'
        }));
        await autoSendSalesWhatsApp(fullInvoice, formattedItems, settings, userId);
      }

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

  async function handleShareWhatsApp(invoice) {
    if (!isWhatsAppAvailable()) {
      toast.error('WhatsApp is only available in the desktop app', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    // Check if customer has a phone number
    const customerPhone = invoice.customers?.whatsapp_no || invoice.customers?.mobile_no;
    if (!customerPhone) {
      toast.error('Customer does not have a phone number', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSendingWhatsApp(invoice.id);
    setOpenShareMenu(null);

    try {
      // Fetch invoice items
      const { data: items, error } = await supabase
        .from('sales_invoice_items')
        .select('*, products(categories(name))')
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      const formattedItems = (items || []).map(item => ({
        ...item,
        product_name: item.product_name || item.products?.name || 'Unknown Product',
        category: item.products?.categories?.name || ''
      }));

      // Generate PDF as base64
      const pdfBase64 = await generateInvoicePDFBase64(invoice, formattedItems, settings);

      // Send WhatsApp message
      await sendSalesInvoiceWhatsApp({
        invoice,
        items: formattedItems,
        settings,
        pdfBase64,
        onSuccess: () => {
          toast.success('Invoice sent via WhatsApp!', {
            duration: 2000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
        },
        onError: (error) => {
          toast.error(error || 'Failed to send WhatsApp message', {
            duration: 3000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
        }
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Error sending WhatsApp: ' + error.message, {
        duration: 3000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSendingWhatsApp(null);
    }
  }

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
                          {/* Print Button */}
                          <button
                            onClick={() => handleDownloadPDF(invoice.id, true)}
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
                                if (sendingWhatsApp === invoice.id) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenShareMenu(openShareMenu?.id === invoice.id ? null : { id: invoice.id, invoice, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenActionMenu(null);
                              }}
                              disabled={sendingWhatsApp === invoice.id}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                sendingWhatsApp === invoice.id
                                  ? "text-green-500 bg-green-50"
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
                                setOpenActionMenu(openActionMenu?.id === invoice.id ? null : { id: invoice.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
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
            <button
              onClick={() => {
                handleDownloadPDF(openActionMenu.id, false);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={() => {
                handleOpenFBRModal(openActionMenu.id);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Push to FBR
            </button>
            <button
              onClick={() => {
                handleDeleteInvoice(openActionMenu.id);
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
