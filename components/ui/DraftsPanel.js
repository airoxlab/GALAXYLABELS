'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Edit3, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * DraftsPanel - A reusable component for displaying and managing drafts
 *
 * @param {Object} props
 * @param {Array} props.drafts - Array of draft objects
 * @param {Function} props.onEdit - Callback when edit button is clicked (receives draft id)
 * @param {Function} props.onDelete - Callback when delete button is clicked (receives draft id)
 * @param {Function} props.formatCurrency - Function to format currency values
 * @param {string} props.type - Type of drafts: 'sale' or 'purchase'
 * @param {string} props.orderNoField - Field name for order number (e.g., 'order_no' or 'po_no')
 * @param {string} props.entityField - Field name for related entity (e.g., 'customers' or 'suppliers')
 * @param {string} props.entityNameField - Field name within entity for name (e.g., 'customer_name' or 'supplier_name')
 */
export default function DraftsPanel({
  drafts = [],
  onEdit,
  onDelete,
  formatCurrency,
  type = 'sale',
  orderNoField = 'order_no',
  entityField = 'customers',
  entityNameField = 'customer_name',
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (drafts.length === 0) {
    return null;
  }

  const toggleButton = (
    <button
      type="button"
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium",
        "border border-neutral-200/60",
        "transition-all duration-200",
        "flex items-center gap-1.5",
        isExpanded ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
      )}
    >
      <Clock className="w-3.5 h-3.5" />
      Drafts ({drafts.length})
    </button>
  );

  const panel = isExpanded && (
    <div className={cn(
      "bg-white/80 backdrop-blur-xl rounded-xl",
      "border border-neutral-200/60",
      "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
      "p-3"
    )}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-neutral-700">Saved Drafts</h3>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="p-1 text-neutral-400 hover:text-neutral-600 rounded transition-all"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {drafts.map(draft => (
          <div key={draft.id} className="flex items-center justify-between p-2 bg-neutral-50/80 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-neutral-900 truncate">
                {draft[orderNoField]}
              </div>
              <div className="text-[10px] text-neutral-500 truncate">
                {draft[entityField]?.[entityNameField] || `No ${type === 'sale' ? 'customer' : 'supplier'}`} • {formatCurrency(draft.total_amount)}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => onEdit(draft.id)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded transition-all"
                title="Edit draft"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(draft.id)}
                className="p-1 text-neutral-500 hover:text-red-500 rounded transition-all"
                title="Delete draft"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return { toggleButton, panel, isExpanded, setIsExpanded };
}

/**
 * Hook to use DraftsPanel functionality
 * Returns the toggle button component and the panel component separately
 * so they can be placed in different parts of the UI
 */
export function useDraftsPanel({
  drafts = [],
  onEdit,
  onDelete,
  formatCurrency,
  type = 'sale',
  orderNoField = 'order_no',
  entityField = 'customers',
  entityNameField = 'customer_name',
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasNoData = drafts.length === 0;

  const ToggleButton = hasNoData ? null : (
    <button
      type="button"
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium",
        "border border-neutral-200/60",
        "transition-all duration-200",
        "flex items-center gap-1.5",
        isExpanded ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
      )}
    >
      <Clock className="w-3.5 h-3.5" />
      Drafts ({drafts.length})
    </button>
  );

  const Panel = (!isExpanded || hasNoData) ? null : (
    <div className={cn(
      "bg-white/80 backdrop-blur-xl rounded-xl",
      "border border-neutral-200/60",
      "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
      "p-3"
    )}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-neutral-700">Saved Drafts</h3>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="p-1 text-neutral-400 hover:text-neutral-600 rounded transition-all"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {drafts.map(draft => (
          <div key={draft.id} className="flex items-center justify-between p-2 bg-neutral-50/80 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-neutral-900 truncate">
                {draft[orderNoField]}
              </div>
              <div className="text-[10px] text-neutral-500 truncate">
                {draft[entityField]?.[entityNameField] || `No ${type === 'sale' ? 'customer' : 'supplier'}`} • {formatCurrency(draft.total_amount)}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => onEdit(draft.id)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded transition-all"
                title="Edit draft"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(draft.id)}
                className="p-1 text-neutral-500 hover:text-red-500 rounded transition-all"
                title="Delete draft"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return {
    ToggleButton,
    Panel,
    isExpanded,
    setIsExpanded,
    hasDrafts: !hasNoData
  };
}
