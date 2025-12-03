'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/ui/Notifications';
import { History, FileText } from 'lucide-react';

export default function PaymentOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [lastSavedPayment, setLastSavedPayment] = useState(null);

  const [formData, setFormData] = useState({
    receipt_no: '',
    date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    payment_method: 'cash',
    online_reference: '',
    amount: '',
    notes: '',
  });

  const [denominations, setDenominations] = useState({
    note_5000: 0,
    note_1000: 0,
    note_500: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
  });

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
        // Use parentUserId for data queries (staff sees parent account data)
        const dataUserId = data.user.parentUserId || data.user.id;
        fetchSuppliers(dataUserId);
        fetchSettings(dataUserId);
        generateReceiptNo(dataUserId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchSettings(uid) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', uid)
        .single();

      if (!error && data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }

  async function generateReceiptNo(uid) {
    try {
      // Fetch settings to get prefix and next number
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('payment_out_prefix, payment_out_next_number')
        .eq('user_id', uid)
        .single();

      if (settingsError) throw settingsError;

      const prefix = settingsData?.payment_out_prefix || 'PO-PAY';
      const nextNumber = settingsData?.payment_out_next_number || 1;
      const receiptNo = `${prefix}-${String(nextNumber).padStart(4, '0')}`;

      setFormData(prev => ({ ...prev, receipt_no: receiptNo }));
    } catch (error) {
      console.error('Error generating receipt number:', error);
      // Fallback to default
      setFormData(prev => ({ ...prev, receipt_no: 'PO-PAY-0001' }));
    }
  }

  async function fetchSuppliers(userId) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, supplier_name, current_balance')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('supplier_name');

    setSuppliers(data || []);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'supplier_id') {
      const supplier = suppliers.find(s => s.id === parseInt(value));
      setSelectedSupplier(supplier);
    }
  };

  const handleDenominationChange = (key, value) => {
    const newDenominations = { ...denominations, [key]: parseInt(value) || 0 };
    setDenominations(newDenominations);

    const total =
      newDenominations.note_5000 * 5000 +
      newDenominations.note_1000 * 1000 +
      newDenominations.note_500 * 500 +
      newDenominations.note_100 * 100 +
      newDenominations.note_50 * 50 +
      newDenominations.note_20 * 20 +
      newDenominations.note_10 * 10;

    setFormData(prev => ({ ...prev, amount: total.toString() }));
  };

  const handleSubmit = async (e, shouldClose = false) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      const previousBalance = selectedSupplier?.current_balance || 0;
      const newBalance = previousBalance - amount;

      // Prepare payment data
      const paymentData = {
        user_id: user.parentUserId || user.id,
        receipt_no: formData.receipt_no,
        payment_date: formData.date,
        supplier_id: parseInt(formData.supplier_id),
        payment_method: formData.payment_method,
        amount: amount,
        supplier_balance: newBalance,
        notes: formData.notes,
      };

      // Add denominations if payment method is cash
      if (formData.payment_method === 'cash') {
        paymentData.denomination_10 = denominations.note_10;
        paymentData.denomination_20 = denominations.note_20;
        paymentData.denomination_50 = denominations.note_50;
        paymentData.denomination_100 = denominations.note_100;
        paymentData.denomination_500 = denominations.note_500;
        paymentData.denomination_1000 = denominations.note_1000;
        paymentData.denomination_5000 = denominations.note_5000;
      }

      // Add online reference if payment method is online
      if (formData.payment_method === 'online' || formData.payment_method === 'bank_transfer') {
        paymentData.online_reference = formData.online_reference || null;
      }

      let payment;

      // Check if we're updating an existing payment
      if (lastSavedPayment?.id) {
        // Update existing payment
        const { data: updatedPayment, error: updateError } = await supabase
          .from('payments_out')
          .update(paymentData)
          .eq('id', lastSavedPayment.id)
          .select()
          .single();

        if (updateError) throw updateError;
        payment = updatedPayment;

        // Update supplier balance
        await supabase
          .from('suppliers')
          .update({ current_balance: newBalance })
          .eq('id', formData.supplier_id);

        // Update supplier ledger
        await supabase
          .from('supplier_ledger')
          .update({
            transaction_date: formData.date,
            debit: amount,
            balance: newBalance,
            description: `Payment made - ${formData.payment_method}`,
          })
          .eq('reference_id', lastSavedPayment.id)
          .eq('transaction_type', 'payment');

        notify.success('Payment updated successfully!');
      } else {
        // Insert new payment
        const { data: newPayment, error: paymentError } = await supabase
          .from('payments_out')
          .insert([paymentData])
          .select()
          .single();

        if (paymentError) throw paymentError;
        payment = newPayment;

        // Update supplier balance
        await supabase
          .from('suppliers')
          .update({ current_balance: newBalance })
          .eq('id', formData.supplier_id);

        // Add to supplier ledger
        await supabase.from('supplier_ledger').insert([{
          user_id: user.parentUserId || user.id,
          supplier_id: parseInt(formData.supplier_id),
          transaction_type: 'payment',
          transaction_date: formData.date,
          reference_id: payment.id,
          reference_no: formData.receipt_no,
          debit: amount,
          credit: 0,
          balance: newBalance,
          description: `Payment made - ${formData.payment_method}`,
        }]);

        // Increment payment_out_next_number in settings only for new payments
        if (settings) {
          const nextNumber = (settings.payment_out_next_number || 1) + 1;
          await supabase
            .from('settings')
            .update({ payment_out_next_number: nextNumber })
            .eq('user_id', user.id);
        }

        notify.success('Payment made successfully!');
      }

      // Store the saved payment
      setLastSavedPayment({
        ...payment,
        denominations: formData.payment_method === 'cash' ? denominations : null
      });

      // If shouldClose is true, redirect to dashboard
      if (shouldClose) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      notify.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewInvoice = async () => {
    if (!selectedSupplier) {
      notify.error('Please select a supplier first');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      notify.error('Please enter a valid amount');
      return;
    }

    try {
      const { previewPaymentOutInvoicePDF } = await import('@/components/payments/PaymentInvoicePDF');

      // Create preview payment object
      const previewPayment = lastSavedPayment || {
        receipt_no: formData.receipt_no,
        payment_date: formData.date,
        date: formData.date,
        payment_method: formData.payment_method,
        online_reference: formData.online_reference,
        amount: parseFloat(formData.amount),
        supplier_balance: selectedSupplier.current_balance - parseFloat(formData.amount),
        notes: formData.notes,
      };

      await previewPaymentOutInvoicePDF(previewPayment, selectedSupplier, settings, { showLogo: true });
      notify.success('Invoice opened in new tab!');
    } catch (error) {
      console.error('Error previewing invoice:', error);
      notify.error('Error previewing invoice: ' + error.message);
    }
  };

  const handleNewPayment = () => {
    setLastSavedPayment(null);
    setFormData({
      receipt_no: '',
      date: new Date().toISOString().split('T')[0],
      supplier_id: '',
      payment_method: 'cash',
      online_reference: '',
      amount: '',
      notes: '',
    });
    setDenominations({
      note_5000: 0,
      note_1000: 0,
      note_500: 0,
      note_100: 0,
      note_50: 0,
      note_20: 0,
      note_10: 0,
    });
    setSelectedSupplier(null);
    if (user) generateReceiptNo(user.parentUserId || user.id);
  };

  return (
    <ProtectedRoute requiredPermission="payments_out_add" showUnauthorized>
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Payment Out</h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
                Make payment to supplier
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastSavedPayment && (
              <Button
                variant="outline"
                onClick={handleNewPayment}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Record
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => router.push('/payments/history')}
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  label="Receipt No *"
                  name="receipt_no"
                  value={formData.receipt_no}
                  onChange={handleChange}
                  required
                  className="bg-red-50"
                />

                <Input
                  label="Date *"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />

                <Select
                  label="Supplier *"
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleChange}
                  required
                  options={[
                    { value: '', label: 'Select Supplier' },
                    ...suppliers.map(s => ({
                      value: s.id.toString(),
                      label: `${s.supplier_name} (${formatCurrency(s.current_balance)})`
                    }))
                  ]}
                />
              </div>

              {selectedSupplier && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300">
                    Current Balance: <span className="font-bold">{formatCurrency(selectedSupplier.current_balance)}</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Select
                  label="Payment Method *"
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                    { value: 'online', label: 'Online Payment' },
                  ]}
                />

                {(formData.payment_method === 'online' || formData.payment_method === 'bank_transfer') && (
                  <Input
                    label="Reference Number"
                    name="online_reference"
                    value={formData.online_reference}
                    onChange={handleChange}
                    placeholder="Enter transaction reference"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {formData.payment_method === 'cash' && (
            <Card>
              <CardHeader>
                <CardTitle>Cash Denominations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: '5000', key: 'note_5000', value: 5000 },
                    { label: '1000', key: 'note_1000', value: 1000 },
                    { label: '500', key: 'note_500', value: 500 },
                    { label: '100', key: 'note_100', value: 100 },
                    { label: '50', key: 'note_50', value: 50 },
                    { label: '20', key: 'note_20', value: 20 },
                    { label: '10', key: 'note_10', value: 10 },
                  ].map(({ label, key, value }) => (
                    <div key={key}>
                      <Input
                        label={`PKR ${label}`}
                        type="number"
                        min="0"
                        value={denominations[key] || 0}
                        onChange={(e) => handleDenominationChange(key, e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        = {formatCurrency((denominations[key] || 0) * value)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <div className="space-y-4">
                <Input
                  label="Amount *"
                  name="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  className="text-2xl font-bold"
                />

                <Textarea
                  label="Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Payment notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {selectedSupplier && formData.amount && (
            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="text-center p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">New Balance After Payment</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {formatCurrency((selectedSupplier.current_balance || 0) - parseFloat(formData.amount || 0))}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewInvoice}
              disabled={!selectedSupplier || !formData.amount}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Preview Payment Invoice
            </Button>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="submit"
                variant="danger"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Processing...' : lastSavedPayment ? 'Update Payment' : 'Save Payment'}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Processing...' : 'Save & Close'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
    </ProtectedRoute>
  );
}
