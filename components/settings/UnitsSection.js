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
  Ruler,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function UnitsSection({ userId }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({ name: '', symbol: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchUnits();
    }
  }, [userId]);

  async function fetchUnits() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (err) {
      console.error('Error fetching units:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (unit.symbol && unit.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function openAddModal() {
    setEditingUnit(null);
    setFormData({ name: '', symbol: '' });
    setError('');
    setShowModal(true);
  }

  function openEditModal(unit) {
    setEditingUnit(unit);
    setFormData({ name: unit.name, symbol: unit.symbol || '' });
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingUnit(null);
    setFormData({ name: '', symbol: '' });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Unit name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({
            name: formData.name.trim(),
            symbol: formData.symbol.trim() || null,
          })
          .eq('id', editingUnit.id)
          .eq('user_id', userId);

        if (error) {
          if (error.code === '23505') {
            setError('A unit with this name already exists');
            return;
          }
          throw error;
        }
        toast.success('Unit updated', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
      } else {
        const { error } = await supabase
          .from('units')
          .insert({
            user_id: userId,
            name: formData.name.trim(),
            symbol: formData.symbol.trim() || null,
          });

        if (error) {
          if (error.code === '23505') {
            setError('A unit with this name already exists');
            return;
          }
          throw error;
        }
        toast.success('Unit added', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
      }

      await fetchUnits();
      closeModal();
    } catch (err) {
      console.error('Error saving unit:', err);
      setError('Failed to save unit. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(unit) {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id)
        .eq('user_id', userId);

      if (error) {
        if (error.code === '23503') {
          toast.error('Cannot delete - unit is being used by products', { duration: 3000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
          return;
        }
        throw error;
      }

      toast.success('Unit deleted', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
      await fetchUnits();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting unit:', err);
      toast.error('Failed to delete unit', { duration: 2000, style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Units</h2>
          <p className="text-[10px] text-neutral-500 mt-0.5">Manage measurement units for your products</p>
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
          Add Unit
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
        <input
          type="text"
          placeholder="Search units..."
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

      {/* Units List */}
      <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
            <Ruler className="w-8 h-8 mb-2 text-neutral-300" />
            <p className="text-xs">
              {searchQuery ? 'No units found' : 'No units added yet'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-100/80 border-b border-neutral-200/60">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-600 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-600 uppercase">Symbol</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-white/50 transition-colors">
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium text-neutral-900">{unit.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-neutral-600">{unit.symbol || '-'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(unit)}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(unit)}
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
                {editingUnit ? 'Edit Unit' : 'Add New Unit'}
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
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Kilogram, Piece, Meter"
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
                  Symbol (Abbreviation)
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                  placeholder="e.g., kg, pcs, m"
                  autoComplete="off"
                  className={cn(
                    "w-full px-3 py-2 text-xs",
                    "bg-white border border-neutral-200 rounded-lg",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                    "placeholder:text-neutral-400"
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
                  {editingUnit ? 'Update' : 'Add'}
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
              <h3 className="text-sm font-semibold text-neutral-900 mb-1">Delete Unit</h3>
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
