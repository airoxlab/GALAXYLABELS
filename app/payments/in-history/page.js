'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { notify } from '@/components/ui/Notifications';
import {
  Search, X, ChevronLeft, ChevronRight,
  DollarSign, TrendingUp, FileText, CreditCard
} from 'lucide-react';

export default function PaymentInHistoryPage() {
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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

  async function fetchPayments(userId) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments_in')
        .select(`
          id,
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
          customers(customer_name)
        `)
        .eq('user_id', userId)
        .order('payment_date', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
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
      payment.customers?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.online_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCustomer = selectedCustomer === 'all' || payment.customer_id?.toString() === selectedCustomer;
    const matchesMethod = selectedMethod === 'all' || payment.payment_method === selectedMethod;

    const matchesDate =
      (!startDate || new Date(payment.payment_date) >= new Date(startDate)) &&
      (!endDate || new Date(payment.payment_date) <= new Date(endDate));

    return matchesSearch && matchesCustomer && matchesMethod && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayments = filteredPayments.slice(startIndex, endIndex);

  // Calculate stats
  const totalAmount = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const cashPayments = filteredPayments.filter(p => p.payment_method === 'cash').length;
  const onlinePayments = filteredPayments.filter(p => p.payment_method === 'online' || p.payment_method === 'bank_transfer').length;

  function handleClearFilters() {
    setSearchQuery('');
    setSelectedCustomer('all');
    setSelectedMethod('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const customerOptions = [
    { value: 'all', label: 'All Customers' },
    ...customers.map(c => ({
      value: c.id.toString(),
      label: c.customer_name
    }))
  ];

  const methodOptions = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'online', label: 'Online Payment' }
  ];

  const getDenominationTotal = (payment) => {
    if (payment.payment_method !== 'cash') return null;
    return (
      (payment.denomination_10 || 0) * 10 +
      (payment.denomination_20 || 0) * 20 +
      (payment.denomination_50 || 0) * 50 +
      (payment.denomination_100 || 0) * 100 +
      (payment.denomination_500 || 0) * 500 +
      (payment.denomination_1000 || 0) * 1000 +
      (payment.denomination_5000 || 0) * 5000
    );
  };

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
              <h1 className="text-xl font-bold text-neutral-900">Payment In History</h1>
              <p className="text-sm text-neutral-500">View all customer payment transactions</p>
            </div>
          </div>
          <Button onClick={() => router.push('/payments/in')}>
            New Payment
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Payments</p>
                <p className="text-lg font-bold text-neutral-900">{filteredPayments.length}</p>
              </div>
              <FileText className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Amount</p>
                <p className="text-lg font-bold text-neutral-900">{formatCurrency(totalAmount)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Cash Payments</p>
                <p className="text-lg font-bold text-neutral-900">{cashPayments}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Online/Bank</p>
                <p className="text-lg font-bold text-neutral-900">{onlinePayments}</p>
              </div>
              <CreditCard className="w-5 h-5 text-neutral-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <div className="w-[220px]">
              <SearchableDropdown
                options={customerOptions}
                value={selectedCustomer}
                onChange={(val) => { setSelectedCustomer(val); setCurrentPage(1); }}
                placeholder="Select Customer"
                searchPlaceholder="Search customers..."
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

            <div className="relative flex-1 max-w-[200px]">
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
              className={cn(
                "w-[140px] px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            />

            {(searchQuery || selectedCustomer !== 'all' || selectedMethod !== 'all' || startDate || endDate) && (
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
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Method</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Reference</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Amount</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Balance After</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {currentPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-700">{formatDate(payment.payment_date)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-neutral-900">
                            {payment.customers?.customer_name || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            payment.payment_method === 'cash'
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          )}>
                            {payment.payment_method === 'cash' ? 'Cash' :
                             payment.payment_method === 'bank_transfer' ? 'Bank Transfer' :
                             payment.payment_method === 'online' ? 'Online' : payment.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-600">
                            {payment.online_reference || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-bold text-green-600">
                            {formatCurrency(payment.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-neutral-700">
                            {formatCurrency(payment.customer_balance)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-600">
                            {payment.notes || '-'}
                          </span>
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
    </DashboardLayout>
  );
}
