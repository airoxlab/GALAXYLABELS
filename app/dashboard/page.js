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
  Boxes,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

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

  // Chart data states
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [purchasesExpensesData, setPurchasesExpensesData] = useState([]);
  const [customerDistributionData, setCustomerDistributionData] = useState([]);
  const [chartView, setChartView] = useState('weekly');
  const [kpiPeriod, setKpiPeriod] = useState('thisMonth'); // thisMonth, lastMonth, lastYear
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    setCurrentMonth(month);
    fetchUser();
  }, []);

  // Reload chart data when view changes
  useEffect(() => {
    if (userId) {
      loadChartData(userId, chartView);
    }
  }, [chartView, userId]);

  // Reload KPI data when period changes
  useEffect(() => {
    if (userId) {
      loadKpiData(userId, kpiPeriod);
    }
  }, [kpiPeriod, userId]);

  const getDateRange = (period) => {
    const now = new Date();
    let firstDay, lastDay;

    if (period === 'thisMonth') {
      firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'lastMonth') {
      firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'lastYear') {
      firstDay = new Date(now.getFullYear() - 1, 0, 1);
      lastDay = new Date(now.getFullYear() - 1, 11, 31);
    }

    return {
      firstDay: firstDay.toISOString().split('T')[0],
      lastDay: lastDay.toISOString().split('T')[0]
    };
  };

  const loadKpiData = async (uid, period) => {
    try {
      const { firstDay, lastDay } = getDateRange(period);

      const [salesResult, purchasesResult, expensesResult] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('total_amount')
          .eq('user_id', uid)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay),
        supabase
          .from('purchase_orders')
          .select('total_amount')
          .eq('user_id', uid)
          .gte('po_date', firstDay)
          .lte('po_date', lastDay),
        supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', uid)
          .gte('expense_date', firstDay)
          .lte('expense_date', lastDay),
      ]);

      const totalSales = salesResult.data?.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
      const totalPurchases = purchasesResult.data?.reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0) || 0;
      const totalExpenses = expensesResult.data?.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) || 0;

      setStats(prev => ({
        ...prev,
        totalSales,
        totalPurchases,
        totalExpenses,
      }));
    } catch (error) {
      console.error('Error loading KPI data:', error);
    }
  };

  const loadChartData = async (uid, view) => {
    try {
      const now = new Date();
      let salesData = [];

      if (view === 'weekly') {
        // Weekly view - weeks of current month
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const weeks = [];
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let weekStart = new Date(monthStart);
        let weekNum = 1;
        while (weekStart <= monthEnd) {
          let weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          if (weekEnd > monthEnd) weekEnd = monthEnd;
          weeks.push({
            name: `Week ${weekNum}`,
            start: weekStart.toISOString().split('T')[0],
            end: weekEnd.toISOString().split('T')[0]
          });
          weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() + 1);
          weekNum++;
        }

        const { data: salesResult } = await supabase
          .from('sales_invoices')
          .select('invoice_date, total_amount')
          .eq('user_id', uid)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay);

        salesData = weeks.map(week => {
          const weekSales = salesResult?.filter(sale => {
            return sale.invoice_date >= week.start && sale.invoice_date <= week.end;
          }).reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
          return { name: week.name, sales: weekSales };
        });

      } else if (view === 'monthly') {
        // Monthly view - last 6 months
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({
            name: date.toLocaleString('default', { month: 'short' }),
            start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
            end: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
          });
        }

        const firstDay = months[0].start;
        const lastDay = months[months.length - 1].end;

        const { data: salesResult } = await supabase
          .from('sales_invoices')
          .select('invoice_date, total_amount')
          .eq('user_id', uid)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay);

        salesData = months.map(month => {
          const monthSales = salesResult?.filter(sale => {
            return sale.invoice_date >= month.start && sale.invoice_date <= month.end;
          }).reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
          return { name: month.name, sales: monthSales };
        });

      } else if (view === 'yearly') {
        // Yearly view - last 5 years
        const years = [];
        for (let i = 4; i >= 0; i--) {
          const year = now.getFullYear() - i;
          years.push({
            name: year.toString(),
            start: `${year}-01-01`,
            end: `${year}-12-31`
          });
        }

        const firstDay = years[0].start;
        const lastDay = years[years.length - 1].end;

        const { data: salesResult } = await supabase
          .from('sales_invoices')
          .select('invoice_date, total_amount')
          .eq('user_id', uid)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay);

        salesData = years.map(year => {
          const yearSales = salesResult?.filter(sale => {
            return sale.invoice_date >= year.start && sale.invoice_date <= year.end;
          }).reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
          return { name: year.name, sales: yearSales };
        });
      }

      setSalesTrendData(salesData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        setUserId(data.user.id);
        await loadDashboardData(data.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const loadDashboardData = async (userId) => {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Calculate week ranges for current month
      const weeks = [];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let weekStart = new Date(monthStart);
      let weekNum = 1;
      while (weekStart <= monthEnd) {
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > monthEnd) weekEnd = monthEnd;
        weeks.push({
          name: `Week ${weekNum}`,
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0]
        });
        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        weekNum++;
      }

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
        lowStockResult,
        salesForChartResult,
        purchasesForChartResult,
        expensesForChartResult,
        activeCustomersResult,
        inactiveCustomersResult
      ] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('total_amount')
          .eq('user_id', userId)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay),
        supabase
          .from('purchase_orders')
          .select('total_amount')
          .eq('user_id', userId)
          .gte('po_date', firstDay)
          .lte('po_date', lastDay),
        supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', userId)
          .gte('expense_date', firstDay)
          .lte('expense_date', lastDay),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('suppliers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('customers')
          .select('customer_name, current_balance')
          .eq('user_id', userId)
          .gt('current_balance', 0)
          .order('current_balance', { ascending: false })
          .limit(5),
        supabase
          .from('suppliers')
          .select('supplier_name, current_balance')
          .eq('user_id', userId)
          .gt('current_balance', 0)
          .order('current_balance', { ascending: false })
          .limit(5),
        supabase
          .from('sales_invoices')
          .select('id, invoice_no, invoice_date, total_amount, customers(customer_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('purchase_orders')
          .select('id, po_no, po_date, total_amount, suppliers(supplier_name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('products')
          .select('name, current_stock, units(symbol)')
          .eq('user_id', userId)
          .lt('current_stock', 10)
          .eq('is_active', true)
          .order('current_stock', { ascending: true })
          .limit(5),
        supabase
          .from('sales_invoices')
          .select('invoice_date, total_amount')
          .eq('user_id', userId)
          .gte('invoice_date', firstDay)
          .lte('invoice_date', lastDay),
        supabase
          .from('purchase_orders')
          .select('po_date, total_amount')
          .eq('user_id', userId)
          .gte('po_date', firstDay)
          .lte('po_date', lastDay),
        supabase
          .from('expenses')
          .select('expense_date, amount')
          .eq('user_id', userId)
          .gte('expense_date', firstDay)
          .lte('expense_date', lastDay),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', false)
      ]);

      const totalSales = salesResult.data?.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
      const totalPurchases = purchasesResult.data?.reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0) || 0;
      const totalExpenses = expensesResult.data?.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) || 0;

      // Process Sales Trend Data (weekly)
      const salesByWeek = weeks.map(week => {
        const weekSales = salesForChartResult.data?.filter(sale => {
          const saleDate = sale.invoice_date;
          return saleDate >= week.start && saleDate <= week.end;
        }).reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0) || 0;
        return { name: week.name, sales: weekSales };
      });
      setSalesTrendData(salesByWeek);

      // Process Purchases vs Expenses Data (weekly)
      const purchasesExpensesByWeek = weeks.map(week => {
        const weekPurchases = purchasesForChartResult.data?.filter(po => {
          const poDate = po.po_date;
          return poDate >= week.start && poDate <= week.end;
        }).reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0) || 0;

        const weekExpenses = expensesForChartResult.data?.filter(exp => {
          const expDate = exp.expense_date;
          return expDate >= week.start && expDate <= week.end;
        }).reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) || 0;

        return { name: week.name, purchases: weekPurchases, expenses: weekExpenses };
      });
      setPurchasesExpensesData(purchasesExpensesByWeek);

      // Process Customer Distribution Data
      const activeCount = activeCustomersResult.count || 0;
      const inactiveCount = inactiveCustomersResult.count || 0;

      // Calculate customers added in last 30 days as "New"
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newCustomersResult = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const newCount = newCustomersResult.count || 0;
      const existingActiveCount = Math.max(0, activeCount - newCount);

      setCustomerDistributionData([
        { name: 'Active', value: existingActiveCount, color: '#10b981' },
        { name: 'New (30d)', value: newCount, color: '#3b82f6' },
        { name: 'Inactive', value: inactiveCount, color: '#f59e0b' },
      ]);

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
    { title: 'New Sale', icon: <Receipt className="w-4 h-4" />, href: '/sales/sale-order', bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-100', iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600', iconColor: 'text-white', textColor: 'text-neutral-800' },
    { title: 'New Purchase', icon: <ShoppingCart className="w-4 h-4" />, href: '/purchases/purchase-order', bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-100', iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600', iconColor: 'text-white', textColor: 'text-neutral-800' },
    { title: 'Payment In', icon: <DollarSign className="w-4 h-4" />, href: '/payments/in', bgColor: 'bg-gradient-to-br from-amber-50 to-orange-100', iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600', iconColor: 'text-white', textColor: 'text-neutral-800' },
    { title: 'Payment Out', icon: <CreditCard className="w-4 h-4" />, href: '/payments/out', bgColor: 'bg-gradient-to-br from-cyan-50 to-sky-100', iconBg: 'bg-gradient-to-br from-cyan-500 to-sky-600', iconColor: 'text-white', textColor: 'text-neutral-800' },
    { title: 'Add Expense', icon: <Plus className="w-4 h-4" />, href: '/expenses', bgColor: 'bg-gradient-to-br from-red-50 to-rose-100', iconBg: 'bg-gradient-to-br from-red-500 to-rose-600', iconColor: 'text-white', textColor: 'text-neutral-800' },
    { title: 'Products', icon: <Package className="w-4 h-4" />, href: '/products', bgColor: 'bg-gradient-to-br from-lime-50 to-green-100', iconBg: 'bg-gradient-to-br from-lime-500 to-green-600', iconColor: 'text-white', textColor: 'text-neutral-800' },
  ];

  const kpiPeriodLabels = {
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    lastYear: 'Last Year'
  };

  // Generate sparkline data from sales trend
  const salesSparkline = salesTrendData.map(d => ({ value: d.sales }));
  const purchasesSparkline = purchasesExpensesData.map(d => ({ value: d.purchases }));
  const expensesSparkline = purchasesExpensesData.map(d => ({ value: d.expenses }));

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-[#fafafa] min-h-screen">
        <div className="max-w-[1400px] mx-auto px-3 py-2">
          {/* Compact Header with Welcome */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-neutral-600">Welcome back, <span className="font-medium text-neutral-900">{user?.full_name || 'User'}</span></p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">{currentMonth}</span>
            </div>
          </div>

          {/* Quick Actions - Colorful */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => router.push(action.href)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-neutral-200/60",
                  "shadow-sm px-3 py-3",
                  "hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
                  action.bgColor
                )}
              >
                <div className={cn("w-9 h-9 min-w-[36px] rounded-xl flex items-center justify-center shadow-md flex-shrink-0", action.iconBg, action.iconColor)}>
                  {action.icon}
                </div>
                <span className={cn("text-xs font-medium truncate", action.textColor)}>{action.title}</span>
              </button>
            ))}
          </div>

          {/* KPI Period Filter */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-800">Financial Overview</h3>
            <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-neutral-200">
              {['thisMonth', 'lastMonth', 'lastYear'].map((period) => (
                <button
                  key={period}
                  onClick={() => setKpiPeriod(period)}
                  className={cn(
                    "rounded-lg text-xs px-3 py-1.5 transition-all font-medium",
                    kpiPeriod === period
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                  )}
                >
                  {kpiPeriodLabels[period]}
                </button>
              ))}
            </div>
          </div>

          {/* Primary KPI Cards - Colorful Gradients */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Sales Card */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl border border-emerald-100 shadow-md p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 shadow-sm flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-emerald-700">{kpiPeriodLabels[kpiPeriod]}</span>
                </div>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-700 rounded-full px-2.5 py-0.5 font-medium">
                  Sales
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-emerald-900">{formatCurrency(stats.totalSales)}</h3>
                <p className="text-xs text-emerald-600">Total Revenue</p>
              </div>
              <div className="h-8 w-full">
                {salesSparkline.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesSparkline}>
                      <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Purchases Card */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 rounded-2xl border border-blue-100 shadow-md p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 shadow-sm flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-blue-700">{kpiPeriodLabels[kpiPeriod]}</span>
                </div>
                <span className="text-[11px] bg-blue-500/10 text-blue-700 rounded-full px-2.5 py-0.5 font-medium">
                  Purchases
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totalPurchases)}</h3>
                <p className="text-xs text-blue-600">Total Purchases</p>
              </div>
              <div className="h-8 w-full">
                {purchasesSparkline.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={purchasesSparkline}>
                      <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Expenses Card */}
            <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 rounded-2xl border border-rose-100 shadow-md p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500 shadow-sm flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-rose-700">{kpiPeriodLabels[kpiPeriod]}</span>
                </div>
                <span className="text-[11px] bg-rose-500/10 text-rose-700 rounded-full px-2.5 py-0.5 font-medium">
                  Expenses
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-rose-900">{formatCurrency(stats.totalExpenses)}</h3>
                <p className="text-xs text-rose-600">Total Expenses</p>
              </div>
              <div className="h-8 w-full">
                {expensesSparkline.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={expensesSparkline}>
                      <Line type="monotone" dataKey="value" stroke="#e11d48" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Secondary KPI Cards - Colorful */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Products */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-500 shadow-sm flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-violet-700">Products</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-violet-900">{stats.totalProducts}</p>
                <p className="text-xs text-violet-600">Total</p>
              </div>
            </div>

            {/* Customers */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl border border-amber-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 shadow-sm flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-amber-700">Customers</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-amber-900">{stats.totalCustomers}</p>
                <p className="text-xs text-amber-600">Total</p>
              </div>
            </div>

            {/* Suppliers */}
            <div className="bg-gradient-to-br from-cyan-50 to-sky-100 rounded-xl border border-cyan-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500 shadow-sm flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-cyan-700">Suppliers</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-cyan-900">{stats.totalSuppliers}</p>
                <p className="text-xs text-cyan-600">Total</p>
              </div>
            </div>
          </div>

          {/* Sales Trend Chart */}
          <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-2xl border border-emerald-100 shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-emerald-900">Sales Trend</h3>
                  <p className="text-xs text-emerald-600">Revenue performance over time</p>
                </div>
              </div>
              <div className="flex gap-1 bg-white/80 rounded-lg p-1">
                {['weekly', 'monthly', 'yearly'].map((view) => (
                  <button
                    key={view}
                    onClick={() => setChartView(view)}
                    className={cn(
                      "rounded-md text-xs px-3 py-1.5 transition-all capitalize font-medium",
                      chartView === view
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-emerald-700 hover:bg-emerald-100"
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[280px]">
              {salesTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesTrendData}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                    <XAxis dataKey="name" stroke="#059669" fontSize={12} />
                    <YAxis stroke="#059669" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #a7f3d0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.1)'
                      }}
                      formatter={(value) => [formatCurrency(value), 'Sales']}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#059669' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-emerald-400">
                  <p>No sales data for this period</p>
                </div>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Purchases vs Expenses */}
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100 shadow-sm p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-blue-900">Purchases vs Expenses</h3>
                  <p className="text-xs text-blue-600">Weekly comparison</p>
                </div>
              </div>
              <div className="h-[240px]">
                {purchasesExpensesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={purchasesExpensesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="name" stroke="#3b82f6" fontSize={11} />
                      <YAxis stroke="#3b82f6" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)'
                        }}
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="purchases" name="Purchases" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-blue-400">
                    <p>No data for this period</p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Distribution */}
            <div className="bg-gradient-to-br from-violet-50/50 to-purple-50/50 rounded-2xl border border-violet-100 shadow-sm p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-violet-900">Customer Distribution</h3>
                  <p className="text-xs text-violet-600">By activity status</p>
                </div>
              </div>
              <div className="h-[240px]">
                {customerDistributionData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={customerDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {customerDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #ddd6fe',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.1)'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-violet-400">
                    <p>No customers yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Receivables & Top Payables - Same Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Top Receivables */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-emerald-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">Top Receivables</h3>
                    <p className="text-xs text-emerald-600">Outstanding from customers</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/customers')}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-emerald-100/50">
                {stats.receivable.length === 0 ? (
                  <div className="text-center py-8 text-emerald-400">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No receivables</p>
                  </div>
                ) : (
                  stats.receivable.map((item, index) => (
                    <div key={index} className="px-5 py-3 flex items-center justify-between hover:bg-emerald-50/50 transition-colors">
                      <span className="text-sm font-medium text-emerald-900">{item.name}</span>
                      <span className="text-sm font-bold text-emerald-700">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Payables */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-rose-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-rose-900">Top Payables</h3>
                    <p className="text-xs text-rose-600">Outstanding to suppliers</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/suppliers')}
                  className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-rose-100/50">
                {stats.payable.length === 0 ? (
                  <div className="text-center py-8 text-rose-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No payables</p>
                  </div>
                ) : (
                  stats.payable.map((item, index) => (
                    <div key={index} className="px-5 py-3 flex items-center justify-between hover:bg-rose-50/50 transition-colors">
                      <span className="text-sm font-medium text-rose-900">{item.name}</span>
                      <span className="text-sm font-bold text-rose-700">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Sales, Recent Purchases & Low Stock - Same Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Sales */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-indigo-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-900">Recent Sales</h3>
                    <p className="text-xs text-indigo-600">Latest invoices</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/sales')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-indigo-100/50">
                {recentSales.length === 0 ? (
                  <div className="text-center py-8 text-indigo-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No recent sales</p>
                  </div>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="px-5 py-3 hover:bg-indigo-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-indigo-900">{sale.invoice_no}</p>
                          <p className="text-xs text-indigo-600">{sale.customers?.customer_name || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-indigo-900">{formatCurrency(sale.total_amount)}</p>
                          <p className="text-xs text-indigo-500">{new Date(sale.invoice_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Purchases */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-blue-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">Recent Purchases</h3>
                    <p className="text-xs text-blue-600">Latest orders</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/purchases')}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-blue-100/50">
                {recentPurchases.length === 0 ? (
                  <div className="text-center py-8 text-blue-400">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No recent purchases</p>
                  </div>
                ) : (
                  recentPurchases.map((po) => (
                    <div key={po.id} className="px-5 py-3 hover:bg-blue-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">{po.po_no}</p>
                          <p className="text-xs text-blue-600">{po.suppliers?.supplier_name || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-blue-900">{formatCurrency(po.total_amount)}</p>
                          <p className="text-xs text-blue-500">{new Date(po.po_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">Low Stock</h3>
                    <p className="text-xs text-amber-600">Below 10 units</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/products')}
                  className="text-xs font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-amber-100/50">
                {lowStock.length === 0 ? (
                  <div className="text-center py-8 text-amber-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No low stock items</p>
                  </div>
                ) : (
                  lowStock.map((product, index) => (
                    <div key={index} className="px-5 py-3 flex items-center justify-between hover:bg-amber-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center">
                          <Boxes className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium text-amber-900">{product.name}</span>
                      </div>
                      <span className="text-sm font-bold text-amber-700">
                        {product.current_stock} {product.units?.symbol || ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
