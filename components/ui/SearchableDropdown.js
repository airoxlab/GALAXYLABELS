'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchableDropdown({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to filter...',
  error,
  disabled = false,
  className,
  allowClear = true,
  emptyMessage = 'No options found',
  onQuickAdd,
  quickAddLabel = 'Add new',
  compact = false,
  onOpenAddModal,
  addModalLabel = 'Add new',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected option label - use loose comparison to handle string/number mismatches
  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length === 1) {
        // Select the only matching option
        handleSelect(filteredOptions[0].value);
      } else if (filteredOptions.length === 0 && searchQuery.trim() && onQuickAdd) {
        // Quick add when no options match and Enter is pressed
        onQuickAdd(searchQuery.trim());
        setSearchQuery('');
        setIsOpen(false);
      }
    }
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-medium text-neutral-700 mb-0.5">
          {label}
        </label>
      )}

      {/* Trigger - Shows search input when open */}
      {!isOpen ? (
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={cn(
            'w-full flex items-center justify-between gap-1 cursor-pointer',
            compact ? 'px-2 py-1' : 'px-3 py-2.5',
            'bg-white border rounded-lg',
            'text-sm',
            'text-left transition-all duration-200',
            error
              ? 'border-red-300'
              : 'border-neutral-200/60 hover:border-neutral-300',
            disabled && 'opacity-50 cursor-not-allowed bg-neutral-50'
          )}
        >
          <span className={cn(
            'truncate',
            selectedOption ? 'text-neutral-900' : 'text-neutral-500'
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          <div className="flex items-center gap-0.5">
            {allowClear && value && !disabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear(e);
                }}
                className="p-0.5 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              >
                <X className="w-3 h-3 text-neutral-400" />
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </div>
        </div>
      ) : (
        /* Search Input - Replaces trigger when open */
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className={cn(
              'w-full pl-9 pr-3',
              compact ? 'py-1' : 'py-2.5',
              'bg-white border border-neutral-300 rounded-lg',
              'text-sm placeholder:text-neutral-400',
              'focus:outline-none focus:ring-1 focus:ring-neutral-900/10',
              'transition-all duration-200'
            )}
          />
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute w-full mt-1',
            'bg-white',
            'border border-neutral-200/60 rounded-lg',
            'shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
            'z-[99999]'
          )}
        >
          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-neutral-500 text-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5',
                    'text-xs text-left transition-all duration-150',
                    option.value === value
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="w-3 h-3 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Quick Add Button - At bottom */}
          {onQuickAdd && searchQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                onQuickAdd(searchQuery.trim());
                setSearchQuery('');
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5',
                'text-xs text-left transition-all duration-150',
                'text-neutral-700 hover:bg-neutral-50',
                'border-t border-neutral-100'
              )}
            >
              <Plus className="w-3 h-3 text-neutral-500" />
              <span>{quickAddLabel}: <strong>"{searchQuery.trim()}"</strong></span>
            </button>
          )}

          {/* Modal Add Button - Always visible at bottom */}
          {onOpenAddModal && (
            <button
              type="button"
              onClick={() => {
                onOpenAddModal(searchQuery.trim());
                setSearchQuery('');
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-2',
                'text-xs text-left transition-all duration-150',
                'text-neutral-900 hover:bg-neutral-100',
                'border-t border-neutral-200 bg-neutral-50/50',
                'font-medium'
              )}
            >
              <div className="w-5 h-5 bg-neutral-900 rounded flex items-center justify-center">
                <Plus className="w-3 h-3 text-white" />
              </div>
              <span>{addModalLabel}</span>
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-[10px] text-red-500">{error}</p>
      )}
    </div>
  );
}
