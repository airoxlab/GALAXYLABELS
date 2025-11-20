'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { notify } from '@/components/ui/Notifications';
import { generateId, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [formData, setFormData] = useState({
    po_no: generateId('PO'),
    supplier_id: '',
    po_date: new Date().toISOString().split('T')[0],
    receiving_date: '',
    po_status: 'pending',
    is_gst: true,
    gst_percentage: 17,
    currency: 'PKR',
    special_note: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0 }],
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [suppliersRes, productsRes] = await Promise.all([
      supabase.from('suppliers').select('id, supplier_name').eq('is_active', true).order('supplier_name'),
      supabase.from('products').select('id, name, unit_price').eq('is_active', true).order('name'),
    ]);

    setSuppliers(suppliersRes.data || []);
    setProducts(productsRes.data || []);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;

    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newItems[index].unit_price = product.unit_price;
      }
    }

    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, unit_price: 0 }]
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
      return sum + (parseFloat(item.quantity) * parseFloat(item.unit_price));
    }, 0);

    const gstAmount = formData.is_gst ? (subtotal * parseFloat(formData.gst_percentage)) / 100 : 0;
    const total = subtotal + gstAmount;

    return { subtotal, gstAmount, total };
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('current_balance')
        .eq('id', formData.supplier_id)
        .single();

      const previousBalance = supplier?.current_balance || 0;
      const finalPayable = previousBalance + total;

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          po_no: formData.po_no,
          supplier_id: formData.supplier_id,
          po_date: formData.po_date,
          subtotal: subtotal,
          is_gst: formData.is_gst,
          gst_percentage: formData.is_gst ? formData.gst_percentage : 0,
          gst_amount: gstAmount,
          total_amount: total,
          previous_balance: previousBalance,
          final_payable: finalPayable,
          status: formData.po_status,
          notes: formData.special_note,
        }])
        .select()
        .single();

      if (poError) throw poError;

      const itemsData = formData.items
        .filter(item => item.product_id)
        .map(item => {
          const product = products.find(p => p.id === parseInt(item.product_id));
          return {
            po_id: po.id,
            product_id: item.product_id,
            product_name: product?.name || '',
            quantity: parseFloat(item.quantity),
            received_quantity: 0,
            unit_price: parseFloat(item.unit_price),
            total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
          };
        });

      if (itemsData.length > 0) {
        await supabase.from('purchase_order_items').insert(itemsData);
      }

      // Update supplier balance
      await supabase
        .from('suppliers')
        .update({
          current_balance: finalPayable,
          last_purchase_date: formData.po_date
        })
        .eq('id', formData.supplier_id);

      // Add to supplier ledger
      await supabase.from('supplier_ledger').insert([{
        supplier_id: formData.supplier_id,
        transaction_type: 'po',
        transaction_date: formData.po_date,
        reference_id: po.id,
        reference_no: formData.po_no,
        debit: total,
        credit: 0,
        balance: finalPayable,
        description: `Purchase Order ${formData.po_no}`,
      }]);

      notify.success('Purchase Order created successfully!');
      setTimeout(() => router.push('/purchases'), 1500);
    } catch (error) {
      console.error('Error creating PO:', error);
      notify.error(`Error creating PO: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">New Purchase Order</h1>
        </div>

        <Card className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              label="PO #"
              name="po_no"
              value={formData.po_no}
              onChange={handleChange}
              required
              className="bg-green-50"
            />

            <Select
              label="Supplier Name *"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
              required
              options={[
                { value: '', label: 'Select Supplier' },
                ...suppliers.map(s => ({ value: s.id.toString(), label: s.supplier_name }))
              ]}
            />

            <Button type="button" variant="outline" onClick={() => router.push('/suppliers/new')} className="mt-6">
              + Add Supplier
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              options={[
                { value: 'PKR', label: 'PKR (Pakistani Rupee)' },
                { value: 'USD', label: 'USD (US Dollar)' },
                { value: 'CNY', label: 'CNY (Chinese Yuan)' },
              ]}
            />

            <Input
              label="Order Date"
              name="po_date"
              type="date"
              value={formData.po_date}
              onChange={handleChange}
              required
            />

            <Input
              label="Receiving Date"
              name="receiving_date"
              type="date"
              value={formData.receiving_date}
              onChange={handleChange}
            />

            <Select
              label="PO Status"
              name="po_status"
              value={formData.po_status}
              onChange={handleChange}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'received', label: 'Received' },
              ]}
            />
          </div>

          <Textarea
            label="Special Note"
            name="special_note"
            value={formData.special_note}
            onChange={handleChange}
            rows={2}
            className="mt-4"
          />
        </Card>

        <Card className="p-4 md:p-6">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formData.is_gst}
                onChange={() => setFormData(prev => ({ ...prev, is_gst: true }))}
                className="w-5 h-5"
              />
              <span>GST Invoice (17%)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!formData.is_gst}
                onChange={() => setFormData(prev => ({ ...prev, is_gst: false }))}
                className="w-5 h-5"
              />
              <span>Non-GST</span>
            </label>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-semibold">Purchase Items</h3>
            <Button type="button" onClick={addItem} size="sm">+ Add Item</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">S#</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">QTY</th>
                  <th className="p-2">@</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                      >
                        <option value="">Select</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-20 p-2 border rounded"
                        min="1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-24 p-2 border rounded"
                        step="0.01"
                      />
                    </td>
                    <td className="p-2 font-semibold">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-sm">PO Amount</p>
              <p className="text-lg font-bold">{formatCurrency(subtotal)}</p>
            </div>
            <div>
              <p className="text-sm">GST</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(gstAmount)}</p>
            </div>
            <div>
              <p className="text-sm">Total</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(total)}</p>
            </div>
            <div>
              <p className="text-sm">Previous</p>
              <p className="text-lg font-bold">0.00</p>
            </div>
            <div>
              <p className="text-sm">Final Payable</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(total)}</p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save Purchase Order'}
          </Button>
          <Button type="button" variant="outline" className="flex-1">
            Print PO
          </Button>
          <Button type="button" variant="danger" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
