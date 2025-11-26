'use client';

import { cn } from '@/lib/utils';

const prefixFields = [
  { prefix: 'sale_order_prefix', number: 'sale_order_next_number', label: 'Sale Order Prefix' },
  { prefix: 'sale_invoice_prefix', number: 'sale_invoice_next_number', label: 'Sale Invoice Prefix' },
  { prefix: 'purchase_order_prefix', number: 'purchase_order_next_number', label: 'Purchase Order Prefix' },
  { prefix: 'payment_in_prefix', number: 'payment_in_next_number', label: 'Payment In Prefix' },
  { prefix: 'payment_out_prefix', number: 'payment_out_next_number', label: 'Payment Out Prefix' },
  { prefix: 'stock_in_prefix', number: 'stock_in_next_number', label: 'Stock In Prefix' },
  { prefix: 'stock_out_prefix', number: 'stock_out_next_number', label: 'Stock Out Prefix' },
];

export default function InvoicePrefixSection({ invoicePrefixes, onChange }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-900">Invoice Number Settings</h2>
      <p className="text-xs text-neutral-500">Configure prefixes and starting numbers for different document types. Numbers auto-increment after each use.</p>

      <div className="space-y-3">
        {prefixFields.map(field => (
          <div key={field.prefix} className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">{field.label}</label>
              <input
                type="text"
                name={field.prefix}
                value={invoicePrefixes[field.prefix]}
                onChange={onChange}
                className={cn(
                  "w-full px-3 py-2 text-xs",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Next #</label>
              <input
                type="number"
                name={field.number}
                value={invoicePrefixes[field.number]}
                onChange={onChange}
                min="1"
                className={cn(
                  "w-full px-3 py-2 text-xs",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
                )}
              />
            </div>
            <div className="col-span-3 text-[10px] text-neutral-500">
              Preview: {invoicePrefixes[field.prefix]}-{String(invoicePrefixes[field.number]).padStart(4, '0')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
