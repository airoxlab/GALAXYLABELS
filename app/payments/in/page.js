'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/ui/Notifications';
import { Download } from 'lucide-react';

export default function PaymentInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [userId, setUserId] = useState(null);
  const [lastSavedPayment, setLastSavedPayment] = useState(null);

  const [formData, setFormData] = useState({
    receipt_no: '',
    date: new Date().toISOString().split('T')[0],
    customer_id: '',
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
        setUserId(data.user.id);
        fetchCustomers(data.user.id);
        fetchSettings(data.user.id);
        generateReceiptNo(data.user.id);
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
        .select('payment_in_prefix, payment_in_next_number')
        .eq('user_id', uid)
        .single();

      if (settingsError) throw settingsError;

      const prefix = settingsData?.payment_in_prefix || 'PI';
      const nextNumber = settingsData?.payment_in_next_number || 1;
      const receiptNo = `${prefix}-${String(nextNumber).padStart(4, '0')}`;

      setFormData(prev => ({ ...prev, receipt_no: receiptNo }));
    } catch (error) {
      console.error('Error generating receipt number:', error);
      // Fallback to default
      setFormData(prev => ({ ...prev, receipt_no: 'PI-0001' }));
    }
  }

  async function fetchCustomers(uid) {
    const { data } = await supabase
      .from('customers')
      .select('id, customer_name, current_balance, mobile_no, address')
      .eq('user_id', uid)
      .eq('is_active', true)
      .order('customer_name');

    setCustomers(data || []);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'customer_id') {
      const customer = customers.find(c => c.id === parseInt(value));
      setSelectedCustomer(customer);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      const previousBalance = selectedCustomer?.current_balance || 0;
      const newBalance = previousBalance - amount;

      // Insert payment
      const paymentData = {
        user_id: userId,
        receipt_no: formData.receipt_no,
        payment_date: formData.date,
        customer_id: parseInt(formData.customer_id),
        payment_method: formData.payment_method,
        amount: amount,
        customer_balance: newBalance,
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

      const { data: payment, error: paymentError } = await supabase
        .from('payments_in')
        .insert([paymentData])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update customer balance
      await supabase
        .from('customers')
        .update({ current_balance: newBalance })
        .eq('id', formData.customer_id);

      // Add to customer ledger
      await supabase.from('customer_ledger').insert([{
        user_id: userId,
        customer_id: formData.customer_id,
        transaction_type: 'payment',
        transaction_date: formData.date,
        reference_id: payment.id,
        reference_no: formData.receipt_no,
        debit: 0,
        credit: amount,
        balance: newBalance,
        description: `Payment received - ${formData.payment_method}`,
      }]);

      // Increment payment_in_next_number in settings
      if (settings) {
        const nextNumber = (settings.payment_in_next_number || 1) + 1;
        await supabase
          .from('settings')
          .update({ payment_in_next_number: nextNumber })
          .eq('user_id', userId);
      }

      // Store the saved payment for download
      setLastSavedPayment({
        ...payment,
        denominations: formData.payment_method === 'cash' ? denominations : null
      });

      notify.success('Payment received successfully!');
    } catch (error) {
      console.error('Error recording payment:', error);
      notify.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!lastSavedPayment || !selectedCustomer) {
      notify.error('No payment to download');
      return;
    }

    try {
      const { downloadPaymentReceiptPDF } = await import('@/components/payments/PaymentPDF');
      await downloadPaymentReceiptPDF(lastSavedPayment, selectedCustomer, settings, { showLogo: true, showQR: true });
      notify.success('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      notify.error('Error downloading receipt: ' + error.message);
    }
  };

  const handleSaveAndDownload = async (e) => {
    e.preventDefault();
    await handleSubmit(e);
  };

  const handleNewPayment = () => {
    setLastSavedPayment(null);
    setFormData({
      receipt_no: '',
      date: new Date().toISOString().split('T')[0],
      customer_id: '',
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
    setSelectedCustomer(null);
    if (userId) generateReceiptNo(userId);
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Payment In</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Receive payment from customer
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="bg-green-50"
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
                  label="Customer *"
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  required
                  options={[
                    { value: '', label: 'Select Customer' },
                    ...customers.map(c => ({
                      value: c.id.toString(),
                      label: `${c.customer_name} (${formatCurrency(c.current_balance)})`
                    }))
                  ]}
                />
              </div>

              {selectedCustomer && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Current Balance: <span className="font-bold">{formatCurrency(selectedCustomer.current_balance)}</span>
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
                        value={denominations[key]}
                        onChange={(e) => handleDenominationChange(key, e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        = {formatCurrency(denominations[key] * value)}
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

          {selectedCustomer && formData.amount && (
            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardContent className="text-center p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">New Balance After Payment</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency((selectedCustomer.current_balance || 0) - parseFloat(formData.amount || 0))}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {lastSavedPayment ? (
            // After saving - show download and new payment options
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto"
              >
                Back to Dashboard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleNewPayment}
                className="w-full sm:w-auto"
              >
                New Payment
              </Button>
              <Button
                type="button"
                onClick={handleDownloadReceipt}
                className="w-full sm:w-auto flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Receipt
              </Button>
            </div>
          ) : (
            // Before saving - show cancel and save options
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
                {loading ? 'Processing...' : 'Receive Payment'}
              </Button>
            </div>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
}
