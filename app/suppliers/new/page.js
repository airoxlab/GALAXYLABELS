'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function NewSupplierPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    mobile_no: '',
    whatsapp_no: '',
    email: '',
    address: '',
    ntn: '',
    str: '',
    opening_balance: 0,
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.supplier_name.trim()) {
      newErrors.supplier_name = 'Supplier name is required';
    }
    if (!formData.mobile_no.trim()) {
      newErrors.mobile_no = 'Mobile number is required';
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([
          {
            ...formData,
            current_balance: parseFloat(formData.opening_balance) || 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Create ledger entry for opening balance
      if (parseFloat(formData.opening_balance) !== 0) {
        await supabase.from('supplier_ledger').insert([
          {
            supplier_id: data.id,
            transaction_type: 'opening',
            transaction_date: new Date().toISOString().split('T')[0],
            debit: parseFloat(formData.opening_balance) > 0 ? parseFloat(formData.opening_balance) : 0,
            credit: parseFloat(formData.opening_balance) < 0 ? Math.abs(parseFloat(formData.opening_balance)) : 0,
            balance: parseFloat(formData.opening_balance),
            description: 'Opening Balance',
          },
        ]);
      }

      alert('Supplier created successfully!');
      router.push('/suppliers');
    } catch (error) {
      console.error('Error creating supplier:', error);
      alert('Error creating supplier: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Add New Supplier
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Create a new supplier record
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Supplier Name *"
                  name="supplier_name"
                  value={formData.supplier_name}
                  onChange={handleChange}
                  placeholder="Enter supplier name"
                  error={errors.supplier_name}
                />
                <Input
                  label="Contact Person"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  placeholder="Enter contact person name"
                />
                <Input
                  label="Mobile Number *"
                  name="mobile_no"
                  value={formData.mobile_no}
                  onChange={handleChange}
                  placeholder="+92-XXX-XXXXXXX"
                  error={errors.mobile_no}
                />
                <Input
                  label="WhatsApp Number"
                  name="whatsapp_no"
                  value={formData.whatsapp_no}
                  onChange={handleChange}
                  placeholder="+92-XXX-XXXXXXX"
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="supplier@example.com"
                  error={errors.email}
                />
                <Input
                  label="Opening Balance"
                  name="opening_balance"
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax & Registration Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="NTN (National Tax Number)"
                  name="ntn"
                  value={formData.ntn}
                  onChange={handleChange}
                  placeholder="Enter NTN"
                />
                <Input
                  label="STR (Sales Tax Registration)"
                  name="str"
                  value={formData.str}
                  onChange={handleChange}
                  placeholder="Enter STR"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address & Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Textarea
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter supplier address"
                  rows={3}
                />
                <Textarea
                  label="Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional notes about this supplier"
                  rows={4}
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
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Creating...' : 'Create Supplier'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
