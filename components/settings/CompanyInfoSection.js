'use client';

import { cn } from '@/lib/utils';

export default function CompanyInfoSection({ formData, onChange }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-900">Company Information</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-neutral-700 mb-1">Company Name</label>
          <input
            type="text"
            name="company_name"
            value={formData.company_name}
            onChange={onChange}
            placeholder="Enter company name"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Contact 1</label>
          <input
            type="text"
            name="contact_detail_1"
            value={formData.contact_detail_1}
            onChange={onChange}
            placeholder="Phone number"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Contact 2</label>
          <input
            type="text"
            name="contact_detail_2"
            value={formData.contact_detail_2}
            onChange={onChange}
            placeholder="Phone number"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Contact 3</label>
          <input
            type="text"
            name="contact_detail_3"
            value={formData.contact_detail_3}
            onChange={onChange}
            placeholder="Phone number"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">NTN Number</label>
          <input
            type="text"
            name="ntn"
            value={formData.ntn}
            onChange={onChange}
            placeholder="Enter NTN"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">STR Number</label>
          <input
            type="text"
            name="str"
            value={formData.str}
            onChange={onChange}
            placeholder="Enter STR"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Email 1</label>
          <input
            type="email"
            name="email_1"
            value={formData.email_1}
            onChange={onChange}
            placeholder="email@company.com"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Email 2</label>
          <input
            type="email"
            name="email_2"
            value={formData.email_2}
            onChange={onChange}
            placeholder="email@company.com"
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200"
            )}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-neutral-700 mb-1">Company Address</label>
          <textarea
            name="company_address"
            value={formData.company_address}
            onChange={onChange}
            placeholder="Enter company address"
            rows={3}
            className={cn(
              "w-full px-3 py-2 text-xs",
              "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all duration-200 resize-none"
            )}
          />
        </div>
      </div>
    </div>
  );
}
