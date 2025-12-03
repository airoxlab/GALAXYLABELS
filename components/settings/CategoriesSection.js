'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  FolderOpen,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function CategoriesSection({ userId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchCategories();
    }
  }, [userId]);

  async function fetchCategories() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function openAddModal() {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setError('');
    setShowModal(true);
  }

  function openEditModal(category) {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .eq('id', editingCategory.id)
          .eq('user_id', userId);

        if (error) {
          if (error.code === '23505') {
            setError('A category with this name already exists');
            return;
          }
          throw error;
        }
        toast.success('Category updated', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            user_id: userId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          });

        if (error) {
          if (error.code === '23505') {
            setError('A category with this name already exists');
            return;
          }
          throw error;
        }
        toast.success('Category added', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
      }

      await fetchCategories();
      closeModal();
    } catch (err) {
      console.error('Error saving category:', err);
      setError('Failed to save category. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', userId);

      if (error) {
        if (error.code === '23503') {
          toast.error('Cannot delete - category is being used by products', { duration: 3000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
          return;
        }
        throw error;
      }

      toast.success('Category deleted', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
      await fetchCategories();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Failed to delete category', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Categories</h2>
          <p className="text-[10px] text-neutral-500 mt-0.5">Manage product categories for better organization</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5",
            "bg-neutral-900 text-white rounded-lg",
            "hover:bg-neutral-800 transition-colors",
            "text-xs font-medium"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Category
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          className={cn(
            "w-full pl-9 pr-3 py-2 text-xs",
            "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
            "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
            "placeholder:text-neutral-400"
          )}
        />
      </div>

      {/* Categories List */}
      <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
            <FolderOpen className="w-8 h-8 mb-2 text-neutral-300" />
            <p className="text-xs">
              {searchQuery ? 'No categories found' : 'No categories added yet'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-100/80 border-b border-neutral-200/60">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-600 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-600 uppercase">Description</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-white/50 transition-colors">
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium text-neutral-900">{category.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-neutral-600 line-clamp-1">{category.description || '-'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(category)}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(category)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3" autoComplete="off">
              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Electronics, Clothing, Food"
                  autoComplete="off"
                  className={cn(
                    "w-full px-3 py-2 text-xs",
                    "bg-white border border-neutral-200 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "placeholder:text-neutral-400"
                  )}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this category"
                  rows={2}
                  autoComplete="off"
                  className={cn(
                    "w-full px-3 py-2 text-xs",
                    "bg-white border border-neutral-200 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "placeholder:text-neutral-400",
                    "resize-none"
                  )}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs font-medium",
                    "bg-neutral-100 text-neutral-700 rounded-lg",
                    "hover:bg-neutral-200 transition-colors"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs font-medium",
                    "bg-neutral-900 text-white rounded-lg",
                    "hover:bg-neutral-800 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingCategory ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-xs shadow-xl p-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-1">Delete Category</h3>
              <p className="text-xs text-neutral-600 mb-4">
                Delete "<span className="font-medium">{deleteConfirm.name}</span>"? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs font-medium",
                    "bg-neutral-100 text-neutral-700 rounded-lg",
                    "hover:bg-neutral-200 transition-colors"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={saving}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs font-medium",
                    "bg-red-600 text-white rounded-lg",
                    "hover:bg-red-700 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
