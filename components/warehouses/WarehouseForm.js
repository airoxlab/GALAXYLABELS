'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function WarehouseForm({ warehouse, onSubmit, onCancel, isLoading }) {
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
  }, [warehouse]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className={cn(
      "bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden",
      "border border-neutral-200/60",
      "shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
    )}>
      {/* Header */}
      <div className="bg-neutral-900 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {warehouse ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              )}
            </svg>
          </div>
          <div>
            <h2 className="text-base font-medium text-white">
              {warehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {warehouse ? 'Update warehouse information' : 'Create a new warehouse location'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Warehouse Name */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">
            Warehouse Name
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Warehouse, Storage Unit A"
              required
              className={cn(
                "w-full pl-10 pr-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm placeholder:text-neutral-400",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200"
              )}
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">
            Location
          </label>
          <div className="relative">
            <div className="absolute top-3 left-0 flex items-start pl-3 pointer-events-none">
              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <textarea
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Enter complete address or location details..."
              rows={3}
              className={cn(
                "w-full pl-10 pr-4 py-2.5",
                "bg-neutral-50/80 border border-neutral-200/60 rounded-xl",
                "text-sm placeholder:text-neutral-400 resize-none",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300",
                "transition-all duration-200"
              )}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Optional: Add city, address, or any location details
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {warehouse && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2.5 bg-white border border-neutral-200/60 text-neutral-700 rounded-xl font-medium text-sm hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-medium text-sm shadow-lg shadow-neutral-900/20 hover:bg-neutral-800 hover:-translate-y-[1px] hover:shadow-xl active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {warehouse ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Update Warehouse
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Warehouse
                  </>
                )}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
