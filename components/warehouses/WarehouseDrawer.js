'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Warehouse, MapPin } from 'lucide-react';

export default function WarehouseDrawer({ isOpen, onClose, warehouse, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
  });

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || '',
        location: warehouse.location || '',
      });
    } else {
      setFormData({
        name: '',
        location: '',
      });
    }
  }, [warehouse, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-full max-w-md z-50",
        "bg-white shadow-2xl",
        "transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="bg-neutral-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Warehouse className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">
                  {warehouse ? 'Edit Warehouse' : 'Add Warehouse'}
                </h2>
                <p className="text-[10px] text-neutral-400">
                  {warehouse ? 'Update warehouse details' : 'Create a new warehouse'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Warehouse Name */}
          <div>
            <label className="block text-[10px] font-medium text-neutral-500 mb-1">
              Warehouse Name
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <Warehouse className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Warehouse, Storage Unit A"
                required
                className={cn(
                  "w-full pl-8 pr-3 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs placeholder:text-neutral-400",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[10px] font-medium text-neutral-500 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-400" />
              <textarea
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter complete address or location details..."
                rows={3}
                className={cn(
                  "w-full pl-8 pr-3 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs placeholder:text-neutral-400 resize-none",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>
            <p className="text-[9px] text-neutral-400 mt-0.5">
              Optional: Add city, address, or any location details
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium text-xs",
                "bg-white border border-neutral-200/60 text-neutral-700",
                "hover:bg-neutral-50 hover:border-neutral-300",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-lg font-medium text-xs",
                "bg-neutral-900 text-white",
                "shadow-md shadow-neutral-900/20",
                "hover:bg-neutral-800",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                warehouse ? 'Update Warehouse' : 'Add Warehouse'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
