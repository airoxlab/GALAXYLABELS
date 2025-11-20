'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Tag, Edit3, Trash2, Plus } from 'lucide-react';

export default function CategoryDrawer({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  isLoading
}) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewCategoryName('');
      setEditingCategory(null);
      setEditName('');
    }
  }, [isOpen]);

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  };

  const handleStartEdit = (category) => {
    setEditingCategory(category.id);
    setEditName(category.name);
  };

  const handleSaveEdit = (id) => {
    if (editName.trim()) {
      onEditCategory(id, editName.trim());
      setEditingCategory(null);
      setEditName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
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
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
                Expense Categories
              </h2>
              <p className="text-xs text-neutral-500">
                Manage your expense categories
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

        {/* Add New Category */}
        <div className="px-6 py-4 border-b border-neutral-200/60">
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className={cn(
                "flex-1 px-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200"
              )}
            />
            <button
              type="submit"
              disabled={!newCategoryName.trim() || isLoading}
              className={cn(
                "px-4 py-2.5 rounded-xl font-medium text-sm",
                "bg-neutral-900 text-white",
                "shadow-lg shadow-neutral-900/20",
                "hover:bg-neutral-800 hover:-translate-y-[1px] hover:shadow-xl",
                "active:translate-y-0",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
                "flex items-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="p-6 overflow-y-auto h-[calc(100%-180px)]">
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-base font-medium text-neutral-900 mb-1">No categories yet</h3>
              <p className="text-sm text-neutral-500">
                Add your first expense category above
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                    "hover:bg-neutral-100/80 transition-colors"
                  )}
                >
                  {editingCategory === category.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={cn(
                          "flex-1 px-3 py-1.5",
                          "bg-white border border-neutral-200/60 rounded-lg",
                          "text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-neutral-900/10",
                          "transition-all duration-200"
                        )}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(category.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-neutral-900">{category.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(category)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/60 rounded-lg transition-all"
                          title="Edit category"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteCategory(category.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
