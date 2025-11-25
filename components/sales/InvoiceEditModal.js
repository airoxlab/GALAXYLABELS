'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { X, Save, Plus, Trash2, RefreshCw } from 'lucide-react';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import toast from 'react-hot-toast';

export default function InvoiceEditModal({ invoiceId, isOpen, onClose, onSave, userId }) {
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    invoice_no: '',
    customer_id: '',
    customer_po: '',
    invoice_date: '',
    delivery_date: '',
    gst_percentage: 18,
    bill_situation: 'pending',
    notes: '',
    items: []
  });

  useEffect(() => {
    if (isOpen && invoiceId && userId) {
      fetchData();
    }
  }, [isOpen, invoiceId, userId]);

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
      const [invoiceRes, itemsRes, customersRes, productsRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('*')
          .eq('id', invoiceId)
          .single(),
        supabase
          .from('sales_invoice_items')
          .select('*')
          .eq('invoice_id', invoiceId),
        supabase
          .from('customers')
          .select('id, customer_name')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('customer_name'),
        supabase
          .from('products')
          .select('id, name, unit_price, categories(name)')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (invoiceRes.error) throw invoiceRes.error;

      setInvoice(invoiceRes.data);
      setItems(itemsRes.data || []);
      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);

      // Populate form
      setFormData({
        invoice_no: invoiceRes.data.invoice_no || '',
        customer_id: invoiceRes.data.customer_id?.toString() || '',
        customer_po: invoiceRes.data.customer_po || '',
        invoice_date: invoiceRes.data.invoice_date || '',
        delivery_date: invoiceRes.data.delivery_date || '',
        gst_percentage: invoiceRes.data.gst_percentage || 18,
        bill_situation: invoiceRes.data.bill_situation || 'pending',
        notes: invoiceRes.data.notes || '',
        items: (itemsRes.data || []).map(item => ({
          id: item.id,
          product_id: item.product_id?.toString() || '',
          product_name: item.product_name || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0
        }))
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading invoice');
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleProductChange = (index, productId) => {
    const product = products.find(p => p.id === parseInt(productId));
    const newItems = [...formData.items];
    if (product) {
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        unit_price: product.unit_price || 0
      };
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }]
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

  async function handleSave() {
    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    const validItems = formData.items.filter(item => item.product_id);
    if (validItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    setSaving(true);
    try {
      // Update invoice
      const { error: invoiceError } = await supabase
        .from('sales_invoices')
        .update({
          invoice_no: formData.invoice_no,
          customer_id: parseInt(formData.customer_id),
          customer_po: formData.customer_po,
          invoice_date: formData.invoice_date,
          delivery_date: formData.delivery_date,
          subtotal: subtotal,
          gst_percentage: formData.gst_percentage,
          gst_amount: gstAmount,
          total_amount: total,
          bill_situation: formData.bill_situation,
          notes: formData.notes
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Delete existing items
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoiceId);

      // Insert new items
      const itemsData = validItems.map(item => ({
        user_id: userId,
        invoice_id: invoiceId,
        product_id: parseInt(item.product_id),
        product_name: item.product_name,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price)
      }));

      const { error: itemsError } = await supabase.from('sales_invoice_items').insert(itemsData);
      if (itemsError) throw itemsError;

      toast.success('Invoice updated successfully');
      onSave && onSave();
      onClose();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Error saving invoice: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const customerOptions = customers.map(c => ({ value: c.id.toString(), label: c.customer_name }));
  const productOptions = products.map(p => ({ value: p.id.toString(), label: p.name }));

  if (!isOpen) return null;

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
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Edit Invoice</h2>
            <p className="text-xs text-neutral-500">
              {loading ? 'Loading...' : formData.invoice_no || '-'}
            </p>
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
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={formData.invoice_no}
                    onChange={(e) => handleChange('invoice_no', e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 text-xs",
                      "bg-neutral-50 border border-neutral-200 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Customer</label>
                  <SearchableDropdown
                    options={customerOptions}
                    value={formData.customer_id}
                    onChange={(val) => handleChange('customer_id', val)}
                    placeholder="Select customer"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => handleChange('invoice_date', e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 text-xs",
                      "bg-neutral-50 border border-neutral-200 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">GST %</label>
                  <input
                    type="number"
                    value={formData.gst_percentage}
                    onChange={(e) => handleChange('gst_percentage', e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 text-xs",
                      "bg-neutral-50 border border-neutral-200 rounded-lg",
                      "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                    )}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">Items</label>
                <div className="rounded-lg border border-neutral-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-neutral-600">Product</th>
                        <th className="px-3 py-2 text-center font-medium text-neutral-600 w-20">Qty</th>
                        <th className="px-3 py-2 text-center font-medium text-neutral-600 w-24">Price</th>
                        <th className="px-3 py-2 text-right font-medium text-neutral-600 w-24">Amount</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-2 py-2">
                            <SearchableDropdown
                              options={productOptions}
                              value={item.product_id}
                              onChange={(val) => handleProductChange(index, val)}
                              placeholder="Select product"
                              className="text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className={cn(
                                "w-full px-2 py-1 text-xs text-center",
                                "bg-white border border-neutral-200 rounded",
                                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                              )}
                              min="1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                              className={cn(
                                "w-full px-2 py-1 text-xs text-center",
                                "bg-white border border-neutral-200 rounded",
                                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => removeItem(index)}
                              disabled={formData.items.length === 1}
                              className="p-1 text-neutral-400 hover:text-red-500 disabled:opacity-30"
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
                    "mt-2 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "bg-neutral-100 text-neutral-600",
                    "hover:bg-neutral-200",
                    "flex items-center gap-1"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>

              {/* Totals & Status */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-neutral-500 uppercase">Subtotal</div>
                  <div className="text-sm font-semibold text-neutral-900">{formatCurrency(subtotal)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-blue-600 uppercase">GST ({formData.gst_percentage}%)</div>
                  <div className="text-sm font-semibold text-blue-700">{formatCurrency(gstAmount)}</div>
                </div>
                <div className="bg-neutral-900 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-neutral-400 uppercase">Total</div>
                  <div className="text-sm font-semibold text-white">{formatCurrency(total)}</div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Status</label>
                <select
                  value={formData.bill_situation}
                  onChange={(e) => handleChange('bill_situation', e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 text-xs",
                    "bg-neutral-50 border border-neutral-200 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                  )}
                >
                  <option value="pending">Pending</option>
                  <option value="added_to_account">Add to Account</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={2}
                  className={cn(
                    "w-full px-3 py-2 text-xs",
                    "bg-neutral-50 border border-neutral-200 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "resize-none"
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-medium",
              "bg-white border border-neutral-200 text-neutral-700",
              "hover:bg-neutral-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-medium",
              "bg-neutral-900 text-white",
              "hover:bg-neutral-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center gap-1.5"
            )}
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
