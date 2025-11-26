'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function AddCustomerModal({
  isOpen,
  onClose,
  onCustomerAdded,
  userId,
  initialName = '',
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    mobile_no: '',
    address: '',
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer_name: initialName,
        mobile_no: '',
        address: '',
      });
    }
  }, [isOpen, initialName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name.trim()) {
      toast.error('Customer name is required', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          user_id: userId,
          customer_name: formData.customer_name.trim(),
          mobile_no: formData.mobile_no.trim() || null,
          address: formData.address.trim() || null,
          is_active: true,
          current_balance: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Customer added successfully', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      if (onCustomerAdded) {
        onCustomerAdded(data);
      }
      onClose();
    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={cn(
          "relative bg-white rounded-xl shadow-2xl w-full max-w-md",
          "border border-neutral-200/60"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Add New Customer
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                placeholder="Enter customer name"
                className={cn(
                  "w-full px-3 py-2 text-sm",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
                autoFocus
                required
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Mobile Number
              </label>
              <input
                type="text"
                name="mobile_no"
                value={formData.mobile_no}
                onChange={handleChange}
                placeholder="Enter mobile number"
                className={cn(
                  "w-full px-3 py-2 text-sm",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter address"
                rows={2}
                className={cn(
                  "w-full px-3 py-2 text-sm",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200 resize-none"
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg font-medium text-sm",
                  "bg-white border border-neutral-200/60 text-neutral-700",
                  "hover:bg-neutral-50",
                  "transition-all duration-200"
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg font-medium text-sm",
                  "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
                  "shadow-lg shadow-amber-500/20",
                  "hover:from-amber-600 hover:to-orange-700",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-1.5"
                )}
              >
                <Plus className="w-4 h-4" />
                {loading ? 'Adding...' : 'Add Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
