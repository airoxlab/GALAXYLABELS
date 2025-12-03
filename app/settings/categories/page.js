'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { cn } from '@/lib/utils';
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

export default function CategoriesPage() {
  const { user } = useAuth();
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
    if (user) {
      fetchCategories();
    }
  }, [user]);

  async function fetchCategories() {
    try {
      setLoading(true);
      const userId = user.parentUserId || user.id;
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
      const userId = user.parentUserId || user.id;

      if (editingCategory) {
        // Update existing category
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
      } else {
        // Create new category
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
      const userId = user.parentUserId || user.id;

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', userId);

      if (error) {
        if (error.code === '23503') {
          alert('Cannot delete this category because it is being used by products.');
          return;
        }
        throw error;
      }

      await fetchCategories();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Failed to delete category. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute requiredPermission="settings_view">
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Categories</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Manage product categories for better organization
              </p>
            </div>
            <button
              onClick={openAddModal}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5",
                "bg-neutral-900 text-white rounded-xl",
                "hover:bg-neutral-800 transition-colors",
                "text-sm font-medium"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 text-sm",
                "bg-white border border-neutral-200 rounded-xl",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                "placeholder:text-neutral-400"
              )}
            />
          </div>

          {/* Categories List */}
          <div className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <FolderOpen className="w-12 h-12 mb-3 text-neutral-300" />
                <p className="text-sm">
                  {searchQuery ? 'No categories found matching your search' : 'No categories added yet'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-neutral-900">{category.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-neutral-600 line-clamp-2">
                          {category.description || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(category)}
                            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-neutral-500" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(category)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Electronics, Clothing, Food"
                    className={cn(
                      "w-full px-4 py-2.5 text-sm",
                      "bg-white border border-neutral-200 rounded-xl",
                      "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                      "placeholder:text-neutral-400"
                    )}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description for this category"
                    rows={3}
                    className={cn(
                      "w-full px-4 py-2.5 text-sm",
                      "bg-white border border-neutral-200 rounded-xl",
                      "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                      "placeholder:text-neutral-400",
                      "resize-none"
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium",
                      "bg-neutral-100 text-neutral-700 rounded-xl",
                      "hover:bg-neutral-200 transition-colors"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium",
                      "bg-neutral-900 text-white rounded-xl",
                      "hover:bg-neutral-800 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingCategory ? 'Update' : 'Add'} Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Delete Category</h3>
                <p className="text-sm text-neutral-600 mb-6">
                  Are you sure you want to delete "<span className="font-medium">{deleteConfirm.name}</span>"?
                  This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium",
                      "bg-neutral-100 text-neutral-700 rounded-xl",
                      "hover:bg-neutral-200 transition-colors"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={saving}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium",
                      "bg-red-600 text-white rounded-xl",
                      "hover:bg-red-700 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
