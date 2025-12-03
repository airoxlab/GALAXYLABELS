'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { X, Download, FileText, Calendar, User, Phone, Hash, Package } from 'lucide-react';
import { downloadPurchaseOrderPDF } from './PurchasePDF';

export default function PurchaseViewModal({ purchaseId, isOpen, onClose, settings }) {
  const [purchase, setPurchase] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && purchaseId) {
      fetchPurchaseDetails();
    }
  }, [isOpen, purchaseId]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  async function fetchPurchaseDetails() {
    setLoading(true);
    try {
      const [purchaseRes, itemsRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*, suppliers(supplier_name, mobile_no, address)')
          .eq('id', purchaseId)
          .single(),
        supabase
          .from('purchase_order_items')
          .select('*, products(categories(name))')
          .eq('po_id', purchaseId)
      ]);

      if (purchaseRes.error) throw purchaseRes.error;
      setPurchase(purchaseRes.data);
      setItems(itemsRes.data || []);
    } catch (error) {
      console.error('Error fetching purchase order:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (purchase && items.length > 0) {
      await downloadPurchaseOrderPDF(purchase, items, settings);
    }
  }

  const formatCurrency = (amount) => {
    return 'Rs ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        "relative bg-white rounded-2xl shadow-2xl",
        "w-full max-w-3xl max-h-[90vh] overflow-hidden",
        "mx-4"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-neutral-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Purchase Order Details</h2>
              <p className="text-xs text-neutral-500">
                {loading ? 'Loading...' : purchase?.po_no || '-'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={loading || !purchase}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium",
                "bg-neutral-900 text-white",
                "hover:bg-neutral-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-1.5"
              )}
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full" />
            </div>
          ) : purchase ? (
            <div className="space-y-4">
              {/* Purchase & Supplier Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                  "bg-neutral-50 rounded-xl p-4",
                  "border border-neutral-200/60"
                )}>
                  <h3 className="text-xs font-semibold text-neutral-700 mb-3">Order Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs text-neutral-600">PO #:</span>
                      <span className="text-xs font-medium text-neutral-900">{purchase.po_no}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs text-neutral-600">Date:</span>
                      <span className="text-xs font-medium text-neutral-900">{formatDate(purchase.po_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        purchase.status === 'received'
                          ? "bg-green-100 text-green-700"
                          : purchase.status === 'partial'
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-neutral-200 text-neutral-700"
                      )}>
                        {purchase.status || 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "bg-neutral-50 rounded-xl p-4",
                  "border border-neutral-200/60"
                )}>
                  <h3 className="text-xs font-semibold text-neutral-700 mb-3">Supplier Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs font-medium text-neutral-900">
                        {purchase.suppliers?.supplier_name || '-'}
                      </span>
                    </div>
                    {purchase.suppliers?.mobile_no && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="text-xs text-neutral-600">{purchase.suppliers.mobile_no}</span>
                      </div>
                    )}
                    {purchase.suppliers?.address && (
                      <div className="text-xs text-neutral-600 mt-1">
                        {purchase.suppliers.address}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className={cn(
                "rounded-xl border border-neutral-200/60 overflow-hidden"
              )}>
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-neutral-600">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-neutral-600">Product</th>
                      <th className="px-3 py-2 text-center font-semibold text-neutral-600">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-neutral-600">Unit Price</th>
                      <th className="px-3 py-2 text-right font-semibold text-neutral-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50">
                        <td className="px-3 py-2 text-neutral-500">{index + 1}</td>
                        <td className="px-3 py-2 font-medium text-neutral-900">{item.product_name}</td>
                        <td className="px-3 py-2 text-center text-neutral-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-neutral-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium text-neutral-900">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className={cn(
                  "bg-neutral-50 rounded-xl p-4 w-64",
                  "border border-neutral-200/60"
                )}>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-600">Subtotal</span>
                      <span className="font-medium text-neutral-900">{formatCurrency(purchase.subtotal)}</span>
                    </div>
                    {purchase.is_gst && (
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-600">GST ({purchase.gst_percentage}%)</span>
                        <span className="font-medium text-neutral-900">{formatCurrency(purchase.gst_amount)}</span>
                      </div>
                    )}
                    <div className="border-t border-neutral-200 pt-2 flex justify-between">
                      <span className="text-sm font-semibold text-neutral-900">Total</span>
                      <span className="text-sm font-semibold text-neutral-900">{formatCurrency(purchase.total_amount)}</span>
                    </div>
                    {purchase.previous_balance > 0 && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-600">Previous Balance</span>
                          <span className="font-medium text-neutral-900">{formatCurrency(purchase.previous_balance)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-600">Final Payable</span>
                          <span className="font-semibold text-red-600">{formatCurrency(purchase.final_payable)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {purchase.notes && (
                <div className={cn(
                  "bg-neutral-50 rounded-xl p-4",
                  "border border-neutral-200/60"
                )}>
                  <h3 className="text-xs font-semibold text-neutral-700 mb-2">Notes</h3>
                  <p className="text-xs text-neutral-600">{purchase.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-neutral-500">Purchase order not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
