'use client';

import Button from '@/components/ui/Button';

export default function WarehouseCard({ warehouse, index, onEdit, onDelete, onToggleActive }) {
  return (
    <div
      className={`group relative bg-white rounded-xl border transition-all duration-300 overflow-hidden ${
        warehouse.is_active
          ? 'border-slate-200 hover:border-blue-300 hover:shadow-lg'
          : 'border-slate-200 opacity-60'
      }`}
    >
      {/* Status Indicator */}
      <div
        className={`absolute top-0 left-0 w-1 h-full transition-colors ${
          warehouse.is_active ? 'bg-blue-600' : 'bg-slate-400'
        }`}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {/* Index Badge */}
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">{index + 1}</span>
              </div>

              {/* Name and Status */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate">
                  {warehouse.name}
                </h3>
                {!warehouse.is_active && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {/* Location */}
            {warehouse.location && (
              <div className="flex items-start gap-2 mt-2">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-slate-600 line-clamp-2">{warehouse.location}</p>
              </div>
            )}

            {/* Created Date */}
            {warehouse.created_at && (
              <div className="flex items-center gap-2 mt-2">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-slate-500">
                  {new Date(warehouse.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Toggle Active/Inactive */}
            <button
              onClick={() => onToggleActive(warehouse.id, warehouse.is_active)}
              className={`p-2 rounded-lg transition-all ${
                warehouse.is_active
                  ? 'text-green-600 hover:bg-green-50'
                  : 'text-slate-400 hover:bg-slate-100'
              }`}
              title={warehouse.is_active ? 'Deactivate' : 'Activate'}
            >
              {warehouse.is_active ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>

            {/* Edit */}
            <button
              onClick={() => onEdit(warehouse)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Edit warehouse"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(warehouse.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Delete warehouse"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
