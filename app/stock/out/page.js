'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/ui/Notifications';

export default function StockOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    product_id: '',
    warehouse_id: '',
    quantity: '',
    reference_type: 'sale',
    reference_no: '',
    customer_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [productsRes, warehousesRes, customersRes] = await Promise.all([
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('id, name').eq('is_active', true).order('name'),
      supabase.from('customers').select('id, customer_name').eq('is_active', true).order('customer_name'),
    ]);

    setProducts(productsRes.data || []);
    setWarehouses(warehousesRes.data || []);
    setCustomers(customersRes.data || []);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('stock_out').insert([{
        date: formData.date,
        product_id: formData.product_id,
        warehouse_id: formData.warehouse_id,
        quantity: parseFloat(formData.quantity),
        reference_type: formData.reference_type,
        reference_no: formData.reference_no,
        customer_id: formData.customer_id || null,
        notes: formData.notes,
      }]);

      if (error) throw error;

      notify.success('Stock Out recorded successfully!');
      router.push('/stock');
    } catch (error) {
      console.error('Error recording stock out:', error);
      notify.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Stock Out</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Remove stock from warehouse
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock Out Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Date *"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />

                <Select
                  label="Product *"
                  name="product_id"
                  value={formData.product_id}
                  onChange={handleChange}
                  required
                  options={[
                    { value: '', label: 'Select Product' },
                    ...products.map(p => ({ value: p.id.toString(), label: p.name }))
                  ]}
                />

                <Select
                  label="Warehouse *"
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleChange}
                  required
                  options={[
                    { value: '', label: 'Select Warehouse' },
                    ...warehouses.map(w => ({ value: w.id.toString(), label: w.name }))
                  ]}
                />

                <Input
                  label="Quantity *"
                  name="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />

                <Select
                  label="Reference Type"
                  name="reference_type"
                  value={formData.reference_type}
                  onChange={handleChange}
                  options={[
                    { value: 'sale', label: 'Sales Invoice' },
                    { value: 'production', label: 'Production Use' },
                    { value: 'return', label: 'Purchase Return' },
                    { value: 'damage', label: 'Damage/Loss' },
                    { value: 'adjustment', label: 'Adjustment' },
                    { value: 'other', label: 'Other' },
                  ]}
                />

                <Input
                  label="Reference Number"
                  name="reference_no"
                  value={formData.reference_no}
                  onChange={handleChange}
                  placeholder="e.g., INV-001"
                />

                <Select
                  label="Customer"
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Select Customer (Optional)' },
                    ...customers.map(c => ({ value: c.id.toString(), label: c.customer_name }))
                  ]}
                />
              </div>

              <div className="mt-6">
                <Textarea
                  label="Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Recording...' : 'Record Stock Out'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
