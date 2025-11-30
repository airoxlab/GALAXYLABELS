'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { notify } from '@/components/ui/Notifications';
import {
  Search, X, ChevronLeft, ChevronRight,
  DollarSign, TrendingUp, TrendingDown, FileText,
  ArrowDownCircle, ArrowUpCircle, Eye, Edit3, Trash2
} from 'lucide-react';
import PaymentViewModal from '@/components/payments/PaymentViewModal';
import PaymentEditDrawer from '@/components/payments/PaymentEditDrawer';
import { useConfirm } from '@/components/ui/Notifications';

export default function PaymentHistoryPage() {
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [transactionType, setTransactionType] = useState('all'); // all, in, out
  const [selectedParty, setSelectedParty] = useState('all'); // customer or supplier
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const { confirmState, showDeleteConfirm, hideConfirm } = useConfirm();

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
        fetchCustomers(data.user.id);
        fetchSuppliers(data.user.id);
        fetchPayments(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  }

  async function fetchCustomers(userId) {
    const { data } = await supabase
      .from('customers')
      .select('id, customer_name')
      .eq('user_id', userId)
      .order('customer_name');

    setCustomers(data || []);
  }

  async function fetchSuppliers(userId) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, supplier_name')
      .eq('user_id', userId)
      .order('supplier_name');

    setSuppliers(data || []);
  }

  async function fetchPayments(userId) {
    setLoading(true);
    try {
      // Fetch Payment In
      // Query in ascending order (oldest first) since we'll reverse for display
      const { data: paymentsIn, error: errorIn } = await supabase
        .from('payments_in')
        .select(`
          id,
          receipt_no,
          payment_date,
          payment_method,
          amount,
          customer_balance,
          online_reference,
          denomination_10,
          denomination_20,
          denomination_50,
          denomination_100,
          denomination_500,
          denomination_1000,
          denomination_5000,
          notes,
          customer_id,
          created_at,
          customers(customer_name)
        `)
        .eq('user_id', userId)
        .order('payment_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (errorIn) throw errorIn;

      // Fetch Payment Out
      const { data: paymentsOut, error: errorOut } = await supabase
        .from('payments_out')
        .select(`
          id,
          receipt_no,
          payment_date,
          payment_method,
          amount,
          supplier_balance,
          online_reference,
          denomination_10,
          denomination_20,
          denomination_50,
          denomination_100,
          denomination_500,
          denomination_1000,
          denomination_5000,
          notes,
          supplier_id,
          created_at,
          suppliers(supplier_name)
        `)
        .eq('user_id', userId)
        .order('payment_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (errorOut) throw errorOut;

      // Combine and format payments
      const formattedPaymentsIn = (paymentsIn || []).map(p => ({
        ...p,
        type: 'in',
        party_name: p.customers?.customer_name || '-',
        party_id: p.customer_id,
        balance_after: p.customer_balance
      }));

      const formattedPaymentsOut = (paymentsOut || []).map(p => ({
        ...p,
        type: 'out',
        party_name: p.suppliers?.supplier_name || '-',
        party_id: p.supplier_id,
        balance_after: p.supplier_balance
      }));

      // Merge and sort by date (oldest first), then by created_at for same dates
      const allPayments = [...formattedPaymentsIn, ...formattedPaymentsOut].sort((a, b) => {
        const dateCompare = new Date(a.payment_date) - new Date(b.payment_date);
        if (dateCompare !== 0) return dateCompare;
        // If dates are equal, sort by created_at timestamp (oldest first)
        return new Date(a.created_at) - new Date(b.created_at);
      });

      // Reverse to show newest first in the UI
      allPayments.reverse();

      setPayments(allPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      notify.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.party_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.receipt_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.online_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = transactionType === 'all' || payment.type === transactionType;

    const matchesParty = selectedParty === 'all' || payment.party_id?.toString() === selectedParty;

    const matchesMethod = selectedMethod === 'all' || payment.payment_method === selectedMethod;

    const matchesDate =
      (!startDate || new Date(payment.payment_date) >= new Date(startDate)) &&
      (!endDate || new Date(payment.payment_date) <= new Date(endDate));

    return matchesSearch && matchesType && matchesParty && matchesMethod && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayments = filteredPayments.slice(startIndex, endIndex);

  // Calculate stats
  const totalPaymentsIn = filteredPayments.filter(p => p.type === 'in');
  const totalPaymentsOut = filteredPayments.filter(p => p.type === 'out');
  const totalAmountIn = totalPaymentsIn.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalAmountOut = totalPaymentsOut.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const cashPayments = filteredPayments.filter(p => p.payment_method === 'cash').length;
  const onlinePayments = filteredPayments.filter(p => p.payment_method === 'online' || p.payment_method === 'bank_transfer').length;

  function handleClearFilters() {
    setSearchQuery('');
    setTransactionType('all');
    setSelectedParty('all');
    setSelectedMethod('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }

  function handleViewDetails(payment) {
    setSelectedPayment(payment);
    setShowViewModal(true);
  }

  function handleEdit(payment) {
    setSelectedPayment(payment);
    setShowEditDrawer(true);
  }

  function handlePaymentSaved() {
    if (user) fetchPayments(user.id);
  }

  async function handleDelete(payment) {
    const tableName = payment.type === 'in' ? 'payments_in' : 'payments_out';
    const paymentType = payment.type === 'in' ? 'Payment In' : 'Payment Out';

    showDeleteConfirm(
      `Delete ${paymentType}`,
      `Are you sure you want to delete this ${paymentType.toLowerCase()}? This action cannot be undone.`,
      async () => {
        try {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', payment.id);

          if (error) throw error;

          notify.success(`${paymentType} deleted successfully!`);
          if (user) fetchPayments(user.id);
        } catch (error) {
          console.error(`Error deleting ${paymentType.toLowerCase()}:`, error);
          notify.error('Error: ' + error.message);
        }
      }
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Get party options based on transaction type
  const getPartyOptions = () => {
    if (transactionType === 'in') {
      return [
        { value: 'all', label: 'All Customers' },
        ...customers.map(c => ({
          value: c.id.toString(),
          label: c.customer_name
        }))
      ];
    } else if (transactionType === 'out') {
      return [
        { value: 'all', label: 'All Suppliers' },
        ...suppliers.map(s => ({
          value: s.id.toString(),
          label: s.supplier_name
        }))
      ];
    } else {
      // Show both customers and suppliers
      return [
        { value: 'all', label: 'All Parties' },
        ...customers.map(c => ({
          value: `c-${c.id}`,
          label: `${c.customer_name} (Customer)`
        })),
        ...suppliers.map(s => ({
          value: `s-${s.id}`,
          label: `${s.supplier_name} (Supplier)`
        }))
      ];
    }
  };

  const typeOptions = [
    { value: 'all', label: 'All Transactions' },
    { value: 'in', label: 'Payment In (Received)' },
    { value: 'out', label: 'Payment Out (Paid)' }
  ];

  const methodOptions = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'online', label: 'Online Payment' }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Payment History</h1>
              <p className="text-sm text-neutral-500">View all payment transactions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/payments/in')}>
              Payment In
            </Button>
            <Button variant="secondary" onClick={() => router.push('/payments/out')}>
              Payment Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Transactions</p>
                <p className="text-xl font-bold text-blue-900">{filteredPayments.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Payments In</p>
                <p className="text-xl font-bold text-emerald-900">{totalPaymentsIn.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <ArrowDownCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-pink-100 rounded-xl border border-rose-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-600 font-medium">Payments Out</p>
                <p className="text-xl font-bold text-rose-900">{totalPaymentsOut.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center">
                <ArrowUpCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Amount In</p>
                <p className="text-xl font-bold text-green-900">{formatCurrency(totalAmountIn)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl border border-red-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Amount Out</p>
                <p className="text-xl font-bold text-red-900">{formatCurrency(totalAmountOut)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-neutral-200/60 p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-[180px]">
              <SearchableDropdown
                options={typeOptions}
                value={transactionType}
                onChange={(val) => {
                  setTransactionType(val);
                  setSelectedParty('all');
                  setCurrentPage(1);
                }}
                placeholder="Transaction Type"
                allowClear={false}
              />
            </div>

            <div className="w-[220px]">
              <SearchableDropdown
                options={getPartyOptions()}
                value={selectedParty}
                onChange={(val) => { setSelectedParty(val); setCurrentPage(1); }}
                placeholder={transactionType === 'in' ? 'Select Customer' : transactionType === 'out' ? 'Select Supplier' : 'Select Party'}
                searchPlaceholder="Search..."
                allowClear={false}
              />
            </div>

            <div className="w-[160px]">
              <SearchableDropdown
                options={methodOptions}
                value={selectedMethod}
                onChange={(val) => { setSelectedMethod(val); setCurrentPage(1); }}
                placeholder="Payment Method"
                allowClear={false}
              />
            </div>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search..."
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm rounded-lg transition-all",
                  "bg-white border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                )}
              />
            </div>

            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              placeholder="From"
              className={cn(
                "w-[140px] px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              placeholder="To"
              className={cn(
                "w-[140px] px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            />

            {(searchQuery || transactionType !== 'all' || selectedParty !== 'all' || selectedMethod !== 'all' || startDate || endDate) && (
              <button
                onClick={handleClearFilters}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                  "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-neutral-200/60 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Payment Transactions</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No payments found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Party</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Method</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Reference</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Amount</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Balance After</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Notes</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {currentPayments.map((payment) => (
                      <tr key={`${payment.type}-${payment.id}`} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-700">{formatDate(payment.payment_date)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            payment.type === 'in'
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {payment.type === 'in' ? (
                              <>
                                <ArrowDownCircle className="w-3 h-3" />
                                Payment In
                              </>
                            ) : (
                              <>
                                <ArrowUpCircle className="w-3 h-3" />
                                Payment Out
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-neutral-900">
                            {payment.party_name}
                          </span>
                          <span className="text-xs text-neutral-500 ml-1">
                            ({payment.type === 'in' ? 'Customer' : 'Supplier'})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            payment.payment_method === 'cash'
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          )}>
                            {payment.payment_method === 'cash' ? 'Cash' :
                             payment.payment_method === 'bank_transfer' ? 'Bank Transfer' :
                             payment.payment_method === 'online' ? 'Online' : payment.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-600">
                            {payment.receipt_no || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            "text-sm font-bold",
                            payment.type === 'in' ? "text-green-600" : "text-red-600"
                          )}>
                            {payment.type === 'in' ? '+' : '-'}{formatCurrency(payment.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-neutral-700">
                            {formatCurrency(payment.balance_after)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-600 truncate max-w-[200px] inline-block">
                            {payment.notes || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleViewDetails(payment)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                "text-neutral-600 hover:text-blue-600 hover:bg-blue-50"
                              )}
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(payment)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                "text-neutral-600 hover:text-amber-600 hover:bg-amber-50"
                              )}
                              title="Edit payment"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(payment)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                "text-neutral-600 hover:text-red-600 hover:bg-red-50"
                              )}
                              title="Delete payment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
                  <div className="text-sm text-neutral-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} payments
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        currentPage === 1
                          ? "text-neutral-300 cursor-not-allowed"
                          : "text-neutral-600 hover:bg-neutral-100"
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-neutral-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        currentPage === totalPages
                          ? "text-neutral-300 cursor-not-allowed"
                          : "text-neutral-600 hover:bg-neutral-100"
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* View Modal */}
      <PaymentViewModal
        payment={selectedPayment}
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedPayment(null);
        }}
      />

      {/* Edit Drawer */}
      <PaymentEditDrawer
        payment={selectedPayment}
        isOpen={showEditDrawer}
        onClose={() => {
          setShowEditDrawer(false);
          setSelectedPayment(null);
        }}
        onSaved={handlePaymentSaved}
      />

      {/* Delete Confirm Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={hideConfirm} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              {confirmState.title}
            </h3>
            <p className="text-sm text-neutral-600 mb-6">
              {confirmState.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={hideConfirm}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "text-neutral-700 bg-white border border-neutral-300",
                  "hover:bg-neutral-100 transition-colors"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmState.onConfirm();
                  hideConfirm();
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-red-600 text-white",
                  "hover:bg-red-700 transition-colors"
                )}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
