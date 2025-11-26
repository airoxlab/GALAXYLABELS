'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ExpenseDrawer from '@/components/expenses/ExpenseDrawer';
import CategoryDrawer from '@/components/expenses/CategoryDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  Plus,
  Search,
  Receipt,
  Tag,
  Eye,
  Edit3,
  Trash2,
  X,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  Calendar,
  TrendingDown
} from 'lucide-react';

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExpenseDrawerOpen, setIsExpenseDrawerOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: null
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // View Modal
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUserId(data.user.id);
        fetchExpenses(data.user.id);
        fetchCategories(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchExpenses(uid) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_categories (
            name
          )
        `)
        .eq('user_id', uid)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  }

  async function fetchCategories(uid) {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', uid)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  async function handleExpenseSubmit(formData) {
    if (!userId) return;
    setIsLoading(true);
    try {
      const expenseData = {
        user_id: userId,
        expense_date: formData.expense_date,
        category_id: parseInt(formData.category_id),
        amount: parseFloat(formData.amount),
        description: formData.description,
        notes: formData.notes || null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)
          .eq('user_id', userId);

        if (error) throw error;
        toast.success('Expense updated successfully', {
          duration: 1000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData]);

        if (error) throw error;
        toast.success('Expense added successfully', {
          duration: 1000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      }

      setEditingExpense(null);
      setIsExpenseDrawerOpen(false);
      await fetchExpenses(userId);
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteExpense(id) {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) throw error;
          toast.success('Expense deleted successfully', {
            duration: 1000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
          fetchExpenses(userId);
        } catch (error) {
          console.error('Error deleting expense:', error);
          toast.error(error.message, {
            duration: 2000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
        }
      }
    });
  }

  async function handleAddCategory(name) {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('expense_categories')
        .insert([{ user_id: userId, name }]);

      if (error) throw error;
      toast.success('Category added successfully', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      await fetchCategories(userId);
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEditCategory(id, name) {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('expense_categories')
        .update({ name })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Category updated successfully', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      await fetchCategories(userId);
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteCategory(id) {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? Expenses using this category will become uncategorized.',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('expense_categories')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) throw error;
          toast.success('Category deleted successfully', {
            duration: 1000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
          fetchCategories(userId);
        } catch (error) {
          console.error('Error deleting category:', error);
          toast.error(error.message, {
            duration: 2000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
        }
      }
    });
  }

  function handleEditExpense(expense) {
    setEditingExpense(expense);
    setIsExpenseDrawerOpen(true);
  }

  function handleAddExpense() {
    setEditingExpense(null);
    setIsExpenseDrawerOpen(true);
  }

  function handleViewExpense(expense) {
    setSelectedExpense(expense);
    setShowViewModal(true);
  }

  function handleClearFilters() {
    setSearchQuery('');
    setFilterCategory('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch =
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.expense_categories?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === 'all' || expense.category_id === parseInt(filterCategory);

    const matchesDate =
      (!startDate || new Date(expense.expense_date) >= new Date(startDate)) &&
      (!endDate || new Date(expense.expense_date) <= new Date(endDate));

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentExpenses = filteredExpenses.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, startDate, endDate]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className={cn(
                "p-2 rounded-lg transition-all flex-shrink-0",
                "hover:bg-neutral-100"
              )}
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Expenses
              </h1>
              <p className="text-sm text-neutral-500">
                Track and manage your expenses
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCategoryDrawerOpen(true)}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-white border border-neutral-200/60 text-neutral-700",
                "hover:bg-neutral-50 hover:border-neutral-300",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Tag className="w-4 h-4" />
              Categories
            </button>
            <button
              onClick={handleAddExpense}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-red-500 to-rose-600 text-white",
                "shadow-lg shadow-red-500/20",
                "hover:from-red-600 hover:to-rose-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl p-3",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Search */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Description, category..."
                  className={cn(
                    "w-full pl-8 pr-3 py-1.5",
                    "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                    "text-xs placeholder:text-neutral-400",
                    "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1.5",
                  "bg-neutral-50/80 border border-neutral-200/60 rounded-lg",
                  "text-xs",
                  "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
                  "transition-all duration-200"
                )}
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || filterCategory !== 'all' || startDate || endDate) && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleClearFilters}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium",
                  "text-neutral-600 hover:text-neutral-900",
                  "hover:bg-neutral-100",
                  "transition-all duration-200",
                  "flex items-center gap-1"
                )}
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Summary Cards - Colorful */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Expenses</p>
                <p className="text-xl font-bold text-blue-900">{filteredExpenses.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Categories</p>
                <p className="text-xl font-bold text-emerald-900">{categories.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Tag className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl border border-red-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Total Amount</p>
                <p className="text-xl font-bold text-red-900">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 font-medium">Avg. Expense</p>
                <p className="text-xl font-bold text-violet-900">
                  {formatCurrency(filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-xl",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "overflow-hidden"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Date
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Category
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-neutral-700">
                    Description
                  </th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-neutral-700">
                    Amount
                  </th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-neutral-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60">
                {currentExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                          <Receipt className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 className="text-base font-medium text-neutral-900 mb-1">No expenses found</h3>
                        <p className="text-sm text-neutral-500">
                          {searchQuery || filterCategory !== 'all' || startDate || endDate
                            ? 'Try adjusting your filters'
                            : 'Get started by adding your first expense'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-neutral-900">{formatDate(expense.expense_date)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                          "bg-neutral-100 text-neutral-700"
                        )}>
                          {expense.expense_categories?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-neutral-900">{expense.description}</div>
                        {expense.notes && (
                          <div className="text-xs text-neutral-500">
                            {expense.notes.substring(0, 50)}{expense.notes.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-semibold text-red-600">{formatCurrency(expense.amount)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewExpense(expense)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View expense"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit expense"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-neutral-200/60 flex items-center justify-between">
              <div className="text-sm text-neutral-500">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredExpenses.length)} of {filteredExpenses.length} results
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-neutral-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        currentPage === page
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      )}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === totalPages
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    currentPage === totalPages
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expense Drawer */}
      <ExpenseDrawer
        isOpen={isExpenseDrawerOpen}
        onClose={() => {
          setIsExpenseDrawerOpen(false);
          setEditingExpense(null);
        }}
        expense={editingExpense}
        categories={categories}
        onSubmit={handleExpenseSubmit}
        isLoading={isLoading}
        onAddCategory={() => {
          setIsExpenseDrawerOpen(false);
          setIsCategoryDrawerOpen(true);
        }}
      />

      {/* Category Drawer */}
      <CategoryDrawer
        isOpen={isCategoryDrawerOpen}
        onClose={() => setIsCategoryDrawerOpen(false)}
        categories={categories}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        isLoading={isLoading}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        confirmText="Delete"
      />

      {/* View Modal */}
      {showViewModal && selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowViewModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Expense Details</h2>
                    <p className="text-red-100 text-sm">View expense information</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Date */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Date</p>
                    <p className="text-lg font-bold text-blue-900">{formatDate(selectedExpense.expense_date)}</p>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Category</p>
                    <p className="text-lg font-bold text-emerald-900">{selectedExpense.expense_categories?.name || 'Uncategorized'}</p>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-red-600 font-medium">Amount</p>
                    <p className="text-lg font-bold text-red-900">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl p-4 border border-violet-100">
                <p className="text-xs text-violet-600 font-medium mb-1">Description</p>
                <p className="text-sm font-medium text-violet-900">{selectedExpense.description || '-'}</p>
              </div>

              {/* Notes */}
              {selectedExpense.notes && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium mb-1">Notes</p>
                  <p className="text-sm text-amber-900">{selectedExpense.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditExpense(selectedExpense);
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
