'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, Trash2, Save, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import AddProductModal from '@/components/ui/AddProductModal';

export default function SaleOrderEditDrawer({
  isOpen,
  onClose,
  orderId,
  userId,
  customers,
  onSaved
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductIndex, setAddProductIndex] = useState(null);
  const [addProductInitialName, setAddProductInitialName] = useState('');
  const [searchQuery, setSearchQuery] = useState({});
  const [formData, setFormData] = useState({
    order_no: '',
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
    if (isOpen && orderId && userId) {
      loadOrder();
      fetchProducts();
      fetchCategories();
    }
  }, [isOpen, orderId, userId]);

  async function loadOrder() {
    setLoading(true);
    try {
      const { data: order, error: orderError} = await supabase
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
      })) : [{ product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }];

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
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Error loading order: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    console.log('[DEBUG] fetchProducts called with userId:', userId);
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

      console.log('[DEBUG] Products query result:', { data, error, count: data?.length });

      if (error) throw error;
      setProducts(data || []);

      console.log('[DEBUG] Products state updated with', data?.length || 0, 'products');
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
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
      };
    }
    setFormData(prev => ({ ...prev, items: newItems }));

    // Clear search query to close dropdown
    setSearchQuery(prev => {
      const newQuery = { ...prev };
      delete newQuery[index];
      return newQuery;
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', product_name: '', category: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
      setSearchQuery(prev => {
        const newQuery = { ...prev };
        delete newQuery[index];
        return newQuery;
      });
    }
  };

  const handleAddProductClick = (index, initialName = '') => {
    setAddProductIndex(index);
    setAddProductInitialName(initialName);
    setShowAddProductModal(true);
  };

  const handleProductAdded = (newProduct) => {
    fetchProducts();
    if (addProductIndex !== null) {
      handleProductChange(addProductIndex, newProduct.id.toString());
    }
    setAddProductIndex(null);
    setAddProductInitialName('');
  };

  const handleSave = async () => {
    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    const validItems = formData.items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity');
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
          notes: formData.special_note,
          total_amount: calculateTotal(),
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Delete all existing items
      const { error: deleteError } = await supabase
        .from('sale_order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) throw deleteError;

      // Insert new items
      const itemsToInsert = validItems.map(item => {
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

      const { error: itemsError } = await supabase
        .from('sale_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('Order updated successfully!');
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error saving order: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = (index) => {
    const query = searchQuery[index] || '';
    if (!query) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.categories?.name?.toLowerCase().includes(query.toLowerCase())
    );
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      if (!item.product_id) return sum;
      const itemTotal = item.quantity * item.unit_price;
      const tax = (itemTotal * formData.gst_percentage) / 100;
      return sum + itemTotal + tax;
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full lg:w-[900px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Save className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-medium text-white">Edit Sale Order</h2>
                <p className="text-xs text-neutral-400">Order # {formData.order_no}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-all text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-neutral-500">Loading order...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer & Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Customer *
                  </label>
                  <select
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    required
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customer_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Bill Situation *
                  </label>
                  <select
                    name="bill_situation"
                    value={formData.bill_situation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  >
                    <option value="pending">Pending</option>
                    <option value="added_to_account">Add to Account</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    name="order_date"
                    value={formData.order_date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    GST %
                  </label>
                  <input
                    type="number"
                    name="gst_percentage"
                    value={formData.gst_percentage}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-neutral-700">Items *</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50">
                          <th className="text-left text-xs font-semibold text-neutral-700 px-3 py-2">Product</th>
                          <th className="text-left text-xs font-semibold text-neutral-700 px-3 py-2">Category</th>
                          <th className="text-center text-xs font-semibold text-neutral-700 px-3 py-2">Qty</th>
                          <th className="text-right text-xs font-semibold text-neutral-700 px-3 py-2">Price</th>
                          <th className="text-right text-xs font-semibold text-neutral-700 px-3 py-2">Total</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, index) => (
                          <tr key={index} className="border-t border-neutral-100">
                            <td className="px-3 py-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={searchQuery[index] !== undefined ? searchQuery[index] : (item.product_name || '')}
                                  onChange={(e) => setSearchQuery(prev => ({ ...prev, [index]: e.target.value }))}
                                  onFocus={(e) => setSearchQuery(prev => ({ ...prev, [index]: item.product_name || '' }))}
                                  onBlur={(e) => {
                                    // Delay closing to allow click events on dropdown items
                                    setTimeout(() => {
                                      if (!e.relatedTarget?.closest('.product-dropdown')) {
                                        setSearchQuery(prev => {
                                          const newQuery = { ...prev };
                                          delete newQuery[index];
                                          return newQuery;
                                        });
                                      }
                                    }, 200);
                                  }}
                                  placeholder="Search product..."
                                  className="w-full px-2 py-1.5 text-sm bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                                />
                                {searchQuery[index] !== undefined && searchQuery[index] !== null && (
                                  <div className="product-dropdown absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {filteredProducts(index).length === 0 ? (
                                      <div className="px-3 py-2">
                                        <p className="text-xs text-neutral-400 mb-2">No products found</p>
                                        <button
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => handleAddProductClick(index, searchQuery[index])}
                                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                          + Add "{searchQuery[index]}" as new product
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        {filteredProducts(index).map(product => (
                                          <button
                                            key={product.id}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleProductChange(index, product.id.toString())}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors"
                                          >
                                            <div className="font-medium text-neutral-900">{product.name}</div>
                                            {product.categories?.name && (
                                              <div className="text-xs text-neutral-500">{product.categories.name}</div>
                                            )}
                                          </button>
                                        ))}
                                        <div className="border-t border-neutral-100 px-3 py-2">
                                          <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleAddProductClick(index, searchQuery[index])}
                                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                          >
                                            + Add new product
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-sm text-neutral-600">{item.category || '-'}</span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="w-16 px-2 py-1.5 text-sm text-center bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                                min="1"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                className="w-24 px-2 py-1.5 text-sm text-right bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-sm font-medium text-neutral-900">
                                Rs {((item.quantity * item.unit_price) + ((item.quantity * item.unit_price * formData.gst_percentage) / 100)).toFixed(0)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                disabled={formData.items.length === 1}
                                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Special Note */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Special Note
                </label>
                <textarea
                  name="special_note"
                  value={formData.special_note}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10 resize-none"
                  placeholder="Add any special notes..."
                />
              </div>

              {/* Total */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-700">Total Amount (incl. GST)</span>
                  <span className="text-xl font-bold text-neutral-900">
                    Rs {calculateTotal().toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-neutral-200 px-6 py-4 bg-neutral-50">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
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
