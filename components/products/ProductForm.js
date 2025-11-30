'use client';

import { useState, useEffect } from 'react';

export default function ProductForm({ product, categories, units, onSubmit, onCancel, isLoading, onAddCategory, onAddUnit, userId }) {
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    unit_id: '',
    size_width: '',
    size_length: '',
    color: '',
    weight: '',
    unit_price: '',
    notes: '',
  });

  const [categoryInput, setCategoryInput] = useState('');
  const [unitInput, setUnitInput] = useState('');
  const [showCategoryAdd, setShowCategoryAdd] = useState(false);
  const [showUnitAdd, setShowUnitAdd] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        category_id: product.category_id || '',
        unit_id: product.unit_id || '',
        size_width: product.size_width || '',
        size_length: product.size_length || '',
        color: product.color || '',
        weight: product.weight || '',
        unit_price: product.unit_price || '',
        notes: product.notes || '',
      });
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleAddCategory = async () => {
    if (!categoryInput.trim() || !onAddCategory) return;

    setAddingCategory(true);
    try {
      const newCategory = await onAddCategory(categoryInput.trim());
      if (newCategory) {
        setFormData(prev => ({ ...prev, category_id: newCategory.id }));
      }
      setCategoryInput('');
      setShowCategoryAdd(false);
    } catch (error) {
      console.error('Error adding category:', error);
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddUnit = async () => {
    if (!unitInput.trim() || !onAddUnit) return;

    setAddingUnit(true);
    try {
      const newUnit = await onAddUnit(unitInput.trim());
      if (newUnit) {
        setFormData(prev => ({ ...prev, unit_id: newUnit.id }));
      }
      setUnitInput('');
      setShowUnitAdd(false);
    } catch (error) {
      console.error('Error adding unit:', error);
    } finally {
      setAddingUnit(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Name */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter product name"
          required
          className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Category</label>
        {!showCategoryAdd ? (
          <div className="flex gap-2">
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="flex-1 px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCategoryAdd(true)}
              className="px-3 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all"
              title="Add new category"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
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
                className="flex-1 px-3 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all duration-200"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={addingCategory || !categoryInput.trim()}
                className="px-3 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingCategory ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryInput('');
                  setShowCategoryAdd(false);
                }}
                className="px-3 py-2 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unit */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Unit</label>
        {!showUnitAdd ? (
          <div className="flex gap-2">
            <select
              name="unit_id"
              value={formData.unit_id}
              onChange={handleChange}
              className="flex-1 px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
            >
              <option value="">Select Unit</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ''}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowUnitAdd(true)}
              className="px-3 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all"
              title="Add new unit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 font-medium">Add New Unit</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={unitInput}
                onChange={(e) => setUnitInput(e.target.value)}
                placeholder="Enter unit name (e.g., Pieces, Meters)"
                autoFocus
                className="flex-1 px-3 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all duration-200"
              />
              <button
                type="button"
                onClick={handleAddUnit}
                disabled={addingUnit || !unitInput.trim()}
                className="px-3 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingUnit ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnitInput('');
                  setShowUnitAdd(false);
                }}
                className="px-3 py-2 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Width</label>
          <input
            type="number"
            name="size_width"
            value={formData.size_width}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Length</label>
          <input
            type="number"
            name="size_length"
            value={formData.size_length}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Weight</label>
          <input
            type="number"
            name="weight"
            value={formData.weight}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
          />
        </div>
      </div>

      {/* Color and Price */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Color</label>
          <input
            type="text"
            name="color"
            value={formData.color}
            onChange={handleChange}
            placeholder="e.g., Red, Blue, White"
            className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">
            Unit Price <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="unit_price"
            value={formData.unit_price}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            required
            className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Additional notes about the product..."
          rows={3}
          className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200 resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-white border border-neutral-200/60 text-neutral-700 rounded-xl font-medium text-sm hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-medium text-sm shadow-lg shadow-neutral-900/20 hover:bg-neutral-800 hover:-translate-y-[1px] hover:shadow-xl active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {product ? 'Update Product' : 'Save Product'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
