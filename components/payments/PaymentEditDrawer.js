'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/ui/Notifications';

export default function PaymentEditDrawer({
  isOpen,
  onClose,
  payment,
  onSaved
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [userId, setUserId] = useState(null);

  const [formData, setFormData] = useState({
    payment_date: '',
    payment_method: 'cash',
    online_reference: '',
    amount: '',
    notes: '',
    customer_id: '',
    supplier_id: '',
  });

  const [denominations, setDenominations] = useState({
    denomination_10: 0,
    denomination_20: 0,
    denomination_50: 0,
    denomination_100: 0,
    denomination_500: 0,
    denomination_1000: 0,
    denomination_5000: 0,
  });

  useEffect(() => {
    if (isOpen && payment) {
      fetchUser();
      loadPayment();
    }
  }, [isOpen, payment]);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.user) {
        setUserId(data.user.id);
        fetchCustomers(data.user.id);
        fetchSuppliers(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchCustomers(uid) {
    try {
      const { data } = await supabase
        .from('customers')
        .select('id, customer_name')
        .eq('user_id', uid)
        .eq('is_active', true)
        .order('customer_name');
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function fetchSuppliers(uid) {
    try {
      const { data } = await supabase
        .from('suppliers')
        .select('id, supplier_name')
        .eq('user_id', uid)
        .eq('is_active', true)
        .order('supplier_name');
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  function loadPayment() {
    if (!payment) return;

    setFormData({
      payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment.payment_method || 'cash',
      online_reference: payment.online_reference || '',
      amount: payment.amount || '',
      notes: payment.notes || '',
      customer_id: payment.customer_id?.toString() || '',
      supplier_id: payment.supplier_id?.toString() || '',
    });

    setDenominations({
      denomination_10: payment.denomination_10 || 0,
      denomination_20: payment.denomination_20 || 0,
      denomination_50: payment.denomination_50 || 0,
      denomination_100: payment.denomination_100 || 0,
      denomination_500: payment.denomination_500 || 0,
      denomination_1000: payment.denomination_1000 || 0,
      denomination_5000: payment.denomination_5000 || 0,
    });
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDenominationChange = (name, value) => {
    const numValue = parseInt(value) || 0;
    setDenominations(prev => ({ ...prev, [name]: numValue }));
  };

  const calculateTotal = () => {
    return (
      denominations.denomination_10 * 10 +
      denominations.denomination_20 * 20 +
      denominations.denomination_50 * 50 +
      denominations.denomination_100 * 100 +
      denominations.denomination_500 * 500 +
      denominations.denomination_1000 * 1000 +
      denominations.denomination_5000 * 5000
    );
  };

  useEffect(() => {
    if (formData.payment_method === 'cash') {
      const total = calculateTotal();
      setFormData(prev => ({ ...prev, amount: total.toString() }));
    }
  }, [denominations, formData.payment_method]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      if (!payment) return;

      const tableName = payment.type === 'in' ? 'payments_in' : 'payments_out';
      const partyIdField = payment.type === 'in' ? 'customer_id' : 'supplier_id';
      const balanceField = payment.type === 'in' ? 'customer_balance' : 'supplier_balance';

      // Get current party balance
      const partyTable = payment.type === 'in' ? 'customers' : 'suppliers';
      const partyId = payment.type === 'in' ? formData.customer_id : formData.supplier_id;

      const { data: partyData } = await supabase
        .from(partyTable)
        .select('current_balance')
        .eq('id', partyId)
        .single();

      // Calculate new balance
      const oldAmount = parseFloat(payment.amount) || 0;
      const newAmount = parseFloat(formData.amount) || 0;
      const balanceDiff = newAmount - oldAmount;
      const newBalance = (parseFloat(partyData?.current_balance) || 0) + (payment.type === 'in' ? -balanceDiff : balanceDiff);

      // Update payment
      const updateData = {
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        online_reference: formData.online_reference,
        amount: parseFloat(formData.amount),
        notes: formData.notes,
        [balanceField]: newBalance,
        ...denominations,
      };

      if (payment.type === 'in') {
        updateData.customer_id = parseInt(formData.customer_id);
      } else {
        updateData.supplier_id = parseInt(formData.supplier_id);
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', payment.id);

      if (updateError) throw updateError;

      // Update party balance
      const { error: balanceError } = await supabase
        .from(partyTable)
        .update({ current_balance: newBalance })
        .eq('id', partyId);

      if (balanceError) throw balanceError;

      notify.success('Payment updated successfully!');
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error updating payment:', error);
      notify.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (amount) => {
    return 'Rs ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  const isPaymentIn = payment?.type === 'in';
  const partyType = isPaymentIn ? 'Customer' : 'Supplier';

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 bg-neutral-50">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Edit Payment {isPaymentIn ? 'In' : 'Out'}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Update payment transaction details
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg text-neutral-400",
              "hover:bg-neutral-200 hover:text-neutral-600",
              "transition-colors"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="h-[calc(100%-180px)] overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Party Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {partyType} *
              </label>
              <select
                name={isPaymentIn ? 'customer_id' : 'supplier_id'}
                value={isPaymentIn ? formData.customer_id : formData.supplier_id}
                onChange={handleChange}
                required
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                  "transition-all"
                )}
              >
                <option value="">Select {partyType}</option>
                {isPaymentIn ? (
                  customers.map(c => (
                    <option key={c.id} value={c.id}>{c.customer_name}</option>
                  ))
                ) : (
                  suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.supplier_name}</option>
                  ))
                )}
              </select>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Payment Date *
              </label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                required
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                  "transition-all"
                )}
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Payment Method *
              </label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                required
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                  "transition-all"
                )}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online Payment</option>
              </select>
            </div>

            {/* Cash Denominations */}
            {formData.payment_method === 'cash' && (
              <div className="bg-neutral-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">Cash Denominations</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Rs 5,000', name: 'denomination_5000', value: 5000 },
                    { label: 'Rs 1,000', name: 'denomination_1000', value: 1000 },
                    { label: 'Rs 500', name: 'denomination_500', value: 500 },
                    { label: 'Rs 100', name: 'denomination_100', value: 100 },
                    { label: 'Rs 50', name: 'denomination_50', value: 50 },
                    { label: 'Rs 20', name: 'denomination_20', value: 20 },
                    { label: 'Rs 10', name: 'denomination_10', value: 10 },
                  ].map(denom => (
                    <div key={denom.name}>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        {denom.label}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={denominations[denom.name]}
                        onChange={(e) => handleDenominationChange(denom.name, e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border border-neutral-300",
                          "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                          "text-sm"
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-neutral-700">Total Cash:</span>
                    <span className="text-lg font-bold text-neutral-900">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Online Reference */}
            {(formData.payment_method === 'online' || formData.payment_method === 'bank_transfer') && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Reference Number
                </label>
                <input
                  type="text"
                  name="online_reference"
                  value={formData.online_reference}
                  onChange={handleChange}
                  placeholder="Enter reference number"
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg border border-neutral-300",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                    "transition-all"
                  )}
                />
              </div>
            )}

            {/* Amount (for non-cash methods) */}
            {formData.payment_method !== 'cash' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg border border-neutral-300",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                    "transition-all"
                  )}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Add any notes..."
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900",
                  "transition-all resize-none"
                )}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-neutral-200 bg-white">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-6 py-2.5 rounded-lg text-sm font-medium",
                "text-neutral-700 bg-white border border-neutral-300",
                "hover:bg-neutral-50 transition-colors"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                "px-6 py-2.5 rounded-lg text-sm font-medium",
                "bg-neutral-900 text-white",
                "hover:bg-neutral-800 transition-colors",
                "flex items-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
