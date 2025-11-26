'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';

export default function PaymentInForm({ payment, customers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    receipt_no: '',
    date: new Date().toISOString().split('T')[0],
    customer_id: '',
    payment_method: 'cash',
    bank_name: '',
    cheque_no: '',
    cheque_date: '',
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

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (payment) {
      setFormData({
        receipt_no: payment.receipt_no || '',
        date: payment.date || new Date().toISOString().split('T')[0],
        customer_id: payment.customer_id || '',
        payment_method: payment.payment_method || 'cash',
        bank_name: payment.bank_name || '',
        cheque_no: payment.cheque_no || '',
        cheque_date: payment.cheque_date || '',
        amount: payment.amount || '',
        notes: payment.notes || '',
      });
      if (payment.denominations) {
        setDenominations(payment.denominations);
      }
    } else {
      // Generate receipt number for new payments
      generateReceiptNo();
    }
  }, [payment]);

  useEffect(() => {
    if (formData.customer_id) {
      const customer = customers.find(c => c.id === parseInt(formData.customer_id));
      setSelectedCustomer(customer);
    }
  }, [formData.customer_id, customers]);

  async function generateReceiptNo() {
    const timestamp = Date.now().toString().slice(-6);
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, receipt_no: `RCP-${timestamp}${randomNum}` }));
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, denominations: formData.payment_method === 'cash' ? denominations : null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Receipt Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Receipt No <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="receipt_no"
            value={formData.receipt_no}
            onChange={handleChange}
            required
            readOnly
            className="w-full px-4 py-3 bg-green-50 border border-green-200 rounded-xl focus:outline-none text-sm font-semibold text-green-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Customer <span className="text-red-500">*</span>
          </label>
          <select
            name="customer_id"
            value={formData.customer_id}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
          >
            <option value="">Select Customer</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_name} ({formatCurrency(customer.current_balance)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer Balance Info */}
      {selectedCustomer && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            Current Balance: <span className="font-bold text-lg">{formatCurrency(selectedCustomer.current_balance)}</span>
          </p>
        </div>
      )}

      {/* Payment Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
          >
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="online">Online Payment</option>
          </select>
        </div>

        {formData.payment_method !== 'cash' && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Bank Name</label>
            <input
              type="text"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleChange}
              placeholder="Enter bank name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
            />
          </div>
        )}
      </div>

      {/* Cheque Details */}
      {formData.payment_method === 'cheque' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Cheque Number</label>
            <input
              type="text"
              name="cheque_no"
              value={formData.cheque_no}
              onChange={handleChange}
              placeholder="Enter cheque number"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Cheque Date</label>
            <input
              type="date"
              name="cheque_date"
              value={formData.cheque_date}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
            />
          </div>
        </div>
      )}

      {/* Cash Denominations */}
      {formData.payment_method === 'cash' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Cash Denominations</h3>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">PKR {label}</label>
                <input
                  type="number"
                  min="0"
                  value={denominations[key]}
                  onChange={(e) => handleDenominationChange(key, e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">= {formatCurrency(denominations[key] * value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amount & Notes */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-2xl font-bold"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Payment notes..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm resize-none"
          />
        </div>
      </div>

      {/* New Balance Preview */}
      {selectedCustomer && formData.amount && (
        <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-xl p-6">
          <p className="text-sm text-slate-600 text-center">New Balance After Payment</p>
          <p className="text-3xl font-bold text-green-600 text-center mt-2">
            {formatCurrency((selectedCustomer.current_balance || 0) - parseFloat(formData.amount || 0))}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {payment ? 'Update Payment' : 'Receive Payment'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
