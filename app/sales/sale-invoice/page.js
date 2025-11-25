'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { FileText, Clock, Shield, Globe } from 'lucide-react';

export default function SaleInvoicePage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-2xl p-12",
          "border border-neutral-200/60",
          "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
          "text-center max-w-md"
        )}>
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-neutral-400" />
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight mb-2">
            FBR E-Invoice Integration
          </h1>
          <p className="text-sm text-neutral-500 mb-6">
            This page will be used for FBR (Federal Board of Revenue) e-invoicing integration.
            You can create regular invoices from the Sale Order page.
          </p>

          <div className="space-y-3 text-left bg-neutral-50/80 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-neutral-700">Tax Compliance</div>
                <div className="text-[10px] text-neutral-500">Generate FBR compliant e-invoices</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-neutral-700">Real-time Reporting</div>
                <div className="text-[10px] text-neutral-500">Submit invoices to FBR portal</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
            <Clock className="w-4 h-4" />
            Coming Soon
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
