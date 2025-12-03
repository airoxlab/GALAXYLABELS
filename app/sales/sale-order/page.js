'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, FileText, X, Download, Receipt, Printer, Eye, Loader2 } from 'lucide-react';
import { useDraftsPanel } from '@/components/ui/DraftsPanel';
import { downloadInvoicePDF, downloadSaleOrderPDF } from '@/components/sales/InvoicePDF';
import AddProductModal from '@/components/ui/AddProductModal';
import AddCustomerModal from '@/components/ui/AddCustomerModal';
import { usePermissions } from '@/hooks/usePermissions';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function NewSaleOrderPage() {
  const router = useRouter();
  const { hasPermission, isSuperadmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerInitialName, setAddCustomerInitialName] = useState('');

  // Permission checks for add actions
  const canAddProduct = isSuperadmin || hasPermission('products_add');
  const canAddCustomer = isSuperadmin || hasPermission('customers_add');

  const [formData, setFormData] = useState({
    order_no: '',
    customer_id: '',
    customer_po: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    gst_percentage: 18,
    bill_situation: 'credit',
    box: '',
    items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0, weight: 0, unit: '' }],
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
        // Use parentUserId for data queries (staff sees parent account data)
        const dataUserId = data.user.parentUserId || data.user.id;
        await fetchData(dataUserId);
        await fetchSettings(dataUserId);
        await fetchDrafts(dataUserId);

        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        if (editId) {
          await loadOrderForEdit(editId, dataUserId);
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
            weight,
            available_stock,
            category_id,
            unit_id,
            categories (
              id,
              name
            ),
            units (
              id,
              name,
              symbol
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
        order_no: generateOrderNo(data)
      }));
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use default numbers if settings not found
      setFormData(prev => ({
        ...prev,
        order_no: generateOrderNo(null)
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
        .select('*, products(categories(name), units(symbol, name))')
        .eq('order_id', orderId);

      const loadedItems = items.length > 0 ? items.map(item => ({
        product_id: item.product_id?.toString() || '',
        product_name: item.product_name || '',
        category: item.products?.categories?.name || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        weight: item.weight || 0,
        unit: item.unit || item.products?.units?.symbol || item.products?.units?.name || '',
      })) : [];

      // Fill remaining slots to maintain minimum rows
      while (loadedItems.length < 1) {
        loadedItems.push({ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0, weight: 0, unit: '' });
      }

      setFormData(prev => ({
        ...prev,
        order_no: order.order_no,
        customer_id: order.customer_id?.toString() || '',
        customer_po: order.customer_po || '',
        order_date: order.order_date,
        delivery_date: order.delivery_date || new Date().toISOString().split('T')[0],
        gst_percentage: order.gst_percentage || 18,
        bill_situation: order.bill_situation || 'credit',
        box: order.box || '',
        items: loadedItems,
        special_note: order.notes || '',
      }));

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
        weight: product.weight || 0,
        unit: product.units?.symbol || product.units?.name || '',
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        product_name: '',
        category: '',
        unit_price: 0,
        weight: 0,
        unit: '',
      };
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleItemChange = async (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));

    // Update product price in database when unit_price is changed
    if (field === 'unit_price' && newItems[index].product_id) {
      try {
        const newPrice = parseFloat(value);
        if (!isNaN(newPrice) && newPrice >= 0) {
          await supabase
            .from('products')
            .update({ unit_price: newPrice })
            .eq('id', parseInt(newItems[index].product_id));
        }
      } catch (error) {
        console.error('Error updating product price:', error);
      }
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0, weight: 0, unit: '' }]
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
    const totalNetWeight = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.weight || 0));
    }, 0);
    return { subtotal, gstAmount, total, totalNetWeight };
  };

  const { subtotal, gstAmount, total, totalNetWeight } = calculateTotals();

  async function handleQuickAddCustomer(name) {
    if (!name.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ user_id: user.parentUserId || user.id, customer_name: name.trim(), is_active: true, current_balance: 0 }])
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
        .insert([{ user_id: user.parentUserId || user.id, name: name.trim(), is_active: true, unit_price: 0, current_stock: 0 }])
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

  function handleOpenAddCustomerModal(searchQuery) {
    setAddCustomerInitialName(searchQuery || '');
    setShowAddCustomerModal(true);
  }

  function handleCustomerAddedFromModal(customerData) {
    // Add to customers list
    setCustomers(prev => [...prev, customerData].sort((a, b) => a.customer_name.localeCompare(b.customer_name)));
    // Set the newly added customer as selected
    setFormData(prev => ({ ...prev, customer_id: customerData.id.toString() }));
  }

  async function handleSubmit(e, saveAs = 'finalized', shouldDownloadPdf = false, shouldPrint = false) {
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
      // Create/Update Sale Order - use parentUserId for data queries
      const orderData = {
        user_id: user.parentUserId || user.id,
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
        box: formData.box || null,
        notes: formData.special_note,
      };

      let order;
      let previousBalance = 0;
      let finalBalance = total;

      if (editingOrderId) {
        // For editing: fetch customer + update order + delete items in parallel
        const [customerResult, orderResult, deleteResult] = await Promise.all([
          supabase.from('customers').select('current_balance').eq('id', formData.customer_id).single(),
          supabase.from('sale_orders').update(orderData).eq('id', editingOrderId).select().single(),
          supabase.from('sale_order_items').delete().eq('order_id', editingOrderId)
        ]);

        if (orderResult.error) throw orderResult.error;
        if (deleteResult.error) throw deleteResult.error;
        order = orderResult.data;
        previousBalance = customerResult.data?.current_balance || 0;
        finalBalance = previousBalance + total;
      } else {
        // For new order: fetch customer + insert order in parallel
        const [customerResult, orderResult] = await Promise.all([
          supabase.from('customers').select('current_balance').eq('id', formData.customer_id).single(),
          supabase.from('sale_orders').insert([orderData]).select().single()
        ]);

        if (orderResult.error) throw orderResult.error;
        order = orderResult.data;
        previousBalance = customerResult.data?.current_balance || 0;
        finalBalance = previousBalance + total;
      }

      // Insert order items
      const orderItemsData = validItems.map(item => ({
        user_id: user.parentUserId || user.id,
        order_id: order.id,
        product_id: parseInt(item.product_id),
        product_name: item.product_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
        weight: parseFloat(item.weight) || 0,
        net_weight: parseFloat(item.quantity) * parseFloat(item.weight || 0),
      }));

      // Insert order items
      if (orderItemsData.length > 0) {
        const orderItemsResult = await supabase.from('sale_order_items').insert(orderItemsData);
        if (orderItemsResult.error) throw orderItemsResult.error;
      }

      // Prepare all parallel operations for finalized orders
      const parallelOperations = [];

      // Update customer balance and create ledger entry for finalized orders
      if (saveAs === 'finalized') {
        // Only update customer balance if credit (customer owes money)
        if (formData.bill_situation === 'credit') {
          parallelOperations.push(
            supabase
              .from('customers')
              .update({ current_balance: finalBalance, last_order_date: formData.order_date })
              .eq('id', formData.customer_id)
          );
        } else {
          // For cash orders (paid), just update last order date without changing balance
          parallelOperations.push(
            supabase
              .from('customers')
              .update({ last_order_date: formData.order_date })
              .eq('id', formData.customer_id)
          );
        }

        // Create ledger entry for ALL finalized orders (regardless of bill_situation)
        // Use balance based on bill_situation: if cash, balance doesn't change
        const ledgerBalance = formData.bill_situation === 'credit' ? finalBalance : previousBalance;
        parallelOperations.push(
          supabase.from('customer_ledger').insert([{
            user_id: user.parentUserId || user.id,
            customer_id: parseInt(formData.customer_id),
            transaction_type: 'sale_order',
            transaction_date: formData.order_date,
            reference_id: order.id,
            reference_no: formData.order_no,
            debit: formData.bill_situation === 'credit' ? total : 0,
            credit: 0,
            balance: ledgerBalance,
            description: `Sale Order ${formData.order_no}${formData.bill_situation === 'cash' ? ' (Cash)' : ''}`,
          }])
        );
      }

      // Auto-deduct stock for finalized orders
      if (saveAs === 'finalized') {
        const stockOutRecords = validItems.map(item => ({
          user_id: user.parentUserId || user.id,
          date: formData.order_date,
          product_id: parseInt(item.product_id),
          warehouse_id: null,
          quantity: parseFloat(item.quantity),
          reference_type: 'sale_order',
          reference_no: formData.order_no,
          customer_id: parseInt(formData.customer_id),
          notes: `Auto-generated from Sale Order ${formData.order_no}`,
          created_by: user.parentUserId || user.id,
        }));

        parallelOperations.push(
          supabase.from('stock_out').insert(stockOutRecords)
        );
      }

      // Update settings with next order number
      if (settings && saveAs === 'finalized') {
        parallelOperations.push(
          supabase
            .from('settings')
            .update({
                sale_order_next_number: (settings.sale_order_next_number || 1) + 1
              })
              .eq('user_id', user.parentUserId || user.id)
          );
      }

      // Execute all parallel operations for finalized orders
      if (saveAs === 'finalized' && parallelOperations.length > 0) {
        const results = await Promise.all(parallelOperations);

        // Check for errors (except stock which is non-critical)
        results.forEach((result, index) => {
          if (result.error) {
            // Stock insert is the 4th operation (index 3 or after customer ops)
            if (result.error.message?.includes('stock')) {
              console.error('Error deducting stock:', result.error);
            } else {
              console.error('Operation failed:', result.error);
            }
          }
        });
      }

      const message = saveAs === 'draft'
        ? 'Saved as draft'
        : 'Sale Order created';

      toast.success(message, {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      // Download or Print PDF if requested
      if ((shouldDownloadPdf || shouldPrint) && saveAs === 'finalized' && order) {
        await handleDownloadPDF(order.id, shouldPrint);
      }

      // Set editing order ID so subsequent saves update this order
      setEditingOrderId(order.id);

      // Refresh data
      fetchDrafts(user.parentUserId || user.id);
      fetchSettings(user.parentUserId || user.id);
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

  async function handleDownloadPDF(invoiceId, shouldPrint = false) {
    try {
      const { data: order } = await supabase
        .from('sale_orders')
        .select('*, customers(customer_name, mobile_no, address, ntn, str)')
        .eq('id', invoiceId)
        .single();

      const { data: items } = await supabase
        .from('sale_order_items')
        .select('*, products(categories(name))')
        .eq('order_id', invoiceId);

      await downloadSaleOrderPDF(order, items, settings, { showLogo: true }, shouldPrint);
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
      customer_id: '',
      customer_po: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date().toISOString().split('T')[0],
      gst_percentage: 18,
      bill_situation: 'credit',
      box: '',
      items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0, weight: 0, unit: '' }],
      special_note: '',
    });
    setEditingOrderId(null);
  }

  async function handleSaveAndClose(e, saveAs = 'finalized', shouldDownloadPdf = false, shouldPrint = false) {
    await handleSubmit(e, saveAs, shouldDownloadPdf, shouldPrint);
    // After saving, reset the form
    resetForm();
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  };

  // Drafts panel hook
  const { ToggleButton: DraftsToggle, Panel: DraftsPanel } = useDraftsPanel({
    drafts,
    onEdit: (id) => loadOrderForEdit(id, user?.parentUserId || user?.id),
    onDelete: handleDeleteDraft,
    formatCurrency,
    type: 'sale',
    orderNoField: 'order_no',
    entityField: 'customers',
    entityNameField: 'customer_name',
  });

  // Preview function
  function handlePreview() {
    if (!formData.customer_id) {
      toast.error('Please select a customer first', {
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

    setShowPreview(true);
  }

  // Get selected customer name
  const selectedCustomer = customers.find(c => c.id.toString() === formData.customer_id);

  // Prepare dropdown options
  const customerOptions = customers.map(c => ({ value: c.id.toString(), label: c.customer_name }));
  const productOptions = products.map(p => ({
    value: p.id.toString(),
    label: `${p.name} (Stock: ${p.available_stock || 0})`
  }));

  return (
    <ProtectedRoute requiredPermission="sales_order_view" showUnauthorized>
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
              {editingOrderId ? 'Edit Sale Order' : 'New Sale Order'}
            </h1>
            <p className="text-sm text-neutral-500">Create a new sale order with invoice</p>
          </div>
          <div className="flex items-center gap-2">
            {DraftsToggle}
            {editingOrderId && (
              <button
                type="button"
                onClick={resetForm}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium",
                  "border border-neutral-200/60",
                  "bg-blue-500 text-white hover:bg-blue-600",
                  "transition-all duration-200",
                  "flex items-center gap-1.5"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                New Order
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/sales')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium",
                "bg-gradient-to-br from-neutral-800 to-neutral-900 text-white",
                "hover:from-neutral-700 hover:to-neutral-800",
                "transition-all duration-200",
                "flex items-center gap-1.5"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>

        {/* Drafts Section */}
        {DraftsPanel}

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, 'finalized', true)} autoComplete="off">
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "p-5"
          )}>
            {/* Top Fields */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Order #</label>
                <input
                  type="text"
                  name="order_no"
                  value={formData.order_no}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Customer *</label>
                <SearchableDropdown
                  options={customerOptions}
                  value={formData.customer_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, customer_id: val }))}
                  placeholder="Select Customer"
                  searchPlaceholder="Search customer..."
                  onQuickAdd={canAddCustomer ? handleQuickAddCustomer : undefined}
                  quickAddLabel={canAddCustomer ? "Add customer" : undefined}
                  onOpenAddModal={canAddCustomer ? handleOpenAddCustomerModal : undefined}
                  addModalLabel={canAddCustomer ? "Add New Customer" : undefined}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Customer PO</label>
                <input
                  type="text"
                  name="customer_po"
                  value={formData.customer_po}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Box</label>
                <input
                  type="text"
                  name="box"
                  value={formData.box}
                  onChange={handleChange}
                  placeholder="Optional"
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Order Date</label>
                <input
                  type="date"
                  name="order_date"
                  value={formData.order_date}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">GST %</label>
                <input
                  type="number"
                  name="gst_percentage"
                  value={formData.gst_percentage}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-5">
              <div className="rounded-xl border border-neutral-200/60" style={{ overflow: 'visible' }}>
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50/80">
                    <tr>
                      <th className="px-3 py-3 text-left font-medium text-neutral-600 w-8">#</th>
                      <th className="px-3 py-3 text-left font-medium text-neutral-600" style={{ width: '32%' }}>Product</th>
                      <th className="px-3 py-3 text-left font-medium text-neutral-600 w-24">Category</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-16">Unit</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-16">QTY</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-20">Price</th>
                      <th className="px-3 py-3 text-right font-medium text-neutral-600 w-24">Amount</th>
                      <th className="px-2 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {formData.items.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50/50" style={{ position: 'relative' }}>
                        <td className="px-3 py-2.5 text-neutral-400">{index + 1}</td>
                        <td className="px-2 py-2.5" style={{ overflow: 'visible', position: 'relative' }}>
                          <SearchableDropdown
                            options={productOptions}
                            value={item.product_id}
                            onChange={(val) => handleProductChange(index, val)}
                            placeholder="Select Product"
                            searchPlaceholder="Search product..."
                            onQuickAdd={canAddProduct ? (name) => handleQuickAddProduct(name, index) : undefined}
                            quickAddLabel={canAddProduct ? "Add product" : undefined}
                            allowClear={false}
                            className="text-sm"
                            onOpenAddModal={canAddProduct ? (searchQuery) => handleOpenAddProductModal(searchQuery, index) : undefined}
                            addModalLabel={canAddProduct ? "Add New Product" : undefined}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-neutral-500 truncate block">{item.category || '-'}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-xs text-neutral-600 text-center block">{item.unit || '-'}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className={cn(
                              "w-full px-2 py-2 text-sm text-center",
                              "bg-white border border-neutral-200/60 rounded-lg",
                              "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                              "transition-all duration-200"
                            )}
                            min="1"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                            className={cn(
                              "w-full px-2 py-2 text-sm text-center",
                              "bg-white border border-neutral-200/60 rounded-lg",
                              "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                              "transition-all duration-200"
                            )}
                            step="0.01"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-medium text-neutral-900">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 text-neutral-500 hover:text-red-500 rounded transition-all"
                            disabled={formData.items.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
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
                  "mt-3 px-3 py-2 rounded-lg text-xs font-medium",
                  "bg-neutral-100/80 text-neutral-600",
                  "hover:bg-neutral-200/80",
                  "transition-all duration-200",
                  "flex items-center gap-1.5"
                )}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {/* Totals & Actions */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-xl p-3 text-center">
                <div className="text-xs text-neutral-500 uppercase font-medium">Subtotal</div>
                <div className="text-sm font-semibold text-neutral-900 mt-1">{formatCurrency(subtotal)}</div>
              </div>
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-3 text-center">
                <div className="text-xs text-blue-600 uppercase font-medium">GST ({formData.gst_percentage}%)</div>
                <div className="text-sm font-semibold text-blue-700 mt-1">{formatCurrency(gstAmount)}</div>
              </div>
              <div className="bg-neutral-900 rounded-xl p-3 text-center">
                <div className="text-xs text-neutral-400 uppercase font-medium">Total</div>
                <div className="text-sm font-semibold text-white mt-1">{formatCurrency(total)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
                <select
                  name="bill_situation"
                  value={formData.bill_situation}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
            </div>

            {/* Special Notes */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Special Notes</label>
              <textarea
                name="special_note"
                value={formData.special_note}
                onChange={handleChange}
                rows={3}
                className={cn(
                  "w-full px-3 py-2.5 text-sm",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                  "transition-all duration-200 resize-none"
                )}
                placeholder="Add any special notes here..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl font-medium text-sm",
                  "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
                  "shadow-lg shadow-blue-500/20",
                  "hover:from-blue-600 hover:to-indigo-700",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'finalized', true, true)}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl font-medium text-sm",
                  "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
                  "shadow-lg shadow-violet-500/20",
                  "hover:from-violet-600 hover:to-purple-700",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                <Printer className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save & Print'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSaveAndClose(e, 'finalized', false)}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl font-medium text-sm",
                  "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
                  "shadow-lg shadow-emerald-500/20",
                  "hover:from-emerald-600 hover:to-teal-700",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'draft', false)}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl font-medium text-sm",
                  "bg-white border border-neutral-200/60 text-neutral-700",
                  "hover:bg-neutral-50",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                <FileText className="w-4 h-4" />
                Save Draft
              </button>
              {editingOrderId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className={cn(
                    "px-3 py-2.5 rounded-xl font-medium text-sm",
                    "bg-white border border-neutral-200/60 text-neutral-700",
                    "hover:bg-neutral-50",
                    "transition-all duration-200",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  <X className="w-4 h-4" />
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

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => {
          setShowAddCustomerModal(false);
          setAddCustomerInitialName('');
        }}
        onCustomerAdded={handleCustomerAddedFromModal}
        userId={user?.id}
        initialName={addCustomerInitialName}
      />

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Preview Header */}
              <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Order Preview</h2>
                    <p className="text-sm text-neutral-500">{formData.order_no}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="p-6 space-y-6">
                {/* Company & Invoice Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900">{settings?.company_name || 'Company Name'}</h3>
                    <p className="text-sm text-neutral-600">{settings?.address || ''}</p>
                    <p className="text-sm text-neutral-600">{settings?.phone || ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-600">SALE ORDER</div>
                    <p className="text-sm text-neutral-600">PO #: {formData.order_no}</p>
                    <p className="text-sm text-neutral-600">Date: {new Date(formData.order_date).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-neutral-700 mb-2">Bill To:</h4>
                  <p className="text-lg font-semibold text-neutral-900">{selectedCustomer?.customer_name || '-'}</p>
                  {formData.customer_po && (
                    <p className="text-sm text-neutral-600">PO: {formData.customer_po}</p>
                  )}
                </div>

                {/* Items Table */}
                <div className="rounded-xl border border-neutral-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-neutral-900 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">Unit</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">Qty</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Price</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {formData.items.filter(item => item.product_id).map((item, index) => (
                        <tr key={index} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm text-neutral-600">{index + 1}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-neutral-900">{item.product_name}</div>
                            {item.category && (
                              <div className="text-xs text-neutral-500">{item.category}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-neutral-600">{item.unit || '-'}</td>
                          <td className="px-4 py-3 text-center text-sm text-neutral-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-sm text-neutral-700">Rs {formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">Rs {formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between py-2 border-b border-neutral-200">
                      <span className="text-sm text-neutral-600">Subtotal</span>
                      <span className="text-sm font-semibold text-neutral-900">Rs {formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-200">
                      <span className="text-sm text-neutral-600">GST ({formData.gst_percentage}%)</span>
                      <span className="text-sm font-semibold text-blue-600">Rs {formatCurrency(gstAmount)}</span>
                    </div>
                    <div className="flex justify-between py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg px-4 -mx-4">
                      <span className="text-sm font-semibold text-white">Total</span>
                      <span className="text-lg font-bold text-white">Rs {formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {formData.special_note && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-amber-700 mb-1">Notes:</h4>
                    <p className="text-sm text-amber-900">{formData.special_note}</p>
                  </div>
                )}
              </div>

              {/* Preview Footer Actions */}
              <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => setShowPreview(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-white border border-neutral-200 text-neutral-700",
                    "hover:bg-neutral-50 transition-all"
                  )}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    // Trigger print with window.print() simulation
                    const event = { preventDefault: () => {} };
                    handleSubmit(event, 'finalized', false, true);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
                    "hover:from-violet-600 hover:to-purple-700 transition-all",
                    "flex items-center gap-2"
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
    </ProtectedRoute>
  );
}
