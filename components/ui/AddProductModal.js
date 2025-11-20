'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function AddProductModal({
  isOpen,
  onClose,
  onProductAdded,
  userId,
  initialName = '',
}) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    unit_price: '',
  });

  useEffect(() => {
    if (isOpen && userId) {
      fetchCategories();
      setFormData({
        name: initialName,
        category_id: '',
        unit_price: '',
      });
    }
  }, [isOpen, userId, initialName]);

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          user_id: userId,
          name: formData.name.trim(),
          category_id: formData.category_id || null,
          unit_price: parseFloat(formData.unit_price) || 0,
          is_active: true,
          current_stock: 0,
        }])
        .select(`
          id,
          name,
          unit_price,
          category_id,
          categories (
            id,
            name
          )
        `)
        .single();

      if (error) throw error;

      toast.success('Product added successfully', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      if (onProductAdded) {
        onProductAdded(data);
      }
      onClose();
    } catch (error) {
      console.error('Error adding product:', error);
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
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-neutral-600" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Add New Product
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
            {/* Product Name */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter product name"
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

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Category
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className={cn(
                  "w-full px-3 py-2 text-sm",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Unit Price
              </label>
              <input
                type="number"
                name="unit_price"
                value={formData.unit_price}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={cn(
                  "w-full px-3 py-2 text-sm",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
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
                  "bg-neutral-900 text-white",
                  "shadow-lg shadow-neutral-900/20",
                  "hover:bg-neutral-800",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-1.5"
                )}
              >
                <Plus className="w-4 h-4" />
                {loading ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
