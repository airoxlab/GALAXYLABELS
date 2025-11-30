'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, Package, Search, ChevronDown } from 'lucide-react';
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
  const [showCategoryAdd, setShowCategoryAdd] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categoryDropdownRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategorySearchOpen(false);
      }
    }

    if (categorySearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [categorySearchOpen]);

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

  const handleAddCategory = async () => {
    if (!categoryInput.trim()) return;

    setAddingCategory(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: userId,
          name: categoryInput.trim(),
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Category added successfully', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      // Refresh categories list
      await fetchCategories();

      // Auto-select the newly added category
      setFormData(prev => ({ ...prev, category_id: data.id }));

      setCategoryInput('');
      setShowCategoryAdd(false);
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setAddingCategory(false);
    }
  };

  const getSelectedCategoryName = () => {
    if (!formData.category_id) return 'Select category';
    const category = categories.find(cat => cat.id === parseInt(formData.category_id));
    return category ? category.name : 'Select category';
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const handleCategorySelect = (categoryId) => {
    setFormData(prev => ({ ...prev, category_id: categoryId }));
    setCategorySearchOpen(false);
    setCategorySearchQuery('');
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
    <div className="fixed inset-0 z-[100] overflow-y-auto">
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
              {!showCategoryAdd ? (
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setCategorySearchOpen(!categorySearchOpen)}
                      className={cn(
                        "w-full px-3 py-2 text-sm text-left",
                        "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                        "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                        "transition-all duration-200",
                        "flex items-center justify-between"
                      )}
                    >
                      <span className={formData.category_id ? 'text-neutral-900' : 'text-neutral-400'}>
                        {getSelectedCategoryName()}
                      </span>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-neutral-400 transition-transform",
                        categorySearchOpen && "rotate-180"
                      )} />
                    </button>

                    {categorySearchOpen && (
                      <div className={cn(
                        "absolute z-50 w-full mt-1",
                        "bg-white border border-neutral-200 rounded-lg shadow-lg",
                        "max-h-60 overflow-hidden"
                      )}>
                        <div className="p-2 border-b border-neutral-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                            <input
                              type="text"
                              value={categorySearchQuery}
                              onChange={(e) => setCategorySearchQuery(e.target.value)}
                              placeholder="Search categories..."
                              className={cn(
                                "w-full pl-8 pr-3 py-1.5 text-xs",
                                "bg-neutral-50 border border-neutral-200 rounded-md",
                                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                              )}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredCategories.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-neutral-400 text-center">
                              No categories found
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCategorySelect('')}
                                className={cn(
                                  "w-full px-3 py-2 text-xs text-left",
                                  "hover:bg-neutral-50 transition-colors",
                                  !formData.category_id && "bg-neutral-100 font-medium"
                                )}
                              >
                                Select category
                              </button>
                              {filteredCategories.map(cat => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => handleCategorySelect(cat.id)}
                                  className={cn(
                                    "w-full px-3 py-2 text-xs text-left",
                                    "hover:bg-neutral-50 transition-colors",
                                    formData.category_id === cat.id && "bg-neutral-100 font-medium"
                                  )}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCategoryAdd(true)}
                    className={cn(
                      "px-3 py-2 rounded-lg",
                      "bg-neutral-900 text-white",
                      "hover:bg-neutral-800",
                      "transition-all duration-200"
                    )}
                    title="Add new category"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] text-neutral-400 font-medium">Add New Category</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      placeholder="Enter category name"
                      autoFocus
                      className={cn(
                        "flex-1 px-3 py-2 text-sm",
                        "bg-white border border-neutral-300 rounded-lg",
                        "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900",
                        "transition-all duration-200"
                      )}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={addingCategory || !categoryInput.trim()}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium",
                        "bg-neutral-900 text-white",
                        "hover:bg-neutral-800",
                        "transition-all duration-200",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {addingCategory ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryInput('');
                        setShowCategoryAdd(false);
                      }}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm",
                        "bg-neutral-100 text-neutral-600",
                        "hover:bg-neutral-200",
                        "transition-all duration-200"
                      )}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
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
