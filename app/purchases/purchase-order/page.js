'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, FileText, X, Download, Printer, Eye, Loader2, History } from 'lucide-react';
import { useDraftsPanel } from '@/components/ui/DraftsPanel';
import { useRouter } from 'next/navigation';
import { downloadPurchaseOrderPDF } from '@/components/purchases/PurchasePDF';
import AddProductModal from '@/components/ui/AddProductModal';
import AddSupplierModal from '@/components/ui/AddSupplierModal';
import { usePermissions } from '@/hooks/usePermissions';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { hasPermission, isSuperadmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [addSupplierInitialName, setAddSupplierInitialName] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Permission checks for add actions
  const canAddProduct = isSuperadmin || hasPermission('products_add');
  const canAddSupplier = isSuperadmin || hasPermission('suppliers_add');

  const [formData, setFormData] = useState({
    po_no: '',
    supplier_id: '',
    po_date: new Date().toISOString().split('T')[0],
    receiving_date: new Date().toISOString().split('T')[0],
    currency_code: 'PKR',
    is_gst: false,
    gst_percentage: 0,
    status: 'pending',
    items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0, weight: 0, unit: '' }],
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
            weight,
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
        .select('*, products(categories(name), units(symbol, name))')
        .eq('po_id', orderId);

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
    const gstAmount = formData.is_gst ? (subtotal * parseFloat(formData.gst_percentage || 0)) / 100 : 0;
    const total = subtotal + gstAmount;
    const totalNetWeight = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.weight || 0));
    }, 0);
    return { subtotal, gstAmount, total, totalNetWeight };
  };

  const { subtotal, gstAmount, total, totalNetWeight } = calculateTotals();

  async function handleQuickAddSupplier(name) {
    if (!name.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{ user_id: user.parentUserId || user.id, supplier_name: name.trim(), is_active: true, current_balance: 0 }])
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

  function handleOpenAddSupplierModal(searchQuery) {
    setAddSupplierInitialName(searchQuery || '');
    setShowAddSupplierModal(true);
  }

  function handleSupplierAddedFromModal(supplierData) {
    // Add to suppliers list
    setSuppliers(prev => [...prev, supplierData].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
    // Set the newly added supplier as selected
    setFormData(prev => ({ ...prev, supplier_id: supplierData.id.toString() }));
  }

  // Preview function
  function handlePreview() {
    if (!formData.supplier_id) {
      toast.error('Please select a supplier first', {
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

  // Get selected supplier name
  const selectedSupplier = suppliers.find(s => s.id.toString() === formData.supplier_id);

  async function handleSubmit(e, saveAs = 'pending', shouldDownloadPdf = false, shouldPrint = false) {
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
      // Create/Update Purchase Order - use parentUserId for data queries
      const orderData = {
        user_id: user.parentUserId || user.id,
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
        status: saveAs,
        notes: formData.notes,
      };

      let order;
      let previousBalance = 0;
      let finalPayable = total;

      if (editingOrderId) {
        // For editing: fetch supplier + update order in parallel
        const [supplierResult, orderResult] = await Promise.all([
          supabase.from('suppliers').select('current_balance').eq('id', formData.supplier_id).single(),
          supabase.from('purchase_orders').update(orderData).eq('id', editingOrderId).select().single()
        ]);

        if (orderResult.error) throw orderResult.error;
        order = orderResult.data;
        previousBalance = supplierResult.data?.current_balance || 0;
        finalPayable = previousBalance + total;

        // Update order with balance info
        await supabase.from('purchase_orders').update({ previous_balance: previousBalance, final_payable: finalPayable }).eq('id', order.id);

        // Delete existing order items (run in background)
        supabase.from('purchase_order_items').delete().eq('po_id', editingOrderId);
      } else {
        // For new order: fetch supplier + insert order in parallel
        const [supplierResult, orderResult] = await Promise.all([
          supabase.from('suppliers').select('current_balance').eq('id', formData.supplier_id).single(),
          supabase.from('purchase_orders').insert([orderData]).select().single()
        ]);

        if (orderResult.error) throw orderResult.error;
        order = orderResult.data;
        previousBalance = supplierResult.data?.current_balance || 0;
        finalPayable = previousBalance + total;

        // Update order with balance info
        supabase.from('purchase_orders').update({ previous_balance: previousBalance, final_payable: finalPayable }).eq('id', order.id);
      }

      // Insert order items
      const orderItemsData = validItems.map(item => ({
        user_id: user.parentUserId || user.id,
        po_id: order.id,
        product_id: parseInt(item.product_id),
        product_name: item.product_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
        weight: parseFloat(item.weight) || 0,
        net_weight: parseFloat(item.quantity) * parseFloat(item.weight || 0),
      }));

      // Update supplier balance and ledger if not a draft
      if (saveAs !== 'draft') {
        // Prepare all parallel operations
        const parallelOperations = [];

        // Insert order items
        if (orderItemsData.length > 0) {
          parallelOperations.push(
            supabase.from('purchase_order_items').insert(orderItemsData)
          );
        }

        // Update supplier balance
        parallelOperations.push(
          supabase
            .from('suppliers')
            .update({ current_balance: finalPayable, last_purchase_date: formData.po_date })
            .eq('id', formData.supplier_id)
        );

        // Insert supplier ledger
        parallelOperations.push(
          supabase.from('supplier_ledger').insert([{
            user_id: user.parentUserId || user.id,
            supplier_id: parseInt(formData.supplier_id),
            transaction_type: 'po',
            transaction_date: formData.po_date,
            reference_id: order.id,
            reference_no: formData.po_no,
            debit: 0,
            credit: total,
            balance: finalPayable,
            description: `Purchase Order ${formData.po_no}`,
          }])
        );

        // Auto-add stock for each product
        const stockInRecords = validItems.map(item => ({
          user_id: user.parentUserId || user.id,
          date: formData.receiving_date || formData.po_date,
          product_id: parseInt(item.product_id),
          warehouse_id: null,
          quantity: parseFloat(item.quantity),
          unit_cost: parseFloat(item.unit_price),
          total_cost: parseFloat(item.quantity) * parseFloat(item.unit_price),
          reference_type: 'purchase',
          reference_no: formData.po_no,
          supplier_id: parseInt(formData.supplier_id),
          notes: `Auto-generated from Purchase Order ${formData.po_no}`,
          created_by: user.parentUserId || user.id,
        }));

        parallelOperations.push(
          supabase.from('stock_in').insert(stockInRecords)
        );

        // Update settings with next number
        if (settings) {
          parallelOperations.push(
            supabase
              .from('settings')
              .update({
                purchase_order_next_number: (settings.purchase_order_next_number || 1) + 1
              })
              .eq('user_id', user.parentUserId || user.id)
          );
        }

        // Execute all parallel operations
        const results = await Promise.all(parallelOperations);

        // Check for errors
        results.forEach((result) => {
          if (result.error) {
            console.error('Operation failed:', result.error);
          }
        });
      } else {
        // For draft, just insert order items
        if (orderItemsData.length > 0) {
          const { error: orderItemsError } = await supabase.from('purchase_order_items').insert(orderItemsData);
          if (orderItemsError) throw orderItemsError;
        }

        // Update settings with next number for drafts too
        if (settings) {
          await supabase
            .from('settings')
            .update({
              purchase_order_next_number: (settings.purchase_order_next_number || 1) + 1
            })
            .eq('user_id', user.parentUserId || user.id);
        }
      }

      const message = saveAs === 'draft'
        ? 'Saved as draft'
        : 'Purchase Order created';

      toast.success(message, {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      // Download PDF if requested - must await before resetting form
      if (shouldDownloadPdf && saveAs !== 'draft') {
        await handleDownloadPDF(order.id, shouldPrint);
      }

      // Reset form and refresh data
      resetForm();
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

  async function handleDownloadPDF(orderId, shouldPrint = false) {
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

      await downloadPurchaseOrderPDF(order, items, settings, { showLogo: true, showQR: false }, shouldPrint);
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
      is_gst: false,
      gst_percentage: 0,
      status: 'pending',
      items: [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0, weight: 0, unit: '' }],
      notes: '',
    });
    setEditingOrderId(null);
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
    type: 'purchase',
    orderNoField: 'po_no',
    entityField: 'suppliers',
    entityNameField: 'supplier_name',
  });

  // Prepare dropdown options
  const supplierOptions = suppliers.map(s => ({ value: s.id.toString(), label: s.supplier_name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: p.name }));

  return (
    <ProtectedRoute requiredPermission="purchase_order_view" showUnauthorized>
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
              {editingOrderId ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h1>
            <p className="text-sm text-neutral-500">Create a new purchase order</p>
          </div>
          <div className="flex items-center gap-2">
            {DraftsToggle}
            <button
              type="button"
              onClick={() => router.push('/purchases')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium",
                "border border-neutral-200/60",
                "bg-white text-neutral-700 hover:bg-neutral-50",
                "transition-all duration-200",
                "flex items-center gap-1.5"
              )}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>

        {/* Drafts Section */}
        {DraftsPanel}

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, 'pending', true)} autoComplete="off">
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "p-5"
          )}>
            {/* Top Fields */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">PO #</label>
                <input
                  type="text"
                  name="po_no"
                  value={formData.po_no}
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
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Supplier *</label>
                <SearchableDropdown
                  options={supplierOptions}
                  value={formData.supplier_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, supplier_id: val }))}
                  placeholder="Select Supplier"
                  searchPlaceholder="Search supplier..."
                  onQuickAdd={canAddSupplier ? handleQuickAddSupplier : undefined}
                  quickAddLabel={canAddSupplier ? "Add supplier" : undefined}
                  onOpenAddModal={canAddSupplier ? handleOpenAddSupplierModal : undefined}
                  addModalLabel={canAddSupplier ? "Add New Supplier" : undefined}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">PO Date</label>
                <input
                  type="date"
                  name="po_date"
                  value={formData.po_date}
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
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Receiving Date</label>
                <input
                  type="date"
                  name="receiving_date"
                  value={formData.receiving_date}
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
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Currency</label>
                <select
                  name="currency_code"
                  value={formData.currency_code}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
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
                      <th className="px-3 py-3 text-left font-medium text-neutral-600" style={{ width: '28%' }}>Product</th>
                      <th className="px-3 py-3 text-left font-medium text-neutral-600 w-24">Category</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-16">Unit</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-16">QTY</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-16">Weight</th>
                      <th className="px-3 py-3 text-center font-medium text-neutral-600 w-20">Net Wt.</th>
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
                          <span className="text-xs text-neutral-600 text-center block">{parseFloat(item.weight || 0).toFixed(2)}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-xs font-medium text-neutral-700 text-center block">{(parseFloat(item.quantity || 0) * parseFloat(item.weight || 0)).toFixed(2)}</span>
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
            <div className="grid grid-cols-7 gap-3 mb-5">
              <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-xl p-3 text-center">
                <div className="text-xs text-neutral-500 uppercase font-medium">Subtotal</div>
                <div className="text-sm font-semibold text-neutral-900 mt-1">{formatCurrency(subtotal)}</div>
              </div>
              <div className="bg-neutral-100/80 border border-neutral-200/60 rounded-xl p-3 text-center">
                <div className="text-xs text-neutral-500 uppercase font-medium">GST ({formData.gst_percentage}%)</div>
                <div className="text-sm font-semibold text-neutral-700 mt-1">{formatCurrency(gstAmount)}</div>
              </div>
              <div className="bg-neutral-900 rounded-xl p-3 text-center">
                <div className="text-xs text-neutral-400 uppercase font-medium">Total</div>
                <div className="text-sm font-semibold text-white mt-1">{formatCurrency(total)}</div>
              </div>
              <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 text-center">
                <div className="text-xs text-amber-600 uppercase font-medium">Net Weight</div>
                <div className="text-sm font-semibold text-amber-700 mt-1">{totalNetWeight.toFixed(2)} kg</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Bill Situation</label>
                <select
                  name="bill_situation"
                  value={formData.bill_situation || 'added_to_account'}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                    "transition-all duration-200"
                  )}
                >
                  <option value="pending">Pending</option>
                  <option value="added_to_account">Add to Account</option>
                </select>
              </div>
            </div>

            {/* Special Notes */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Special Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
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
                onClick={(e) => handleSubmit(e, 'pending', true, true)}
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
                onClick={(e) => handleSubmit(e, 'pending', false)}
                disabled={saving}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl font-medium text-sm",
                  "bg-neutral-900 text-white",
                  "hover:bg-neutral-800",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Order'}
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

      {/* Add Supplier Modal */}
      <AddSupplierModal
        isOpen={showAddSupplierModal}
        onClose={() => {
          setShowAddSupplierModal(false);
          setAddSupplierInitialName('');
        }}
        onSupplierAdded={handleSupplierAddedFromModal}
        userId={user?.id}
        initialName={addSupplierInitialName}
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
                    <h2 className="text-lg font-semibold text-neutral-900">Purchase Order Preview</h2>
                    <p className="text-sm text-neutral-500">{formData.po_no}</p>
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
                {/* Company & PO Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900">{settings?.company_name || 'Company Name'}</h3>
                    <p className="text-sm text-neutral-600">{settings?.address || ''}</p>
                    <p className="text-sm text-neutral-600">{settings?.phone || ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">PURCHASE ORDER</div>
                    <p className="text-sm text-neutral-600">PO #: {formData.po_no}</p>
                    <p className="text-sm text-neutral-600">Date: {new Date(formData.po_date).toLocaleDateString('en-GB')}</p>
                    {formData.receiving_date && (
                      <p className="text-sm text-neutral-600">Receiving: {new Date(formData.receiving_date).toLocaleDateString('en-GB')}</p>
                    )}
                  </div>
                </div>

                {/* Supplier Info */}
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-neutral-700 mb-2">Supplier:</h4>
                  <p className="text-lg font-semibold text-neutral-900">{selectedSupplier?.supplier_name || '-'}</p>
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
                        <th className="px-4 py-3 text-center text-sm font-semibold">Weight</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">Net Wt.</th>
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
                          <td className="px-4 py-3 text-center text-sm text-neutral-600">{parseFloat(item.weight || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center text-sm text-neutral-700">{(parseFloat(item.quantity || 0) * parseFloat(item.weight || 0)).toFixed(2)}</td>
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
                    <div className="flex justify-between py-2 border-b border-neutral-200">
                      <span className="text-sm text-neutral-600">Total Net Weight</span>
                      <span className="text-sm font-semibold text-amber-600">{totalNetWeight.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg px-4 -mx-4">
                      <span className="text-sm font-semibold text-white">Total</span>
                      <span className="text-lg font-bold text-white">Rs {formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {formData.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-amber-700 mb-1">Notes:</h4>
                    <p className="text-sm text-amber-900">{formData.notes}</p>
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
                    // Trigger print
                    const event = { preventDefault: () => {} };
                    handleSubmit(event, 'pending', true, true);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
                    "hover:from-violet-600 hover:to-purple-700 transition-all",
                    "flex items-center gap-2"
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Print Order
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
