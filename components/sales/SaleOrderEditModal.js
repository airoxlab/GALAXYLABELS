'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import AddProductModal from '@/components/ui/AddProductModal';
import toast from 'react-hot-toast';
import { X, Save, Plus, Trash2, Receipt } from 'lucide-react';

export default function SaleOrderEditModal({ orderId, isOpen, onClose, onSave, userId, customers }) {
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');

  const [formData, setFormData] = useState({
    order_no: '',
    customer_id: '',
    customer_po: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    gst_percentage: 18,
    bill_situation: 'pending',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && orderId && userId) {
      fetchData();
    }
  }, [isOpen, orderId, userId]);

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
      const [orderRes, itemsRes, productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('sale_orders')
          .select('*')
          .eq('id', orderId)
          .eq('user_id', userId)
          .single(),
        supabase
          .from('sale_order_items')
          .select('*, products(categories(name))')
          .eq('order_id', orderId),
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
        supabase
          .from('categories')
          .select('id, name')
          .eq('user_id', userId)
          .order('name')
      ]);

      if (orderRes.error) throw orderRes.error;

      setOrder(orderRes.data);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);

      // Set form data
      setFormData({
        order_no: orderRes.data.order_no || '',
        customer_id: orderRes.data.customer_id?.toString() || '',
        customer_po: orderRes.data.customer_po || '',
        order_date: orderRes.data.order_date || new Date().toISOString().split('T')[0],
        delivery_date: orderRes.data.delivery_date || new Date().toISOString().split('T')[0],
        gst_percentage: orderRes.data.gst_percentage || 18,
        bill_situation: orderRes.data.bill_situation || 'pending',
        notes: orderRes.data.notes || '',
      });

      // Set items
      const loadedItems = (itemsRes.data || []).map(item => ({
        id: item.id,
        product_id: item.product_id?.toString() || '',
        product_name: item.product_name || '',
        category: item.products?.categories?.name || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
      }));

      if (loadedItems.length === 0) {
        loadedItems.push({ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 });
      }

      setItems(loadedItems);
    } catch (error) {
      console.error('Error fetching order data:', error);
      toast.error('Error loading order', {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    setItems([...items, { product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }]);
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
    const taxAmount = (subtotal * parseFloat(formData.gst_percentage || 0)) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const formatCurrency = (amount) => {
    return 'Rs ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  async function handleSave() {
    if (!formData.customer_id) {
      toast.error('Please select a customer', {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity', {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSaving(true);
    try {
      // Update order
      const { error: orderError } = await supabase
        .from('sale_orders')
        .update({
          customer_id: parseInt(formData.customer_id),
          customer_po: formData.customer_po,
          order_date: formData.order_date,
          delivery_date: formData.delivery_date,
          gst_percentage: parseFloat(formData.gst_percentage),
          bill_situation: formData.bill_situation,
          notes: formData.notes,
          total_amount: total,
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Delete existing items
      await supabase.from('sale_order_items').delete().eq('order_id', orderId);

      // Insert new items
      const itemsData = validItems.map(item => {
        const itemTotal = parseInt(item.quantity) * parseFloat(item.unit_price);
        const tax = (itemTotal * formData.gst_percentage) / 100;
        return {
          user_id: userId,
          order_id: orderId,
          product_id: parseInt(item.product_id),
          product_name: item.product_name,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
          total_price: itemTotal + tax,
        };
      });

      if (itemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('sale_order_items')
          .insert(itemsData);
        if (itemsError) throw itemsError;
      }

      toast.success('Order updated successfully', {
        duration: 1500,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      onSave();
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error: ' + error.message, {
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const customerOptions = customers.map(c => ({ value: c.id.toString(), label: c.customer_name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: p.name }));

  return (
    <>
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
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Edit Sale Order</h2>
                <p className="text-xs text-neutral-500">
                  {loading ? 'Loading...' : formData.order_no || '-'}
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
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Order #</label>
                    <input
                      type="text"
                      name="order_no"
                      value={formData.order_no}
                      onChange={handleChange}
                      className={cn(
                        "w-full px-3 py-2 text-sm",
                        "bg-neutral-50 border border-neutral-200 rounded-lg",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                      )}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Customer</label>
                    <SearchableDropdown
                      options={customerOptions}
                      value={formData.customer_id}
                      onChange={(val) => setFormData(prev => ({ ...prev, customer_id: val }))}
                      placeholder="Select Customer"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Date</label>
                    <input
                      type="date"
                      name="order_date"
                      value={formData.order_date}
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
                      name="bill_situation"
                      value={formData.bill_situation}
                      onChange={handleChange}
                      className={cn(
                        "w-full px-3 py-2 text-sm",
                        "bg-neutral-50 border border-neutral-200 rounded-lg",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                      )}
                    >
                      <option value="pending">Pending</option>
                      <option value="added_to_account">Add to Account</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                {/* Items Table */}
                <div className="rounded-xl border border-neutral-200 overflow-visible">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-neutral-600 w-8">#</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-600">Product</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-600 w-32">Category</th>
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
                          <td className="px-3 py-3 text-xs text-neutral-600 align-top">{item.category || '-'}</td>
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
                            {formatCurrency((item.quantity * item.unit_price) + ((item.quantity * item.unit_price * formData.gst_percentage) / 100))}
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
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">GST ({formData.gst_percentage}%)</span>
                        <span className="font-medium">{formatCurrency(taxAmount)}</span>
                      </div>
                      <div className="border-t border-neutral-200 pt-2 flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Special Note</label>
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
                    placeholder="Add any special notes..."
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
    </>
  );
}
