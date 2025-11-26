'use client';

import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import SearchableDropdown from '@/components/ui/SearchableDropdown';

export default function CurrencySection({
  selectedCurrencies,
  defaultCurrency,
  newCurrencyCode,
  currencyOptions,
  onAddCurrency,
  onRemoveCurrency,
  onUpdateRate,
  onSetDefault,
  onNewCurrencyChange,
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-900">Currency Settings</h2>
      <p className="text-xs text-neutral-500">Add currencies you want to use and set exchange rates to PKR.</p>

      {/* Add Currency */}
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchableDropdown
            options={currencyOptions}
            value={newCurrencyCode}
            onChange={onNewCurrencyChange}
            placeholder="Select currency to add"
            searchPlaceholder="Search currency..."
            emptyMessage="No currencies available"
          />
        </div>
        <button
          type="button"
          onClick={onAddCurrency}
          disabled={!newCurrencyCode}
          className={cn(
            "px-3 py-2 rounded-lg",
            "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
            "shadow-lg shadow-emerald-500/20",
            "text-xs font-medium",
            "hover:from-emerald-600 hover:to-teal-700",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-1"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Default Currency */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">Default Currency</label>
        <select
          value={defaultCurrency}
          onChange={(e) => onSetDefault(e.target.value)}
          className={cn(
            "w-full px-3 py-2 text-xs",
            "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
            "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
          )}
        >
          {selectedCurrencies.map(currency => (
            <option key={currency.code} value={currency.code}>
              {currency.code} - {currency.name}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Currencies List */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-neutral-700">Selected Currencies & Exchange Rates</label>
        <div className="rounded-lg border border-neutral-200/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50/80">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-neutral-600">Currency</th>
                <th className="px-3 py-2 text-center font-medium text-neutral-600">Symbol</th>
                <th className="px-3 py-2 text-center font-medium text-neutral-600">Rate to PKR</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {selectedCurrencies.map(currency => (
                <tr key={currency.code} className="hover:bg-neutral-50/50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900">{currency.code}</div>
                    <div className="text-[10px] text-neutral-500">{currency.name}</div>
                  </td>
                  <td className="px-3 py-2 text-center text-neutral-600">
                    {currency.symbol}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={currency.rate_to_pkr}
                      onChange={(e) => onUpdateRate(currency.code, e.target.value)}
                      disabled={currency.code === 'PKR'}
                      step="0.01"
                      className={cn(
                        "w-full px-2 py-1 text-xs text-center",
                        "bg-white border border-neutral-200/60 rounded",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                        "disabled:bg-neutral-100 disabled:text-neutral-500"
                      )}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {currency.code !== 'PKR' && (
                      <button
                        type="button"
                        onClick={() => onRemoveCurrency(currency.code)}
                        className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
