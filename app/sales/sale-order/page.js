'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, FileText, X, Edit3, Clock, Download, Receipt } from 'lucide-react';
import { downloadInvoicePDF } from '@/components/sales/InvoicePDF';
import AddProductModal from '@/components/ui/AddProductModal';

export default function NewSaleOrderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(true);
  const [downloadPdf, setDownloadPdf] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');

  const [formData, setFormData] = useState({
    order_no: '',
    invoice_no: '',
    customer_id: '',
    customer_po: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    gst_percentage: 18,
    bill_situation: 'pending',
    items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }],
    special_note: '',
  });

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        await fetchData(data.user.id);
        await fetchSettings(data.user.id);
        await fetchDrafts(data.user.id);

        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        if (editId) {
          await loadOrderForEdit(editId, data.user.id);
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  // Generate order number using settings prefix
  function generateOrderNo(settingsData) {
    const prefix = settingsData?.sale_order_prefix || 'SO';
    const nextNumber = settingsData?.sale_order_next_number || 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  // Generate invoice number using settings prefix
  function generateInvoiceNo(settingsData) {
    const prefix = settingsData?.sale_invoice_prefix || 'INV';
    const nextNumber = settingsData?.sale_invoice_next_number || 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  async function fetchData(userId) {
    if (!userId) {
      console.error('No userId provided to fetchData');
      return;
    }

    try {
      const [customersRes, productsRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, customer_name')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('customer_name'),
        supabase
          .from('products')
          .select(`
            id,
            name,
            unit_price,
            category_id,
            categories (
              id,
              name
            )
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (productsRes.error) throw productsRes.error;

      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  async function fetchSettings(userId) {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setSettings(data);

      // Set initial order and invoice numbers based on settings
      setFormData(prev => ({
        ...prev,
        order_no: generateOrderNo(data),
        invoice_no: generateInvoiceNo(data)
      }));
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use default numbers if settings not found
      setFormData(prev => ({
        ...prev,
        order_no: generateOrderNo(null),
        invoice_no: generateInvoiceNo(null)
      }));
    }
  }

  async function fetchDrafts(userId) {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('sale_orders')
        .select('id, order_no, order_date, total_amount, customers(customer_name)')
        .eq('user_id', userId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
    }
  }

  async function loadOrderForEdit(orderId, userId) {
    try {
      const { data: order, error: orderError } = await supabase
        .from('sale_orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (orderError) throw orderError;

      const { data: items } = await supabase
        .from('sale_order_items')
        .select('*, products(categories(name))')
        .eq('order_id', orderId);

      const loadedItems = items.length > 0 ? items.map(item => ({
        product_id: item.product_id?.toString() || '',
        product_name: item.product_name || '',
        category: item.products?.categories?.name || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
      })) : [];

      // Fill remaining slots to maintain minimum rows
      while (loadedItems.length < 1) {
        loadedItems.push({ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 });
      }

      setFormData({
        order_no: order.order_no,
        customer_id: order.customer_id?.toString() || '',
        customer_po: order.customer_po || '',
        order_date: order.order_date,
        delivery_date: order.delivery_date || new Date().toISOString().split('T')[0],
        gst_percentage: order.gst_percentage || 18,
        bill_situation: order.bill_situation || 'pending',
        items: loadedItems,
        special_note: order.notes || '',
      });

      setEditingOrderId(orderId);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Error loading order', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (index, productId) => {
    const newItems = [...formData.items];
    const product = products.find(p => p.id === parseInt(productId));
    if (product) {
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        category: product.categories?.name || '',
        unit_price: product.unit_price || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        product_name: '',
        category: '',
        unit_price: 0,
      };
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0));
    }, 0);
    const gstAmount = (subtotal * parseFloat(formData.gst_percentage || 0)) / 100;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  async function handleQuickAddCustomer(name) {
    if (!name.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ user_id: user.id, customer_name: name.trim(), is_active: true, current_balance: 0 }])
        .select()
        .single();

      if (error) throw error;
      setCustomers(prev => [...prev, data].sort((a, b) => a.customer_name.localeCompare(b.customer_name)));
      setFormData(prev => ({ ...prev, customer_id: data.id.toString() }));
      toast.success('Customer added', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  async function handleQuickAddProduct(name, index) {
    if (!name.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{ user_id: user.id, name: name.trim(), is_active: true, unit_price: 0, current_stock: 0 }])
        .select('id, name, unit_price, categories(name)')
        .single();

      if (error) throw error;

      // Add to products list
      setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));

      // Directly update the form item with the new product data
      const newItems = [...formData.items];
      newItems[index] = {
        ...newItems[index],
        product_id: data.id.toString(),
        product_name: data.name,
        category: data.categories?.name || '',
        unit_price: data.unit_price || 0,
      };
      setFormData(prev => ({ ...prev, items: newItems }));

      toast.success('Product added', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  function handleOpenAddProductModal(searchQuery, index) {
    setAddProductIndex(index);
    setAddProductInitialName(searchQuery || '');
    setShowAddProductModal(true);
  }

  function handleProductAddedFromModal(productData) {
    // Add to products list
    setProducts(prev => [...prev, productData].sort((a, b) => a.name.localeCompare(b.name)));

    // Update the form item with the new product data
    if (addProductIndex !== null) {
      const newItems = [...formData.items];
      newItems[addProductIndex] = {
        ...newItems[addProductIndex],
        product_id: productData.id.toString(),
        product_name: productData.name,
        category: productData.categories?.name || '',
        unit_price: productData.unit_price || 0,
      };
      setFormData(prev => ({ ...prev, items: newItems }));
    }
  }

  async function handleSubmit(e, saveAs = 'finalized', shouldDownloadPdf = false) {
    e.preventDefault();
    if (!user) return;

    if (!formData.customer_id) {
      toast.error('Please select a customer', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    const validItems = formData.items.filter(item => item.product_id);
    if (validItems.length === 0) {
      toast.error('Please add at least one product', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSaving(true);

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('current_balance')
        .eq('id', formData.customer_id)
        .single();

      const previousBalance = customer?.current_balance || 0;
      const finalBalance = previousBalance + total;

      // Create/Update Sale Order
      const orderData = {
        user_id: user.id,
        order_no: formData.order_no,
        customer_id: parseInt(formData.customer_id),
        customer_po: formData.customer_po,
        order_date: formData.order_date,
        delivery_date: formData.delivery_date,
        subtotal: subtotal,
        gst_percentage: formData.gst_percentage,
        gst_amount: gstAmount,
        total_amount: total,
        status: saveAs,
        bill_situation: formData.bill_situation,
        notes: formData.special_note,
      };

      let order;
      if (editingOrderId) {
        const { data, error } = await supabase
          .from('sale_orders')
          .update(orderData)
          .eq('id', editingOrderId)
          .select()
          .single();

        if (error) throw error;
        order = data;

        // Delete existing order items
        await supabase.from('sale_order_items').delete().eq('order_id', editingOrderId);
      } else {
        const { data, error } = await supabase
          .from('sale_orders')
          .insert([orderData])
          .select()
          .single();

        if (error) throw error;
        order = data;
      }

      // Insert order items
      const orderItemsData = validItems.map(item => ({
        user_id: user.id,
        order_id: order.id,
        product_id: parseInt(item.product_id),
        product_name: item.product_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
      }));

      if (orderItemsData.length > 0) {
        const { error: orderItemsError } = await supabase.from('sale_order_items').insert(orderItemsData);
        if (orderItemsError) throw orderItemsError;
      }

      // Create Invoice if option is enabled and saving as finalized
      let invoice = null;
      if (createInvoice && saveAs === 'finalized') {
        const invoiceData = {
          user_id: user.id,
          invoice_no: formData.invoice_no,
          order_id: order.id,
          customer_id: parseInt(formData.customer_id),
          customer_po: formData.customer_po,
          invoice_date: formData.order_date,
          delivery_date: formData.delivery_date,
          subtotal: subtotal,
          gst_percentage: formData.gst_percentage,
          gst_amount: gstAmount,
          total_amount: total,
          previous_balance: previousBalance,
          final_balance: finalBalance,
          status: 'finalized',
          bill_situation: formData.bill_situation,
          notes: formData.special_note,
        };

        const { data: invoiceResult, error: invoiceError } = await supabase
          .from('sales_invoices')
          .insert([invoiceData])
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoice = invoiceResult;

        // Insert invoice items
        const invoiceItemsData = validItems.map(item => ({
          user_id: user.id,
          invoice_id: invoice.id,
          product_id: parseInt(item.product_id),
          product_name: item.product_name,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
        }));

        if (invoiceItemsData.length > 0) {
          const { error: invoiceItemsError } = await supabase.from('sales_invoice_items').insert(invoiceItemsData);
          if (invoiceItemsError) throw invoiceItemsError;
        }

        // Update customer balance and ledger
        if (formData.bill_situation === 'added_to_account') {
          await supabase
            .from('customers')
            .update({ current_balance: finalBalance, last_order_date: formData.order_date })
            .eq('id', formData.customer_id);

          await supabase.from('customer_ledger').insert([{
            user_id: user.id,
            customer_id: parseInt(formData.customer_id),
            transaction_type: 'invoice',
            transaction_date: formData.order_date,
            reference_id: invoice.id,
            reference_no: formData.invoice_no,
            debit: total,
            credit: 0,
            balance: finalBalance,
            description: `Invoice ${formData.invoice_no} (Order ${formData.order_no})`,
          }]);
        }

        // Update settings with next numbers
        if (settings) {
          await supabase
            .from('settings')
            .update({
              sale_order_next_number: (settings.sale_order_next_number || 1) + 1,
              sale_invoice_next_number: (settings.sale_invoice_next_number || 1) + 1
            })
            .eq('user_id', user.id);
        }
      } else if (saveAs === 'finalized' && !createInvoice) {
        // Only update order number if not creating invoice
        if (settings) {
          await supabase
            .from('settings')
            .update({
              sale_order_next_number: (settings.sale_order_next_number || 1) + 1
            })
            .eq('user_id', user.id);
        }
      }

      const message = saveAs === 'draft'
        ? 'Saved as draft'
        : createInvoice
          ? 'Order & Invoice created'
          : 'Order created';

      toast.success(message, {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      // Download PDF if requested
      if (shouldDownloadPdf && saveAs === 'finalized' && invoice) {
        await handleDownloadPDF(invoice.id);
      }

      // Refresh drafts list
      await fetchDrafts(user.id);

      if (saveAs !== 'draft') {
        // Refresh settings to get updated next numbers
        await fetchSettings(user.id);
        resetForm();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPDF(invoiceId) {
    try {
      const { data: invoice } = await supabase
        .from('sales_invoices')
        .select('*, customers(customer_name, mobile_no, address)')
        .eq('id', invoiceId)
        .single();

      const { data: items } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      await downloadInvoicePDF(invoice, items, settings, { showLogo, showQR });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to generate PDF: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  async function handleDeleteDraft(draftId) {
    try {
      await supabase.from('sale_order_items').delete().eq('order_id', draftId);
      await supabase.from('sale_orders').delete().eq('id', draftId);

      setDrafts(prev => prev.filter(d => d.id !== draftId));
      toast.success('Draft deleted', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      toast.error('Error deleting draft', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  function resetForm() {
    setFormData({
      order_no: generateOrderNo(settings),
      invoice_no: generateInvoiceNo(settings),
      customer_id: '',
      customer_po: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date().toISOString().split('T')[0],
      gst_percentage: 18,
      bill_situation: 'pending',
      items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }],
      special_note: '',
    });
    setEditingOrderId(null);
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  };

  // Prepare dropdown options
  const customerOptions = customers.map(c => ({ value: c.id.toString(), label: c.customer_name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: p.name }));

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
              {editingOrderId ? 'Edit Sale Order' : 'New Sale Order'}
            </h1>
            <p className="text-xs text-neutral-500">Create a new sale order with invoice</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDrafts(!showDrafts)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              "border border-neutral-200/60",
              "transition-all duration-200",
              "flex items-center gap-1.5",
              showDrafts ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Drafts ({drafts.length})
          </button>
        </div>

        {/* Drafts Section */}
        {showDrafts && drafts.length > 0 && (
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "p-3"
          )}>
            <h3 className="text-xs font-semibold text-neutral-700 mb-2">Saved Drafts</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {drafts.map(draft => (
                <div key={draft.id} className="flex items-center justify-between p-2 bg-neutral-50/80 rounded-lg">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-neutral-900">{draft.order_no}</div>
                    <div className="text-[10px] text-neutral-500">
                      {draft.customers?.customer_name || 'No customer'} • {formatCurrency(draft.total_amount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => loadOrderForEdit(draft.id, user.id)}
                      className="p-1 text-neutral-500 hover:text-neutral-900 rounded transition-all"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="p-1 text-neutral-500 hover:text-red-500 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, 'finalized', true)}>
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "p-3"
          )}>
            {/* Top Fields - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Order #</label>
                <input
                  type="text"
                  name="order_no"
                  value={formData.order_no}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Invoice #</label>
                <input
                  type="text"
                  name="invoice_no"
                  value={formData.invoice_no}
                  onChange={handleChange}
                  disabled={!createInvoice}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200",
                    !createInvoice && "opacity-50"
                  )}
                />
              </div>

              <div>
                <SearchableDropdown
                  label={<span className="text-xs font-medium text-neutral-700">Customer *</span>}
                  options={customerOptions}
                  value={formData.customer_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, customer_id: val }))}
                  placeholder="Select Customer"
                  searchPlaceholder="Search customer..."
                  onQuickAdd={handleQuickAddCustomer}
                  quickAddLabel="Add customer"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Customer PO</label>
                <input
                  type="text"
                  name="customer_po"
                  value={formData.customer_po}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Order Date</label>
                <input
                  type="date"
                  name="order_date"
                  value={formData.order_date}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-blue-600 mb-1">GST %</label>
                <input
                  type="number"
                  name="gst_percentage"
                  value={formData.gst_percentage}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            {/* Items Table - Ultra Compact */}
            <div className="mb-3">
              <div className="rounded-lg border border-neutral-200/60" style={{ overflow: 'visible' }}>
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50/80">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-neutral-600 w-6">#</th>
                      <th className="px-2 py-1.5 text-left font-medium text-neutral-600">Product</th>
                      <th className="px-2 py-1.5 text-left font-medium text-neutral-600 w-20">Category</th>
                      <th className="px-2 py-1.5 text-center font-medium text-neutral-600 w-16">QTY</th>
                      <th className="px-2 py-1.5 text-center font-medium text-neutral-600 w-20">Price</th>
                      <th className="px-2 py-1.5 text-right font-medium text-neutral-600 w-24">Amount</th>
                      <th className="px-1 py-1.5 w-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {formData.items.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50/50" style={{ position: 'relative' }}>
                        <td className="px-2 py-1 text-neutral-400">{index + 1}</td>
                        <td className="px-1 py-1" style={{ overflow: 'visible', position: 'relative' }}>
                          <SearchableDropdown
                            options={productOptions}
                            value={item.product_id}
                            onChange={(val) => handleProductChange(index, val)}
                            placeholder="Select Product"
                            searchPlaceholder="Search product..."
                            onQuickAdd={(name) => handleQuickAddProduct(name, index)}
                            quickAddLabel="Add product"
                            allowClear={false}
                            className="text-xs"
                            onOpenAddModal={(searchQuery) => handleOpenAddProductModal(searchQuery, index)}
                            addModalLabel="Add New Product"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <span className="text-[10px] text-neutral-500 truncate block">{item.category || '-'}</span>
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className={cn(
                              "w-full px-1.5 py-1 text-xs text-center",
                              "bg-white border border-neutral-200/60 rounded",
                              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                              "transition-all duration-200"
                            )}
                            min="1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                            className={cn(
                              "w-full px-1.5 py-1 text-xs text-center",
                              "bg-white border border-neutral-200/60 rounded",
                              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                              "transition-all duration-200"
                            )}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <span className="font-medium text-neutral-900">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </span>
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-0.5 text-neutral-500 hover:text-red-500 rounded transition-all"
                            disabled={formData.items.length === 1}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addItem}
                className={cn(
                  "mt-2 px-2 py-1 rounded-lg text-[10px] font-medium",
                  "bg-neutral-100/80 text-neutral-600",
                  "hover:bg-neutral-200/80",
                  "transition-all duration-200",
                  "flex items-center gap-1"
                )}
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>

            {/* Totals & Actions - Compact */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-2 text-center">
                <div className="text-[9px] text-neutral-500 uppercase">Subtotal</div>
                <div className="text-xs font-semibold text-neutral-900">{formatCurrency(subtotal)}</div>
              </div>
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-2 text-center">
                <div className="text-[9px] text-blue-600 uppercase">GST ({formData.gst_percentage}%)</div>
                <div className="text-xs font-semibold text-blue-700">{formatCurrency(gstAmount)}</div>
              </div>
              <div className="bg-neutral-900 rounded-lg p-2 text-center">
                <div className="text-[9px] text-neutral-400 uppercase">Total</div>
                <div className="text-xs font-semibold text-white">{formatCurrency(total)}</div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">Delivery</label>
                <input
                  type="date"
                  name="delivery_date"
                  value={formData.delivery_date}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">Status</label>
                <select
                  name="bill_situation"
                  value={formData.bill_situation}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="pending">Pending</option>
                  <option value="added_to_account">Add to Account</option>
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5 justify-end">
                <div className="flex items-center gap-2">
                  <label className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer",
                    "bg-neutral-50/80 border border-neutral-200/60",
                    "hover:bg-neutral-100/80",
                    "transition-all duration-200"
                  )}>
                    <input
                      type="checkbox"
                      checked={createInvoice}
                      onChange={(e) => setCreateInvoice(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                    />
                    <span className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                      <Receipt className="w-3 h-3" />
                      Create Invoice
                    </span>
                  </label>
                  {createInvoice && (
                    <label className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer",
                      "bg-neutral-50/80 border border-neutral-200/60",
                      "hover:bg-neutral-100/80",
                      "transition-all duration-200"
                    )}>
                      <input
                        type="checkbox"
                        checked={downloadPdf}
                        onChange={(e) => setDownloadPdf(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                      />
                      <span className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        Download PDF
                      </span>
                    </label>
                  )}
                </div>
                {createInvoice && downloadPdf && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => setShowLogo(e.target.checked)}
                        className="w-3 h-3 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                      />
                      <span className="text-[10px] text-neutral-600">Logo</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showQR}
                        onChange={(e) => setShowQR(e.target.checked)}
                        className="w-3 h-3 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                      />
                      <span className="text-[10px] text-neutral-600">QR Code</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Special Notes */}
            <div className="mb-3">
              <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">Special Notes</label>
              <textarea
                name="special_note"
                value={formData.special_note}
                onChange={handleChange}
                rows={2}
                className={cn(
                  "w-full px-2 py-1.5 text-xs",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                  "transition-all duration-200 resize-none"
                )}
                placeholder="Add any special notes here..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {createInvoice && downloadPdf && (
                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg font-medium text-xs",
                    "bg-neutral-900 text-white",
                    "shadow-lg shadow-neutral-900/20",
                    "hover:bg-neutral-800",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save & Download'}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'finalized', false)}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg font-medium text-xs",
                  "bg-neutral-700 text-white",
                  "hover:bg-neutral-600",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-1.5"
                )}
              >
                <Save className="w-3.5 h-3.5" />
                {createInvoice ? 'Save Order & Invoice' : 'Save Order'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'draft', false)}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg font-medium text-xs",
                  "bg-white border border-neutral-200/60 text-neutral-700",
                  "hover:bg-neutral-50",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-1.5"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Save Draft
              </button>
              {editingOrderId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className={cn(
                    "px-3 py-2 rounded-lg font-medium text-xs",
                    "bg-white border border-neutral-200/60 text-neutral-700",
                    "hover:bg-neutral-50",
                    "transition-all duration-200",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setAddProductIndex(null);
          setAddProductInitialName('');
        }}
        onProductAdded={handleProductAddedFromModal}
        userId={user?.id}
        initialName={addProductInitialName}
      />
    </DashboardLayout>
  );
}
