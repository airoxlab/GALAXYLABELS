'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  Building2,
  DollarSign,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState('');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    receivable: [],
    payable: [],
  });
  const [recentSales, setRecentSales] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    setCurrentMonth(month);
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        loadDashboardData(data.user.userId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const loadDashboardData = async (userId) => {
    try {
      setLoading(true);

      // Get current month date range
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Run all queries in parallel for better performance
      const [
        salesResult,
        purchasesResult,
        expensesResult,
        productsResult,
        customersResult,
        suppliersResult,
        receivablesResult,
        payablesResult,
        recentSalesResult,
        recentPurchasesResult,
        lowStockResult
      ] = await Promise.all([
        // Sales this month
        supabase
          .from('sales_invoices')
          .select('total_amount')
          .eq('user_id', userId)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay),

        // Purchases this month
        supabase
          .from('purchase_orders')
          .select('total_amount')
          .eq('user_id', userId)
          .gte('po_date', firstDay)
          .lte('po_date', lastDay),

        // Expenses this month
        supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', userId)
          .gte('expense_date', firstDay)
          .lte('expense_date', lastDay),

        // Products count
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),

        // Customers count
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),

        // Suppliers count
        supabase
          .from('suppliers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),

        // Top receivables
        supabase
          .from('customers')
          .select('customer_name, current_balance')
          .eq('user_id', userId)
          .gt('current_balance', 0)
          .order('current_balance', { ascending: false })
          .limit(5),

        // Top payables
        supabase
          .from('suppliers')
          .select('supplier_name, current_balance')
          .eq('user_id', userId)
          .gt('current_balance', 0)
          .order('current_balance', { ascending: false })
          .limit(5),

        // Recent sales
        supabase
          .from('sales_invoices')
          .select('id, invoice_no, invoice_date, total_amount, customers(customer_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),

        // Recent purchases
        supabase
          .from('purchase_orders')
          .select('id, po_no, po_date, total_amount, suppliers(supplier_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),

        // Low stock products
        supabase
          .from('products')
          .select('name, current_stock, units(symbol)')
          .eq('user_id', userId)
          .lt('current_stock', 10)
          .eq('is_active', true)
          .order('current_stock', { ascending: true })
          .limit(5)
      ]);

      // Calculate totals
      const totalSales = salesResult.data?.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
      const totalPurchases = purchasesResult.data?.reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0) || 0;
      const totalExpenses = expensesResult.data?.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) || 0;

      setStats({
        totalSales,
        totalPurchases,
        totalExpenses,
        totalProducts: productsResult.count || 0,
        totalCustomers: customersResult.count || 0,
        totalSuppliers: suppliersResult.count || 0,
        receivable: receivablesResult.data?.map(r => ({ name: r.customer_name, amount: parseFloat(r.current_balance) })) || [],
        payable: payablesResult.data?.map(p => ({ name: p.supplier_name, amount: parseFloat(p.current_balance) })) || [],
      });

      setRecentSales(recentSalesResult.data || []);
      setRecentPurchases(recentPurchasesResult.data || []);
      setLowStock(lowStockResult.data || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { title: 'New Sale', icon: <Receipt className="w-5 h-5" />, href: '/sales/sale-invoice' },
    { title: 'New Purchase', icon: <ShoppingCart className="w-5 h-5" />, href: '/purchases/new' },
    { title: 'Stock In', icon: <ArrowDownRight className="w-5 h-5" />, href: '/stock/in' },
    { title: 'Stock Out', icon: <ArrowUpRight className="w-5 h-5" />, href: '/stock/out' },
    { title: 'Payment In', icon: <DollarSign className="w-5 h-5" />, href: '/payments/in' },
    { title: 'Payment Out', icon: <CreditCard className="w-5 h-5" />, href: '/payments/out' },
    { title: 'Add Expense', icon: <Plus className="w-5 h-5" />, href: '/expenses' },
    { title: 'Products', icon: <Package className="w-5 h-5" />, href: '/products' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-neutral-500 mt-1">Welcome back, {user?.full_name || 'User'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900">{currentMonth}</p>
            <p className="text-xs text-neutral-500">Current Period</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              onClick={() => router.push(action.href)}
              className={cn(
                "bg-white/80 backdrop-blur-xl rounded-2xl p-4",
                "border border-neutral-200/60",
                "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
                "transition-all duration-300",
                "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]",
                "group"
              )}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-900 text-white group-hover:bg-neutral-800 transition-colors">
                  {action.icon}
                </div>
                <span className="text-xs font-medium text-neutral-700">{action.title}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sales Card */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl p-6",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "transition-all duration-300",
            "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Sales This Month</p>
                <h3 className="text-2xl font-semibold text-neutral-900 mt-1 tracking-tight">{formatCurrency(stats.totalSales)}</h3>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </div>

          {/* Purchases Card */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl p-6",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "transition-all duration-300",
            "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Purchases This Month</p>
                <h3 className="text-2xl font-semibold text-neutral-900 mt-1 tracking-tight">{formatCurrency(stats.totalPurchases)}</h3>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          {/* Expenses Card */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl p-6",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "transition-all duration-300",
            "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Expenses This Month</p>
                <h3 className="text-2xl font-semibold text-neutral-900 mt-1 tracking-tight">{formatCurrency(stats.totalExpenses)}</h3>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Products Count */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl p-6",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "transition-all duration-300",
            "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Products</p>
                <h3 className="text-2xl font-semibold text-neutral-900 mt-1 tracking-tight">{stats.totalProducts}</h3>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          {/* Customers Count */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl p-6",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "transition-all duration-300",
            "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Customers</p>
                <h3 className="text-2xl font-semibold text-neutral-900 mt-1 tracking-tight">{stats.totalCustomers}</h3>
              </div>
              <Users className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          {/* Suppliers Count */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl p-6",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "transition-all duration-300",
            "hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Suppliers</p>
                <h3 className="text-2xl font-semibold text-neutral-900 mt-1 tracking-tight">{stats.totalSuppliers}</h3>
              </div>
              <Building2 className="w-8 h-8 text-cyan-500" />
            </div>
          </div>
        </div>

        {/* Receivables & Payables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Receivables */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "overflow-hidden"
          )}>
            <div className="px-6 py-4 border-b border-neutral-200/60">
              <h3 className="font-semibold text-neutral-900">Top Receivables</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Outstanding customer balances</p>
            </div>
            <div className="p-4">
              {stats.receivable.length === 0 ? (
                <div className="text-center py-6 text-neutral-400">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No receivables</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.receivable.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-xl">
                      <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payables */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "overflow-hidden"
          )}>
            <div className="px-6 py-4 border-b border-neutral-200/60">
              <h3 className="font-semibold text-neutral-900">Top Payables</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Outstanding supplier balances</p>
            </div>
            <div className="p-4">
              {stats.payable.length === 0 ? (
                <div className="text-center py-6 text-neutral-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No payables</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.payable.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-xl">
                      <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Sales */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "overflow-hidden"
          )}>
            <div className="px-6 py-4 border-b border-neutral-200/60 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-neutral-900">Recent Sales</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Latest invoices</p>
              </div>
              <button
                onClick={() => router.push('/sales')}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1 transition-colors"
              >
                View All
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-neutral-100">
              {recentSales.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  <p className="text-sm">No recent sales</p>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="px-6 py-3 hover:bg-neutral-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{sale.invoice_no}</p>
                        <p className="text-xs text-neutral-500">{sale.customers?.customer_name || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-neutral-900">{formatCurrency(sale.total_amount)}</p>
                        <p className="text-xs text-neutral-500">{new Date(sale.invoice_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Purchases */}
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl",
            "border border-neutral-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "overflow-hidden"
          )}>
            <div className="px-6 py-4 border-b border-neutral-200/60 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-neutral-900">Recent Purchases</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Latest orders</p>
              </div>
              <button
                onClick={() => router.push('/purchases')}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1 transition-colors"
              >
                View All
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-neutral-100">
              {recentPurchases.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  <p className="text-sm">No recent purchases</p>
                </div>
              ) : (
                recentPurchases.map((po) => (
                  <div key={po.id} className="px-6 py-3 hover:bg-neutral-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{po.po_no}</p>
                        <p className="text-xs text-neutral-500">{po.suppliers?.supplier_name || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-neutral-900">{formatCurrency(po.total_amount)}</p>
                        <p className="text-xs text-neutral-500">{new Date(po.po_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <div className={cn(
            "bg-white/80 backdrop-blur-xl rounded-2xl",
            "border border-amber-200/60",
            "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
            "overflow-hidden"
          )}>
            <div className="px-6 py-4 border-b border-amber-200/60 bg-amber-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-neutral-900">Low Stock Alert</h3>
                  <p className="text-xs text-neutral-500">Products below 10 units</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/products')}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1 transition-colors"
              >
                View All
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-neutral-100">
              {lowStock.map((product, index) => (
                <div key={index} className="px-6 py-3 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                  <span className="text-sm font-medium text-neutral-900">{product.name}</span>
                  <span className="text-sm font-semibold text-red-600">
                    {product.current_stock} {product.units?.symbol || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}