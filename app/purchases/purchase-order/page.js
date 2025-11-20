'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, FileText, X, Edit3, Clock, Download } from 'lucide-react';
import { downloadPurchaseOrderPDF } from '@/components/purchases/PurchasePDF';
import AddProductModal from '@/components/ui/AddProductModal';

export default function NewPurchaseOrderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [downloadPdf, setDownloadPdf] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');

  const [formData, setFormData] = useState({
    po_no: '',
    supplier_id: '',
    po_date: new Date().toISOString().split('T')[0],
    receiving_date: new Date().toISOString().split('T')[0],
    currency_code: 'PKR',
    is_gst: true,
    gst_percentage: 17,
    status: 'pending',
    items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }],
    notes: '',
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

  // Generate PO number using settings prefix
  function generatePONo(settingsData) {
    const prefix = settingsData?.purchase_order_prefix || 'PO';
    const nextNumber = settingsData?.purchase_order_next_number || 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  async function fetchData(userId) {
    if (!userId) {
      console.error('No userId provided to fetchData');
      return;
    }

    try {
      const [suppliersRes, productsRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select('id, supplier_name')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('supplier_name'),
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

      if (suppliersRes.error) throw suppliersRes.error;
      if (productsRes.error) throw productsRes.error;

      setSuppliers(suppliersRes.data || []);
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

      // Set initial PO number based on settings
      setFormData(prev => ({
        ...prev,
        po_no: generatePONo(data)
      }));
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use default numbers if settings not found
      setFormData(prev => ({
        ...prev,
        po_no: generatePONo(null)
      }));
    }
  }

  async function fetchDrafts(userId) {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_no, po_date, total_amount, suppliers(supplier_name)')
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
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (orderError) throw orderError;

      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('*, products(categories(name))')
        .eq('po_id', orderId);

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
        po_no: order.po_no,
        supplier_id: order.supplier_id?.toString() || '',
        po_date: order.po_date,
        receiving_date: order.receiving_date || new Date().toISOString().split('T')[0],
        currency_code: order.currency_code || 'PKR',
        is_gst: order.is_gst !== false,
        gst_percentage: order.gst_percentage || 17,
        status: order.status || 'pending',
        items: loadedItems,
        notes: order.notes || '',
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
    const gstAmount = formData.is_gst ? (subtotal * parseFloat(formData.gst_percentage || 0)) / 100 : 0;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  async function handleQuickAddSupplier(name) {
    if (!name.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{ user_id: user.id, supplier_name: name.trim(), is_active: true, current_balance: 0 }])
        .select()
        .single();

      if (error) throw error;
      setSuppliers(prev => [...prev, data].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
      setFormData(prev => ({ ...prev, supplier_id: data.id.toString() }));
      toast.success('Supplier added', {
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

  async function handleSubmit(e, saveAs = 'pending', shouldDownloadPdf = false) {
    e.preventDefault();
    if (!user) return;

    if (!formData.supplier_id) {
      toast.error('Please select a supplier', {
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
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('current_balance')
        .eq('id', formData.supplier_id)
        .single();

      const previousBalance = supplier?.current_balance || 0;
      const finalPayable = previousBalance + total;

      // Create/Update Purchase Order
      const orderData = {
        user_id: user.id,
        po_no: formData.po_no,
        supplier_id: parseInt(formData.supplier_id),
        po_date: formData.po_date,
        receiving_date: formData.receiving_date || null,
        currency_code: formData.currency_code,
        is_gst: formData.is_gst,
        gst_percentage: formData.gst_percentage,
        subtotal: subtotal,
        gst_amount: gstAmount,
        total_amount: total,
        previous_balance: previousBalance,
        final_payable: finalPayable,
        status: saveAs,
        notes: formData.notes,
      };

      let order;
      if (editingOrderId) {
        const { data, error } = await supabase
          .from('purchase_orders')
          .update(orderData)
          .eq('id', editingOrderId)
          .select()
          .single();

        if (error) throw error;
        order = data;

        // Delete existing order items
        await supabase.from('purchase_order_items').delete().eq('po_id', editingOrderId);
      } else {
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert([orderData])
          .select()
          .single();

        if (error) throw error;
        order = data;
      }

      // Insert order items
      const orderItemsData = validItems.map(item => ({
        user_id: user.id,
        po_id: order.id,
        product_id: parseInt(item.product_id),
        product_name: item.product_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
      }));

      if (orderItemsData.length > 0) {
        const { error: orderItemsError } = await supabase.from('purchase_order_items').insert(orderItemsData);
        if (orderItemsError) throw orderItemsError;
      }

      // Update supplier balance and ledger if not a draft
      if (saveAs !== 'draft') {
        await supabase
          .from('suppliers')
          .update({ current_balance: finalPayable, last_purchase_date: formData.po_date })
          .eq('id', formData.supplier_id);

        await supabase.from('supplier_ledger').insert([{
          user_id: user.id,
          supplier_id: parseInt(formData.supplier_id),
          transaction_type: 'po',
          transaction_date: formData.po_date,
          reference_id: order.id,
          reference_no: formData.po_no,
          debit: total,
          credit: 0,
          balance: finalPayable,
          description: `Purchase Order ${formData.po_no}`,
        }]);

        // Update settings with next number
        if (settings) {
          await supabase
            .from('settings')
            .update({
              purchase_order_next_number: (settings.purchase_order_next_number || 1) + 1
            })
            .eq('user_id', user.id);
        }
      }

      const message = saveAs === 'draft'
        ? 'Saved as draft'
        : 'Purchase Order created';

      toast.success(message, {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      // Download PDF if requested
      if (shouldDownloadPdf && saveAs !== 'draft') {
        await handleDownloadPDF(order.id);
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

  async function handleDownloadPDF(orderId) {
    try {
      const { data: order } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(supplier_name, mobile_no, address)')
        .eq('id', orderId)
        .single();

      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', orderId);

      await downloadPurchaseOrderPDF(order, items, settings, { showLogo, showQR });
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
      await supabase.from('purchase_order_items').delete().eq('po_id', draftId);
      await supabase.from('purchase_orders').delete().eq('id', draftId);

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
      po_no: generatePONo(settings),
      supplier_id: '',
      po_date: new Date().toISOString().split('T')[0],
      receiving_date: new Date().toISOString().split('T')[0],
      currency_code: 'PKR',
      is_gst: true,
      gst_percentage: 17,
      status: 'pending',
      items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }],
      notes: '',
    });
    setEditingOrderId(null);
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  };

  // Prepare dropdown options
  const supplierOptions = suppliers.map(s => ({ value: s.id.toString(), label: s.supplier_name }));
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
              {editingOrderId ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h1>
            <p className="text-xs text-neutral-500">Create a new purchase order</p>
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
                    <div className="text-xs font-medium text-neutral-900">{draft.po_no}</div>
                    <div className="text-[10px] text-neutral-500">
                      {draft.suppliers?.supplier_name || 'No supplier'} • {formatCurrency(draft.total_amount)}
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
        <form onSubmit={(e) => handleSubmit(e, 'pending', downloadPdf)}>
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "p-3"
          )}>
            {/* Top Fields - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">PO #</label>
                <input
                  type="text"
                  name="po_no"
                  value={formData.po_no}
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
                <SearchableDropdown
                  label={<span className="text-xs font-medium text-neutral-700">Supplier *</span>}
                  options={supplierOptions}
                  value={formData.supplier_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, supplier_id: val }))}
                  placeholder="Select Supplier"
                  searchPlaceholder="Search supplier..."
                  onQuickAdd={handleQuickAddSupplier}
                  quickAddLabel="Add supplier"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">PO Date</label>
                <input
                  type="date"
                  name="po_date"
                  value={formData.po_date}
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
                <label className="block text-xs font-medium text-neutral-700 mb-1">Receiving Date</label>
                <input
                  type="date"
                  name="receiving_date"
                  value={formData.receiving_date}
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
                <label className="block text-xs font-medium text-neutral-700 mb-1">Currency</label>
                <select
                  name="currency_code"
                  value={formData.currency_code}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-blue-600 mb-1">GST %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_gst}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_gst: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-neutral-300"
                  />
                  <input
                    type="number"
                    name="gst_percentage"
                    value={formData.gst_percentage}
                    onChange={handleChange}
                    disabled={!formData.is_gst}
                    className={cn(
                      "w-full px-2 py-1.5 text-xs",
                      "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                      "transition-all duration-200",
                      !formData.is_gst && "opacity-50"
                    )}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
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
            <div className="grid grid-cols-6 gap-2 mb-3">
              <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-2 text-center">
                <div className="text-[9px] text-neutral-500 uppercase">Subtotal</div>
                <div className="text-xs font-semibold text-neutral-900">{formatCurrency(subtotal)}</div>
              </div>
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg p-2 text-center">
                <div className="text-[9px] text-blue-600 uppercase">GST ({formData.is_gst ? formData.gst_percentage : 0}%)</div>
                <div className="text-xs font-semibold text-blue-700">{formatCurrency(gstAmount)}</div>
              </div>
              <div className="bg-neutral-900 rounded-lg p-2 text-center">
                <div className="text-[9px] text-neutral-400 uppercase">Total</div>
                <div className="text-xs font-semibold text-white">{formatCurrency(total)}</div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-0.5">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="partial">Partial</option>
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
                      checked={downloadPdf}
                      onChange={(e) => setDownloadPdf(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                    />
                    <span className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      Download PDF
                    </span>
                  </label>
                </div>
                {downloadPdf && (
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
                name="notes"
                value={formData.notes}
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
              {downloadPdf && (
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
                onClick={(e) => handleSubmit(e, 'pending', false)}
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
                Save Purchase Order
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
