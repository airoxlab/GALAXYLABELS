'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { notify } from '@/components/ui/Notifications';
import {
  Download, ChevronLeft, ChevronRight, Search, X,
  Building2, TrendingDown, FileText, DollarSign,
  CheckCircle, Clock, AlertTriangle, Loader2
} from 'lucide-react';
import { downloadSupplierLedgerPDF } from '@/components/ledgers/SupplierLedgerPDF';

export default function SupplierLedgerPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [ledgerData, setLedgerData] = useState([]);
  const [supplierStats, setSupplierStats] = useState(null);
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
        fetchSuppliers(userId);
        fetchSettings(userId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  }

  async function fetchSuppliers(userId) {
    try {
      console.log('Fetching suppliers for userId:', userId);
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, supplier_name, mobile_no, current_balance')
        .eq('user_id', userId)
        .order('supplier_name');

      if (error) {
        console.error('Supabase error fetching suppliers:', error);
        throw error;
      }

      console.log('Fetched suppliers:', data);
      setSuppliers(data || []);

      // Fetch ledger data for all suppliers by default
      fetchLedgerData(userId, 'all');
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      notify.error('Failed to load suppliers');
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

  async function fetchLedgerData(userId, supplierId) {
    setLedgerLoading(true);
    try {
      // Fetch from supplier_ledger table
      // Query in ascending order (oldest first) since we need to reverse for display
      let ledgerQuery = supabase
        .from('supplier_ledger')
        .select(`
          id,
          transaction_date,
          transaction_type,
          reference_no,
          description,
          debit,
          credit,
          balance,
          supplier_id,
          created_at,
          suppliers(supplier_name)
        `)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      // Filter by specific supplier if selected
      if (supplierId !== 'all') {
        ledgerQuery = ledgerQuery.eq('supplier_id', supplierId);
      }

      const { data: ledgerRes, error: ledgerError } = await ledgerQuery;

      if (ledgerError) throw ledgerError;

      const ledgerEntries = ledgerRes?.map(entry => ({
        id: `ledger-${entry.id}`,
        date: entry.transaction_date,
        type: entry.transaction_type,
        reference: entry.reference_no || '-',
        supplierName: entry.suppliers?.supplier_name || 'Unknown Supplier',
        supplierId: entry.supplier_id,
        description: entry.description || '-',
        debit: parseFloat(entry.debit) || 0,
        credit: parseFloat(entry.credit) || 0,
        balance: parseFloat(entry.balance) || 0
      })) || [];

      // Reverse to show newest first in the UI
      ledgerEntries.reverse();

      // Calculate stats from ledger entries
      const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);
      const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
      const outstandingBalance = totalCredit - totalDebit;
      const purchaseEntries = ledgerEntries.filter(e => e.type.toLowerCase().includes('purchase') || e.type.toLowerCase().includes('po'));

      setSupplierStats({
        totalPurchases: totalCredit,  // Total purchase amount
        totalPurchaseAmount: totalCredit,
        totalPayments: totalDebit,
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

  useEffect(() => {
    if (user) {
      const userId = user.id || user.userId;
      fetchLedgerData(userId, selectedSupplier);
      setCurrentPage(1);
    }
  }, [selectedSupplier]);

  // Filter ledger entries
  const filteredLedger = ledgerData.filter(entry => {
    const matchesSearch =
      entry.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());

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

  async function handleDownloadPDF() {
    if (!supplierStats) {
      notify.error('No ledger data available');
      return;
    }

    try {
      const supplierData = selectedSupplier !== 'all'
        ? suppliers.find(s => s.id.toString() === selectedSupplier)
        : { supplier_name: 'All Suppliers', mobile_no: '' };

      // Recalculate stats from filtered ledger for PDF
      const pdfTotalCredit = filteredLedger.reduce((sum, e) => sum + e.credit, 0);
      const pdfTotalDebit = filteredLedger.reduce((sum, e) => sum + e.debit, 0);
      const pdfOutstandingBalance = pdfTotalCredit - pdfTotalDebit;

      const pdfStats = {
        totalPurchases: pdfTotalCredit,
        totalPurchaseAmount: pdfTotalCredit,
        totalPayments: pdfTotalDebit,
        outstandingBalance: pdfOutstandingBalance
      };

      await downloadSupplierLedgerPDF(
        supplierData,
        filteredLedger,
        pdfStats,
        settings
      );
      notify.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      notify.error('Error downloading PDF: ' + error.message);
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

  // Supplier options for dropdown
  const supplierOptions = [
    { value: 'all', label: 'All Suppliers' },
    ...suppliers.map(s => ({
      value: s.id.toString(),
      label: `${s.supplier_name}${s.current_balance ? ` (Bal: ${formatCurrency(s.current_balance)})` : ''}`
    }))
  ];

  // Type filter options
  const typeFilterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'purchase', label: 'Purchases Only' },
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
  const totalSuppliers = suppliers.length;
  const totalPayable = suppliers.reduce((sum, s) => sum + (parseFloat(s.current_balance) || 0), 0);
  const suppliersWithBalance = suppliers.filter(s => (parseFloat(s.current_balance) || 0) > 0).length;

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
              <h1 className="text-xl font-bold text-neutral-900">Supplier Ledger</h1>
              <p className="text-sm text-neutral-500">View supplier transaction history and balances</p>
            </div>
          </div>
          {supplierStats && (
            <button
              onClick={handleDownloadPDF}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                "bg-neutral-900 text-white hover:bg-neutral-800"
              )}
            >
              <Download className="w-4 h-4" />
              Download Ledger
            </button>
          )}
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Suppliers</p>
                <p className="text-lg font-bold text-neutral-900">{totalSuppliers}</p>
              </div>
              <Building2 className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">Total Payables</p>
                <p className="text-lg font-bold text-neutral-900">{formatCurrency(totalPayable)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">With Balance</p>
                <p className="text-lg font-bold text-neutral-900">{suppliersWithBalance}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-neutral-400" />
            </div>
          </div>
        </div>

        {/* Ledger Stats */}
        {supplierStats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Purchases</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(supplierStats.totalPurchases)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-violet-600 font-medium">Total Amount</p>
                  <p className="text-xl font-bold text-violet-900">{formatCurrency(supplierStats.totalPurchaseAmount)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">Total Paid</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(supplierStats.totalPayments)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            <div className={cn(
              "rounded-xl border px-4 py-3",
              supplierStats.outstandingBalance > 0
                ? "bg-gradient-to-br from-red-50 to-rose-100 border-red-100"
                : "bg-gradient-to-br from-emerald-50 to-teal-100 border-emerald-100"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-xs font-medium",
                    supplierStats.outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"
                  )}>Payable</p>
                  <p className={cn(
                    "text-xl font-bold",
                    supplierStats.outstandingBalance > 0 ? "text-red-900" : "text-emerald-900"
                  )}>
                    {formatCurrency(supplierStats.outstandingBalance)}
                  </p>
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  supplierStats.outstandingBalance > 0 ? "bg-red-500" : "bg-emerald-500"
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
                options={supplierOptions}
                value={selectedSupplier}
                onChange={setSelectedSupplier}
                placeholder="Select Supplier"
                searchPlaceholder="Search suppliers..."
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

            {(searchQuery || startDate || endDate || typeFilter !== 'all' || balanceFilter !== 'all' || selectedSupplier !== 'all') && (
              <button
                onClick={() => {
                  handleClearFilters();
                  setSelectedSupplier('all');
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
              Ledger Report {selectedSupplier !== 'all' && supplierStats ? `- ${suppliers.find(s => s.id.toString() === selectedSupplier)?.supplier_name}` : '(All Suppliers)'}
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Supplier</th>
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
                        <span className="text-sm text-neutral-700">{entry.supplierName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          entry.type === 'Purchase'
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
                          entry.debit > 0 ? "text-green-600 font-medium" : "text-neutral-400"
                        )}>
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "text-sm",
                          entry.credit > 0 ? "text-red-600 font-medium" : "text-neutral-400"
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
