'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import AddProductModal from '@/components/ui/AddProductModal';
import toast from 'react-hot-toast';
import { X, Save, Plus, Trash2, Package } from 'lucide-react';

export default function PurchaseEditModal({ purchaseId, isOpen, onClose, onSave, userId }) {
  const [purchase, setPurchase] = useState(null);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');

  const [formData, setFormData] = useState({
    po_no: '',
    supplier_id: '',
    po_date: '',
    is_gst: false,
    gst_percentage: 0,
    status: 'pending',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && purchaseId && userId) {
      fetchData();
    }
  }, [isOpen, purchaseId, userId]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  async function fetchData() {
    setLoading(true);
    try {
      const [purchaseRes, itemsRes, suppliersRes, productsRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*')
          .eq('id', purchaseId)
          .single(),
        supabase
          .from('purchase_order_items')
          .select('*')
          .eq('po_id', purchaseId),
        supabase
          .from('suppliers')
          .select('id, supplier_name')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('supplier_name'),
        supabase
          .from('products')
          .select('id, name, unit_price')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (purchaseRes.error) throw purchaseRes.error;

      setPurchase(purchaseRes.data);
      setSuppliers(suppliersRes.data || []);
      setProducts(productsRes.data || []);

      // Set form data
      setFormData({
        po_no: purchaseRes.data.po_no || '',
        supplier_id: purchaseRes.data.supplier_id?.toString() || '',
        po_date: purchaseRes.data.po_date || '',
        is_gst: purchaseRes.data.is_gst ?? false,
        gst_percentage: purchaseRes.data.gst_percentage || 0,
        status: purchaseRes.data.status || 'pending',
        notes: purchaseRes.data.notes || '',
      });

      // Set items
      const loadedItems = (itemsRes.data || []).map(item => ({
        id: item.id,
        product_id: item.product_id?.toString() || '',
        product_name: item.product_name || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
      }));

      if (loadedItems.length === 0) {
        loadedItems.push({ product_id: '', product_name: '', quantity: 1, unit_price: 0 });
      }

      setItems(loadedItems);
    } catch (error) {
      console.error('Error fetching purchase data:', error);
      toast.error('Error loading purchase order', {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleProductChange = (index, productId, productsArray = null) => {
    const newItems = [...items];
    const productsToUse = productsArray || products;
    const product = productsToUse.find(p => p.id === parseInt(productId));
    if (product) {
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        unit_price: product.unit_price || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        product_name: '',
        unit_price: 0,
      };
    }
    setItems(newItems);
  };

  const handleItemChange = async (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);

    // If unit_price is changed, update the product's unit_price in the database
    if (field === 'unit_price' && newItems[index].product_id) {
      const productId = parseInt(newItems[index].product_id);
      const newPrice = parseFloat(value) || 0;

      try {
        const { error } = await supabase
          .from('products')
          .update({ unit_price: newPrice })
          .eq('id', productId)
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating product price:', error);
        } else {
          // Update local products state
          setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, unit_price: newPrice } : p
          ));
        }
      } catch (error) {
        console.error('Error updating product price:', error);
      }
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleAddProductClick = (index, initialName = '') => {
    setAddProductIndex(index);
    setAddProductInitialName(initialName);
    setShowAddProductModal(true);
  };

  const handleProductAdded = async (newProduct) => {
    const updatedProducts = await fetchProducts();

    // Pass the fresh products array directly to handleProductChange
    if (addProductIndex !== null) {
      handleProductChange(addProductIndex, newProduct.id.toString(), updatedProducts);
    }
    setAddProductIndex(null);
    setAddProductInitialName('');
  };

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
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
        .order('name');

      if (error) throw error;
      setProducts(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0));
    }, 0);
    const gstAmount = formData.is_gst ? (subtotal * parseFloat(formData.gst_percentage || 0)) / 100 : 0;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  const formatCurrency = (amount) => {
    return 'Rs ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  async function handleSave() {
    if (!formData.supplier_id) {
      toast.error('Please select a supplier', {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      toast.error('Please add at least one product', {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSaving(true);
    try {
      // Get supplier's previous balance
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('current_balance')
        .eq('id', formData.supplier_id)
        .single();

      const previousBalance = supplier?.current_balance || 0;
      const finalPayable = previousBalance + total;

      // Update purchase order
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          po_no: formData.po_no,
          supplier_id: parseInt(formData.supplier_id),
          po_date: formData.po_date,
          is_gst: formData.is_gst,
          gst_percentage: formData.gst_percentage,
          subtotal: subtotal,
          gst_amount: gstAmount,
          total_amount: total,
          previous_balance: previousBalance,
          final_payable: finalPayable,
          status: formData.status,
          notes: formData.notes,
        })
        .eq('id', purchaseId);

      if (poError) throw poError;

      // Delete existing items
      await supabase.from('purchase_order_items').delete().eq('po_id', purchaseId);

      // Insert new items
      const itemsData = validItems.map(item => ({
        user_id: userId,
        po_id: purchaseId,
        product_id: parseInt(item.product_id),
        product_name: item.product_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
      }));

      if (itemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsData);
        if (itemsError) throw itemsError;
      }

      toast.success('Purchase order updated', {
        duration: 1500,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      onSave();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      toast.error('Error: ' + error.message, {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const supplierOptions = suppliers.map(s => ({ value: s.id.toString(), label: s.supplier_name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: p.name }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        "relative bg-white rounded-2xl shadow-2xl",
        "w-full max-w-4xl max-h-[90vh] overflow-hidden",
        "mx-4"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Edit Purchase Order</h2>
              <p className="text-xs text-neutral-500">
                {loading ? 'Loading...' : formData.po_no || '-'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Form Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">PO #</label>
                  <input
                    type="text"
                    name="po_no"
                    value={formData.po_no}
                    onChange={handleChange}
                    className={cn(
                      "w-full px-3 py-2 text-sm",
                      "bg-neutral-50 border border-neutral-200 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Supplier</label>
                  <SearchableDropdown
                    options={supplierOptions}
                    value={formData.supplier_id}
                    onChange={(val) => setFormData(prev => ({ ...prev, supplier_id: val }))}
                    placeholder="Select Supplier"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Date</label>
                  <input
                    type="date"
                    name="po_date"
                    value={formData.po_date}
                    onChange={handleChange}
                    className={cn(
                      "w-full px-3 py-2 text-sm",
                      "bg-neutral-50 border border-neutral-200 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={cn(
                      "w-full px-3 py-2 text-sm",
                      "bg-neutral-50 border border-neutral-200 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                    )}
                  >
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>

              {/* GST Options */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.is_gst}
                    onChange={() => setFormData(prev => ({ ...prev, is_gst: true }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-neutral-700">GST</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.is_gst}
                    onChange={() => setFormData(prev => ({ ...prev, is_gst: false }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-neutral-700">Non-GST</span>
                </label>
                {formData.is_gst && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="gst_percentage"
                      value={formData.gst_percentage}
                      onChange={handleChange}
                      className={cn(
                        "w-20 px-3 py-1.5 text-sm",
                        "bg-neutral-50 border border-neutral-200 rounded-lg",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                      )}
                      step="0.01"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-neutral-700">%</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-neutral-200 overflow-visible">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-neutral-600 w-8">#</th>
                      <th className="px-3 py-2 text-left font-medium text-neutral-600">Product</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-600 w-20">Qty</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-600 w-24">Price</th>
                      <th className="px-3 py-2 text-right font-medium text-neutral-600 w-28">Amount</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50/50 border-b border-neutral-100">
                        <td className="px-3 py-3 text-neutral-500 align-top">{index + 1}</td>
                        <td className="px-2 py-3 relative align-top" style={{ minHeight: '60px' }}>
                          <div className="relative" style={{ zIndex: 100 - index }}>
                            <SearchableDropdown
                              options={productOptions}
                              value={item.product_id}
                              onChange={(val) => handleProductChange(index, val)}
                              placeholder="Select Product"
                              className="text-xs"
                              onOpenAddModal={(searchQuery) => handleAddProductClick(index, searchQuery)}
                              addModalLabel="Add New Product"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-3 align-top">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className={cn(
                              "w-full px-2 py-1.5 text-xs text-center",
                              "bg-white border border-neutral-200 rounded",
                              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                            )}
                            min="1"
                          />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                            className={cn(
                              "w-full px-2 py-1.5 text-xs text-center",
                              "bg-white border border-neutral-200 rounded",
                              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                            )}
                            step="0.01"
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-neutral-900 align-top">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </td>
                        <td className="px-2 py-3 text-center align-top">
                          <button
                            onClick={() => removeItem(index)}
                            className="p-1 text-neutral-400 hover:text-red-500 rounded"
                            disabled={items.length === 1}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addItem}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium",
                  "bg-neutral-100 text-neutral-600",
                  "hover:bg-neutral-200",
                  "flex items-center gap-1"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="bg-neutral-50 rounded-xl p-4 w-64 border border-neutral-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    {formData.is_gst && (
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">GST ({formData.gst_percentage}%)</span>
                        <span className="font-medium">{formatCurrency(gstAmount)}</span>
                      </div>
                    )}
                    <div className="border-t border-neutral-200 pt-2 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-neutral-50 border border-neutral-200 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "resize-none"
                  )}
                  placeholder="Add notes..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-200">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-neutral-100 text-neutral-700",
              "hover:bg-neutral-200"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-neutral-900 text-white",
              "hover:bg-neutral-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center gap-1.5"
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setAddProductIndex(null);
          setAddProductInitialName('');
        }}
        onProductAdded={handleProductAdded}
        userId={userId}
        initialName={addProductInitialName}
      />
    </div>
  );
}
