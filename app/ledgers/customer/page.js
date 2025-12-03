'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { notify } from '@/components/ui/Notifications';
import {
  Eye, ChevronLeft, ChevronRight, Search, X,
  Users, TrendingUp, FileText, DollarSign,
  CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { viewCustomerLedgerPDF } from '@/components/ledgers/CustomerLedgerPDF';

export default function CustomerLedgerPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [ledgerData, setLedgerData] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        // Use parentUserId for data queries (staff sees parent account data)
        const userId = data.user.parentUserId || data.user.id || data.user.userId;
        fetchCustomers(userId);
        fetchSettings(userId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  }

  async function fetchCustomers(userId) {
    try {
      console.log('Fetching customers for userId:', userId);
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name, mobile_no, current_balance')
        .eq('user_id', userId)
        .order('customer_name');

      if (error) {
        console.error('Supabase error fetching customers:', error);
        throw error;
      }

      console.log('Fetched customers:', data);
      setCustomers(data || []);

      // Fetch ledger data for all customers by default
      fetchLedgerData(userId, 'all');
    } catch (error) {
      console.error('Error fetching customers:', error);
      notify.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }

  async function fetchLedgerData(userId, customerId) {
    setLedgerLoading(true);
    try {
      // Try to fetch from customer_ledger table first
      // Query in ascending order (oldest first) since we'll reverse for display
      let ledgerQuery = supabase
        .from('customer_ledger')
        .select(`
          id,
          transaction_date,
          transaction_type,
          reference_no,
          description,
          debit,
          credit,
          balance,
          customer_id,
          created_at,
          customers(customer_name)
        `)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      // Filter by specific customer if selected
      if (customerId !== 'all') {
        ledgerQuery = ledgerQuery.eq('customer_id', customerId);
      }

      const { data: ledgerRes, error: ledgerError } = await ledgerQuery;

      // If customer_ledger table doesn't exist, fallback to building from sales_invoices and payments_in
      if (ledgerError && ledgerError.code === '42P01') {
        console.log('customer_ledger table not found, building from invoices and payments');
        return await fetchLedgerDataFromTransactions(userId, customerId);
      }

      if (ledgerError) throw ledgerError;

      const ledgerEntries = ledgerRes?.map(entry => {
        // Format transaction type for display
        let displayType = entry.transaction_type;
        if (entry.transaction_type === 'sale_order') {
          displayType = 'Sale Order';
        } else if (entry.transaction_type === 'sales_invoice') {
          displayType = 'Invoice';
        } else if (entry.transaction_type === 'payment') {
          displayType = 'Payment';
        }

        return {
          id: `ledger-${entry.id}`,
          date: entry.transaction_date,
          created_at: entry.created_at,
          type: displayType,
          reference: entry.reference_no || '-',
          customerName: entry.customers?.customer_name || 'Unknown Customer',
          customerId: entry.customer_id,
          description: entry.description || '-',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
          balance: parseFloat(entry.balance) || 0
        };
      }) || [];

      // Reverse to show newest first in the UI
      ledgerEntries.reverse();

      // Calculate stats from ledger entries
      const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);
      const outstandingBalance = totalDebit - totalCredit;
      const invoiceEntries = ledgerEntries.filter(e => e.type.toLowerCase().includes('invoice') || e.type.toLowerCase().includes('sale'));

      setCustomerStats({
        totalInvoices: invoiceEntries.length,
        totalSales: totalDebit,
        totalPayments: totalCredit,
        outstandingBalance
      });

      setLedgerData(ledgerEntries);
    } catch (error) {
      console.error('Error fetching ledger data:', error);
      notify.error('Error loading ledger data');
    } finally {
      setLedgerLoading(false);
    }
  }

  async function fetchLedgerDataFromTransactions(userId, customerId) {
    let invoicesQuery = supabase
      .from('sales_invoices')
      .select(`
        id,
        invoice_no,
        invoice_date,
        total_amount,
        customer_id,
        created_at,
        customers(customer_name)
      `)
      .eq('user_id', userId)
      .order('invoice_date', { ascending: true })
      .order('created_at', { ascending: true });

    let paymentsQuery = supabase
      .from('payments_in')
      .select(`
        id,
        receipt_no,
        payment_date,
        amount,
        payment_method,
        customer_id,
        created_at,
        customers(customer_name)
      `)
      .eq('user_id', userId)
      .order('payment_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (customerId !== 'all') {
      invoicesQuery = invoicesQuery.eq('customer_id', customerId);
      paymentsQuery = paymentsQuery.eq('customer_id', customerId);
    }

    const [invoicesRes, paymentsRes] = await Promise.all([invoicesQuery, paymentsQuery]);

    if (invoicesRes.error) throw invoicesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const ledgerEntries = [];
    const customerBalances = {};

    invoicesRes.data?.forEach(inv => {
      const cid = inv.customer_id;
      const customerName = inv.customers?.customer_name || 'Unknown Customer';
      if (!customerBalances[cid]) customerBalances[cid] = { balance: 0, name: customerName };
      ledgerEntries.push({
        id: `inv-${inv.id}`,
        date: inv.invoice_date,
        created_at: inv.created_at,
        type: 'Invoice',
        reference: inv.invoice_no,
        customerName,
        customerId: cid,
        description: 'Sales Invoice',
        debit: parseFloat(inv.total_amount) || 0,
        credit: 0
      });
    });

    paymentsRes.data?.forEach(pay => {
      const cid = pay.customer_id;
      const customerName = pay.customers?.customer_name || 'Unknown Customer';
      if (!customerBalances[cid]) customerBalances[cid] = { balance: 0, name: customerName };
      ledgerEntries.push({
        id: `pay-${pay.id}`,
        date: pay.payment_date,
        created_at: pay.created_at,
        type: 'Payment',
        reference: pay.receipt_no || '-',
        customerName,
        customerId: cid,
        description: pay.payment_method ? `Payment via ${pay.payment_method}` : 'Payment Received',
        debit: 0,
        credit: parseFloat(pay.amount) || 0
      });
    });

    // Sort oldest first for correct balance calculation
    ledgerEntries.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      // If dates are equal, sort by created_at timestamp (oldest first)
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Calculate running balances from oldest to newest
    ledgerEntries.forEach(entry => {
      const cid = entry.customerId;
      if (customerBalances[cid]) {
        customerBalances[cid].balance += entry.debit - entry.credit;
        entry.balance = customerBalances[cid].balance;
      } else {
        customerBalances[cid] = { balance: entry.debit - entry.credit, name: entry.customerName };
        entry.balance = entry.debit - entry.credit;
      }
    });

    // Reverse to show newest first in the UI
    ledgerEntries.reverse();

    const totalInvoices = invoicesRes.data?.length || 0;
    const totalSales = invoicesRes.data?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
    const totalPayments = paymentsRes.data?.reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0) || 0;
    const outstandingBalance = totalSales - totalPayments;

    setCustomerStats({ totalInvoices, totalSales, totalPayments, outstandingBalance });
    setLedgerData(ledgerEntries);
  }

  useEffect(() => {
    if (user) {
      const userId = user.id || user.userId;
      fetchLedgerData(userId, selectedCustomer);
      setCurrentPage(1);
    }
  }, [selectedCustomer]);

  // Filter ledger entries
  const filteredLedger = ledgerData.filter(entry => {
    const matchesSearch =
      entry.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate =
      (!startDate || new Date(entry.date) >= new Date(startDate)) &&
      (!endDate || new Date(entry.date) <= new Date(endDate));

    const matchesType = typeFilter === 'all' || entry.type.toLowerCase() === typeFilter;

    const matchesBalance =
      balanceFilter === 'all' ||
      (balanceFilter === 'debit' && entry.debit > 0) ||
      (balanceFilter === 'credit' && entry.credit > 0) ||
      (balanceFilter === 'outstanding' && entry.balance > 0);

    return matchesSearch && matchesDate && matchesType && matchesBalance;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEntries = filteredLedger.slice(startIndex, endIndex);

  function handleClearFilters() {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setTypeFilter('all');
    setBalanceFilter('all');
    setCurrentPage(1);
  }

  async function handleViewPDF() {
    if (!customerStats) {
      notify.error('No ledger data available');
      return;
    }

    try {
      const customerData = selectedCustomer !== 'all'
        ? customers.find(c => c.id.toString() === selectedCustomer)
        : { customer_name: 'All Customers', mobile_no: '' };

      await viewCustomerLedgerPDF(
        customerData,
        filteredLedger,
        customerStats,
        settings
      );
    } catch (error) {
      console.error('Error viewing PDF:', error);
      notify.error('Error viewing PDF: ' + error.message);
    }
  }

  const formatCurrency = (amount) => {
    return 'Rs ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Customer options for dropdown
  const customerOptions = [
    { value: 'all', label: 'All Customers' },
    ...customers.map(c => ({
      value: c.id.toString(),
      label: `${c.customer_name}${c.current_balance ? ` (Bal: ${formatCurrency(c.current_balance)})` : ''}`
    }))
  ];

  // Type filter options
  const typeFilterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'invoice', label: 'Invoices Only' },
    { value: 'payment', label: 'Payments Only' }
  ];

  // Balance filter options
  const balanceFilterOptions = [
    { value: 'all', label: 'All Transactions' },
    { value: 'debit', label: 'Debit Only' },
    { value: 'credit', label: 'Credit Only' },
    { value: 'outstanding', label: 'Outstanding Only' }
  ];

  // Calculate overall stats
  const totalCustomers = customers.length;
  const totalOutstanding = customers.reduce((sum, c) => sum + (parseFloat(c.current_balance) || 0), 0);
  const customersWithBalance = customers.filter(c => (parseFloat(c.current_balance) || 0) > 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Customer Ledger</h1>
              <p className="text-sm text-neutral-500">View customer transaction history and balances</p>
            </div>
          </div>
          {customerStats && (
            <button
              onClick={handleViewPDF}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                "bg-neutral-900 text-white hover:bg-neutral-800"
              )}
            >
              <Eye className="w-4 h-4" />
              View Ledger
            </button>
          )}
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Customers</p>
                <p className="text-lg font-bold text-neutral-900">{totalCustomers}</p>
              </div>
              <Users className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Receivables</p>
                <p className="text-lg font-bold text-neutral-900">{formatCurrency(totalOutstanding)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">With Balance</p>
                <p className="text-lg font-bold text-neutral-900">{customersWithBalance}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-neutral-400" />
            </div>
          </div>
        </div>

        {/* Ledger Stats */}
        {customerStats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Invoices</p>
                  <p className="text-xl font-bold text-blue-900">{customerStats.totalInvoices}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Total Sales</p>
                  <p className="text-xl font-bold text-emerald-900">{formatCurrency(customerStats.totalSales)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">Total Paid</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(customerStats.totalPayments)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            <div className={cn(
              "rounded-xl border px-4 py-3",
              customerStats.outstandingBalance > 0
                ? "bg-gradient-to-br from-red-50 to-rose-100 border-red-100"
                : "bg-gradient-to-br from-violet-50 to-purple-100 border-violet-100"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-xs font-medium",
                    customerStats.outstandingBalance > 0 ? "text-red-600" : "text-violet-600"
                  )}>Outstanding</p>
                  <p className={cn(
                    "text-xl font-bold",
                    customerStats.outstandingBalance > 0 ? "text-red-900" : "text-violet-900"
                  )}>
                    {formatCurrency(customerStats.outstandingBalance)}
                  </p>
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  customerStats.outstandingBalance > 0 ? "bg-red-500" : "bg-violet-500"
                )}>
                  <Clock className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl p-3",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "relative z-50"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-[250px] relative z-50">
              <SearchableDropdown
                options={customerOptions}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                placeholder="Select Customer"
                searchPlaceholder="Search customers..."
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

            <div className="w-[140px]">
              <SearchableDropdown
                options={typeFilterOptions}
                value={typeFilter}
                onChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}
                placeholder="Type"
                allowClear={false}
                className="text-sm"
              />
            </div>

            <div className="w-[160px]">
              <SearchableDropdown
                options={balanceFilterOptions}
                value={balanceFilter}
                onChange={(val) => { setBalanceFilter(val); setCurrentPage(1); }}
                placeholder="Balance"
                allowClear={false}
                className="text-sm"
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

            {(searchQuery || startDate || endDate || typeFilter !== 'all' || balanceFilter !== 'all' || selectedCustomer !== 'all') && (
              <button
                onClick={() => {
                  handleClearFilters();
                  setSelectedCustomer('all');
                }}
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

        {/* Ledger Table */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "overflow-hidden"
        )}>
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">
              Ledger Report {selectedCustomer !== 'all' && customerStats ? `- ${customers.find(c => c.id.toString() === selectedCustomer)?.customer_name}` : '(All Customers)'}
            </h2>
          </div>

          {ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full" />
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Reference</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Debit</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Credit</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {currentEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{formatDate(entry.date)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-700">{entry.customerName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          (entry.type === 'Invoice' || entry.type === 'Sale Order')
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        )}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-neutral-900">{entry.reference}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-neutral-600">{entry.description}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "text-sm",
                          entry.debit > 0 ? "text-red-600 font-medium" : "text-neutral-400"
                        )}>
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "text-sm",
                          entry.credit > 0 ? "text-green-600 font-medium" : "text-neutral-400"
                        )}>
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "text-sm font-semibold",
                          entry.balance > 0 ? "text-red-600" : entry.balance < 0 ? "text-green-600" : "text-neutral-900"
                        )}>
                          {formatCurrency(Math.abs(entry.balance))}
                          {entry.balance < 0 && ' CR'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-neutral-200 px-4 py-3 flex items-center justify-between bg-neutral-50">
              <div className="text-sm text-neutral-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLedger.length)} of {filteredLedger.length} entries
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-lg transition-all",
                        currentPage === pageNum
                          ? "bg-neutral-900 text-white font-medium"
                          : "hover:bg-neutral-100 text-neutral-700"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
