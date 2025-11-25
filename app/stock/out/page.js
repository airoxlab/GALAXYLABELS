'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, PackageMinus } from 'lucide-react';
import QuantityCounter from '@/components/ui/QuantityCounter';

export default function StockOutPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    warehouse_id: '',
    reference_type: 'sale',
    reference_no: '',
    customer_id: '',
    notes: '',
    items: [{ product_id: '', product_name: '', quantity: 1 }],
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
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData(userId) {
    try {
      const [productsRes, warehousesRes, customersRes] = await Promise.all([
        supabase.from('products').select('id, name, current_stock, unit_price').eq('user_id', userId).eq('is_active', true).order('name'),
        supabase.from('warehouses').select('id, name').eq('user_id', userId).eq('is_active', true).order('name'),
        supabase.from('customers').select('id, customer_name').eq('user_id', userId).eq('is_active', true).order('customer_name'),
      ]);

      setProducts(productsRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setCustomers(customersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
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
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        product_name: '',
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
      items: [...prev.items, { product_id: '', product_name: '', quantity: 1 }]
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

  const getProductStock = (productId) => {
    const product = products.find(p => p.id.toString() === productId);
    return product?.current_stock || 0;
  };

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
        duration: 1500,
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
        .select('id, name, current_stock')
        .single();

      if (error) throw error;

      setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));

      const newItems = [...formData.items];
      newItems[index] = {
        ...newItems[index],
        product_id: data.id.toString(),
        product_name: data.name,
      };
      setFormData(prev => ({ ...prev, items: newItems }));

      toast.success('Product added', {
        duration: 1500,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;

    const validItems = formData.items.filter(item => item.product_id && parseFloat(item.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product with quantity', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSaving(true);

    try {
      const stockOutRecords = validItems.map(item => ({
        user_id: user.id,
        date: formData.date,
        product_id: parseInt(item.product_id),
        warehouse_id: formData.warehouse_id ? parseInt(formData.warehouse_id) : null,
        quantity: parseFloat(item.quantity),
        reference_type: formData.reference_type,
        reference_no: formData.reference_no,
        customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
        notes: formData.notes,
        created_by: user.id,
      }));

      const { error } = await supabase.from('stock_out').insert(stockOutRecords);
      if (error) throw error;

      toast.success(`${validItems.length} item(s) stocked out successfully!`, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      resetForm();
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

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      warehouse_id: '',
      reference_type: 'sale',
      reference_no: '',
      customer_id: '',
      notes: '',
      items: [{ product_id: '', product_name: '', quantity: 1 }],
    });
  }

  const customerOptions = customers.map(c => ({ value: c.id.toString(), label: c.customer_name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: `${p.name} (Stock: ${p.current_stock || 0})` }));

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Stock Out</h1>
          <p className="text-sm text-neutral-500">Remove stock from inventory</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={cn(
            "bg-white rounded-xl",
            "border border-neutral-200",
            "shadow-sm",
            "p-5"
          )}>
            {/* Form Fields */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                  required
                />
              </div>

              <div>
                <SearchableDropdown
                  label={<span className="text-sm font-medium text-neutral-700">Customer</span>}
                  options={customerOptions}
                  value={formData.customer_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, customer_id: val }))}
                  placeholder="Select Customer"
                  onQuickAdd={handleQuickAddCustomer}
                  quickAddLabel="Add customer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Warehouse</label>
                <select
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reference Type</label>
                <select
                  name="reference_type"
                  value={formData.reference_type}
                  onChange={handleChange}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                >
                  <option value="sale">Sales Invoice</option>
                  <option value="production">Production Use</option>
                  <option value="return">Purchase Return</option>
                  <option value="damage">Damage/Loss</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reference #</label>
                <input
                  type="text"
                  name="reference_no"
                  value={formData.reference_no}
                  onChange={handleChange}
                  placeholder="e.g., INV-001"
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                  )}
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-5">
              <div className="rounded-lg border border-neutral-200 overflow-hidden" style={{ overflow: 'visible' }}>
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-sm font-semibold text-neutral-700 w-10">#</th>
                      <th className="px-3 py-3 text-left text-sm font-semibold text-neutral-700">Product</th>
                      <th className="px-3 py-3 text-center text-sm font-semibold text-neutral-700 w-28">Available</th>
                      <th className="px-3 py-3 text-center text-sm font-semibold text-neutral-700 w-24">QTY</th>
                      <th className="px-2 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {formData.items.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 text-sm text-neutral-500">{index + 1}</td>
                        <td className="px-2 py-2" style={{ overflow: 'visible' }}>
                          <SearchableDropdown
                            options={productOptions}
                            value={item.product_id}
                            onChange={(val) => handleProductChange(index, val)}
                            placeholder="Select Product"
                            onQuickAdd={(name) => handleQuickAddProduct(name, index)}
                            quickAddLabel="Add product"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn(
                            "text-sm font-semibold",
                            item.product_id && getProductStock(item.product_id) <= 0 ? "text-red-500" : "text-neutral-900"
                          )}>
                            {item.product_id ? getProductStock(item.product_id) : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <QuantityCounter
                            value={item.quantity}
                            onChange={(val) => handleItemChange(index, 'quantity', val)}
                            min={1}
                            step={1}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                  "mt-3 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-neutral-100 text-neutral-700",
                  "hover:bg-neutral-200",
                  "flex items-center gap-2 transition-colors"
                )}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {/* Notes and Total Section */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className={cn(
                    "w-full px-3 py-2 text-sm",
                    "bg-white border border-neutral-300 rounded-lg",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                    "resize-none"
                  )}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-neutral-900 rounded-xl px-6 py-4 text-center min-w-[160px]">
                  <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Total Items</div>
                  <div className="text-2xl font-bold text-white">
                    {formData.items.filter(i => i.product_id && i.quantity).length}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    "px-6 py-4 rounded-xl font-semibold text-sm",
                    "bg-neutral-900 text-white",
                    "hover:bg-neutral-800",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-2 transition-colors",
                    "min-w-[160px] justify-center"
                  )}
                >
                  <PackageMinus className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Record Stock Out'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
