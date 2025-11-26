'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Receipt, Plus } from 'lucide-react';

export default function ExpenseDrawer({
  isOpen,
  onClose,
  expense,
  categories,
  onSubmit,
  isLoading,
  onAddCategory
}) {
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '',
    amount: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
        category_id: expense.category_id || '',
        amount: expense.amount || '',
        description: expense.description || '',
        notes: expense.notes || '',
      });
    } else {
      setFormData({
        expense_date: new Date().toISOString().split('T')[0],
        category_id: '',
        amount: '',
        description: '',
        notes: '',
      });
    }
  }, [expense, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-full max-w-md z-50",
        "bg-white/95 backdrop-blur-xl",
        "border-l border-neutral-200/60",
        "shadow-[0_0_60px_rgba(0,0,0,0.15)]",
        "transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
                {expense ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <p className="text-xs text-neutral-500">
                {expense ? 'Update expense details' : 'Record a new expense'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto h-[calc(100%-140px)]">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="expense_date"
              value={formData.expense_date}
              onChange={handleChange}
              required
              className={cn(
                "w-full px-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200"
              )}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                required
                className={cn(
                  "flex-1 px-4 py-2.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                  "text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {onAddCategory && (
                <button
                  type="button"
                  onClick={onAddCategory}
                  className={cn(
                    "px-3 py-2.5 rounded-xl",
                    "bg-neutral-100 text-neutral-600",
                    "hover:bg-neutral-200",
                    "transition-all duration-200"
                  )}
                  title="Add new category"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
              required
              min="0"
              step="0.01"
              className={cn(
                "w-full px-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200"
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of expense"
              required
              className={cn(
                "w-full px-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200"
              )}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes (optional)"
              rows={3}
              className={cn(
                "w-full px-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200 resize-none"
              )}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-neutral-200/60 bg-white/80 backdrop-blur-xl">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl font-medium text-sm",
                "bg-white border border-neutral-200/60 text-neutral-700",
                "hover:bg-neutral-50 hover:border-neutral-300",
                "transition-all duration-200"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl font-medium text-sm",
                "bg-neutral-900 text-white",
                "shadow-lg shadow-neutral-900/20",
                "hover:bg-neutral-800 hover:-translate-y-[1px] hover:shadow-xl",
                "active:translate-y-0",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              )}
            >
              {isLoading ? 'Saving...' : expense ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
