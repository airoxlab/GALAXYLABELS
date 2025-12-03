'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/ui/Notifications';
import { Loader2 } from 'lucide-react';

export default function StockPage() {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [stockIn, setStockIn] = useState([]);
  const [stockOut, setStockOut] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, in, out
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchStockData();
  }, []);

  async function fetchStockData() {
    try {
      const [stockInRes, stockOutRes] = await Promise.all([
        supabase
          .from('stock_in')
          .select(`
            *,
            products (name),
            warehouses (name)
          `)
          .order('date', { ascending: false }),
        supabase
          .from('stock_out')
          .select(`
            *,
            products (name),
            warehouses (name)
          `)
          .order('date', { ascending: false })
      ]);

      setStockIn(stockInRes.data || []);
      setStockOut(stockOutRes.data || []);
    } catch (error) {
      console.error('Error fetching stock:', error);
      notify.error('Error loading stock data');
    } finally {
      setLoadingData(false);
    }
  }

  const combinedStock = [
    ...stockIn.map(item => ({ ...item, type: 'in' })),
    ...stockOut.map(item => ({ ...item, type: 'out' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredStock = combinedStock.filter(item => {
    const matchesSearch = item.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.reference_no?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesDateFrom = !dateFrom || new Date(item.date) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(item.date) <= new Date(dateTo);

    return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Stock Management</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Track stock in and out movements
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => router.push('/stock/in')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              Stock In
            </Button>
            <Button variant="danger" onClick={() => router.push('/stock/out')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
              Stock Out
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search by product or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: 'all', label: 'All Transactions' },
                { value: 'in', label: 'Stock In Only' },
                { value: 'out', label: 'Stock Out Only' }
              ]}
            />
            <Input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </Card>

        {/* Stock Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock In</p>
                {loadingData ? (
                  <Loader2 className="w-5 h-5 animate-spin text-green-600 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">
                    {stockIn.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock Out</p>
                {loadingData ? (
                  <Loader2 className="w-5 h-5 animate-spin text-red-600 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-red-600">
                    {stockOut.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Net Stock</p>
                {loadingData ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-blue-600">
                    {(
                      stockIn.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) -
                      stockOut.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0)
                    ).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* Stock Transactions Table */}
        {loadingData ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading transactions...</p>
          </Card>
        ) : filteredStock.length === 0 ? (
          <Card className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 mb-4">No stock transactions found</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.push('/stock/in')}>Add Stock In</Button>
              <Button variant="danger" onClick={() => router.push('/stock/out')}>Add Stock Out</Button>
            </div>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.map((item, index) => (
                  <TableRow key={`${item.type}-${item.id}`}>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'in'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {item.type === 'in' ? 'Stock In' : 'Stock Out'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{item.products?.name || '-'}</TableCell>
                    <TableCell>{item.warehouses?.name || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{item.reference_no || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`font-semibold ${
                          item.type === 'in' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {item.type === 'in' ? '+' : '-'}{item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{item.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
