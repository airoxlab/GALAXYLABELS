'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { X, Download, FileText, Calendar, User, Phone, Hash, DollarSign, CreditCard, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function PaymentViewModal({ payment, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);

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

  const isPaymentIn = payment?.type === 'in';
  const partyName = payment?.party_name || '-';
  const partyType = isPaymentIn ? 'Customer' : 'Supplier';

  // Calculate total cash from denominations
  const calculateCashTotal = () => {
    if (payment?.payment_method !== 'cash') return 0;
    const d = payment;
    return (
      (d.denomination_10 || 0) * 10 +
      (d.denomination_20 || 0) * 20 +
      (d.denomination_50 || 0) * 50 +
      (d.denomination_100 || 0) * 100 +
      (d.denomination_500 || 0) * 500 +
      (d.denomination_1000 || 0) * 1000 +
      (d.denomination_5000 || 0) * 5000
    );
  };

  const hasDenominations = payment?.payment_method === 'cash' && (
    payment.denomination_10 || payment.denomination_20 || payment.denomination_50 ||
    payment.denomination_100 || payment.denomination_500 || payment.denomination_1000 ||
    payment.denomination_5000
  );

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
        "w-full max-w-2xl max-h-[90vh] overflow-hidden",
        "mx-4"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              isPaymentIn ? "bg-green-100" : "bg-red-100"
            )}>
              {isPaymentIn ? (
                <ArrowDownCircle className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowUpCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Payment {isPaymentIn ? 'In' : 'Out'} Details
              </h2>
              <p className="text-xs text-neutral-500">
                {formatDate(payment?.payment_date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg text-neutral-400",
              "hover:bg-neutral-100 hover:text-neutral-600",
              "transition-colors"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Party Information */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">
              {partyType} Information
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500">{partyType}</p>
                  <p className="text-sm font-medium text-neutral-900">{partyName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">
              Payment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  <p className="text-xs text-neutral-500">Payment Date</p>
                </div>
                <p className="text-sm font-medium text-neutral-900">
                  {formatDate(payment?.payment_date)}
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-neutral-400" />
                  <p className="text-xs text-neutral-500">Payment Method</p>
                </div>
                <p className="text-sm font-medium text-neutral-900 capitalize">
                  {payment?.payment_method === 'cash' ? 'Cash' :
                   payment?.payment_method === 'bank_transfer' ? 'Bank Transfer' :
                   payment?.payment_method === 'online' ? 'Online' : payment?.payment_method}
                </p>
              </div>

              {payment?.online_reference && (
                <div className="bg-neutral-50 rounded-lg p-4 col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-4 h-4 text-neutral-400" />
                    <p className="text-xs text-neutral-500">Reference Number</p>
                  </div>
                  <p className="text-sm font-medium text-neutral-900">
                    {payment.online_reference}
                  </p>
                </div>
              )}

              <div className={cn(
                "rounded-lg p-4",
                isPaymentIn ? "bg-green-50" : "bg-red-50",
                "col-span-2"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-neutral-400" />
                  <p className="text-xs text-neutral-500">Amount</p>
                </div>
                <p className={cn(
                  "text-2xl font-bold",
                  isPaymentIn ? "text-green-600" : "text-red-600"
                )}>
                  {isPaymentIn ? '+' : '-'}{formatCurrency(payment?.amount)}
                </p>
              </div>

              <div className="bg-neutral-50 rounded-lg p-4 col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-neutral-400" />
                  <p className="text-xs text-neutral-500">Balance After Payment</p>
                </div>
                <p className="text-sm font-medium text-neutral-900">
                  {formatCurrency(payment?.balance_after)}
                </p>
              </div>
            </div>
          </div>

          {/* Cash Denominations */}
          {hasDenominations && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">
                Cash Denominations
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <div className="space-y-2">
                  {payment.denomination_5000 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 5,000 x {payment.denomination_5000}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_5000 * 5000)}
                      </span>
                    </div>
                  )}
                  {payment.denomination_1000 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 1,000 x {payment.denomination_1000}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_1000 * 1000)}
                      </span>
                    </div>
                  )}
                  {payment.denomination_500 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 500 x {payment.denomination_500}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_500 * 500)}
                      </span>
                    </div>
                  )}
                  {payment.denomination_100 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 100 x {payment.denomination_100}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_100 * 100)}
                      </span>
                    </div>
                  )}
                  {payment.denomination_50 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 50 x {payment.denomination_50}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_50 * 50)}
                      </span>
                    </div>
                  )}
                  {payment.denomination_20 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 20 x {payment.denomination_20}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_20 * 20)}
                      </span>
                    </div>
                  )}
                  {payment.denomination_10 > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Rs 10 x {payment.denomination_10}</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(payment.denomination_10 * 10)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-neutral-200 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-neutral-700">Total Cash</span>
                      <span className="text-sm font-bold text-neutral-900">
                        {formatCurrency(calculateCashTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {payment?.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3">Notes</h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                  {payment.notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "text-neutral-700 bg-white border border-neutral-300",
              "hover:bg-neutral-100",
              "transition-colors"
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
