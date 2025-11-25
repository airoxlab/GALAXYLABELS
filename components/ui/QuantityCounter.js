'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QuantityCounter({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  placeholder = "0",
  className = "",
  disabled = false,
  required = false,
  allowDecimal = false
}) {
  const numValue = parseFloat(value) || 0;

  const handleIncrement = () => {
    if (disabled) return;
    const newValue = Math.min(numValue + step, max);
    onChange(allowDecimal ? newValue.toString() : Math.floor(newValue).toString());
  };

  const handleDecrement = () => {
    if (disabled) return;
    const newValue = Math.max(numValue - step, min);
    onChange(allowDecimal ? newValue.toString() : Math.floor(newValue).toString());
  };

  const handleChange = (e) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      onChange('');
      return;
    }

    if (allowDecimal) {
      // Allow decimal input
      if (/^\d*\.?\d*$/.test(inputValue)) {
        onChange(inputValue);
      }
    } else {
      // Only allow integers
      if (/^\d*$/.test(inputValue)) {
        onChange(inputValue);
      }
    }
  };

  const handleBlur = () => {
    if (value === '') return;

    let finalValue = parseFloat(value) || 0;
    finalValue = Math.max(min, Math.min(finalValue, max));

    if (!allowDecimal) {
      finalValue = Math.floor(finalValue);
    }

    onChange(finalValue.toString());
  };

  return (
    <div className={cn(
      "flex items-center border border-neutral-300 rounded-lg overflow-hidden",
      "focus-within:ring-2 focus-within:ring-neutral-900 focus-within:border-neutral-900",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || numValue <= min}
        className={cn(
          "px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 transition-colors",
          "border-r border-neutral-300",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-neutral-100"
        )}
      >
        <Minus className="w-4 h-4 text-neutral-700" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn(
          "flex-1 px-3 py-2.5 text-sm text-center",
          "bg-white border-0",
          "focus:outline-none",
          "disabled:bg-neutral-50"
        )}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || numValue >= max}
        className={cn(
          "px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 transition-colors",
          "border-l border-neutral-300",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-neutral-100"
        )}
      >
        <Plus className="w-4 h-4 text-neutral-700" />
      </button>
    </div>
  );
}
