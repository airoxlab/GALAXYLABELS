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
  TrendingDown,
  Download,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
  const [settings, setSettings] = useState(null);

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
        fetchSettings(data.user.id);
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

  async function fetchSettings(uid) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', uid)
        .single();

      if (error) throw error;
      setSettings(data || null);
    } catch (error) {
      console.error('Error fetching settings:', error);
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

  // Export to Excel
  const exportToExcel = () => {
    try {
      if (filteredExpenses.length === 0) {
        toast.error('No expenses to export', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
        return;
      }

      const workbook = XLSX.utils.book_new();

      // Create header rows with company info
      const headerRows = [
        [settings?.company_name || 'Company Name'],
        [settings?.company_address || ''],
        [`Phone: ${settings?.contact_detail_1 || ''}`],
        [`Email: ${settings?.email_1 || ''}`],
        [`NTN: ${settings?.ntn || ''}`],
        [],
        ['Expense Report'],
        [`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`],
        [],
        [`Total Expenses: ${filteredExpenses.length}`, `Total Amount: ${formatCurrency(totalAmount)}`],
        []
      ];

      // Create data rows
      const dataRows = filteredExpenses.map(expense => [
        formatDate(expense.expense_date),
        expense.expense_categories?.name || 'Uncategorized',
        expense.description || '-',
        expense.amount || 0,
        expense.notes || '-'
      ]);

      // Add column headers
      const columnHeaders = ['Date', 'Category', 'Description', 'Amount', 'Notes'];

      // Combine all rows
      const allRows = [...headerRows, columnHeaders, ...dataRows];

      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      // Auto-size columns
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 20 }, // Category
        { wch: 40 }, // Description
        { wch: 15 }, // Amount
        { wch: 30 }, // Notes
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success('Excel exported successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error(`Error exporting Excel: ${error.message}`, {
        duration: 3000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      if (filteredExpenses.length === 0) {
        toast.error('No expenses to export', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
        return;
      }

      // Helper to load image as base64 with compression
      const getImageAsBase64 = async (url, maxWidth = 150, quality = 0.8) => {
        if (!url) return null;
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
        } catch (error) {
          console.error('Error loading image:', error);
          return null;
        }
      };

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Load images with compression
      const images = {};
      if (settings?.logo_url) {
        images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      }
      if (settings?.qr_code_url) {
        images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);
      }

      // Prepare data with category
      const expensesData = filteredExpenses.map((expense, idx) => ({
        idx: idx + 1,
        date: formatDate(expense.expense_date),
        category: expense.expense_categories?.name || 'Uncategorized',
        description: expense.description || '-',
        amount: parseFloat(expense.amount) || 0
      }));

      // Header
      let y = 14;
      const centerX = pageWidth / 2;

      // Logo (left aligned)
      if (images.logo) {
        try {
          doc.addImage(images.logo, 'JPEG', margin, y, 30, 30);
        } catch (error) {
          console.error('Error adding logo:', error);
        }
      }

      // Company details (centered)
      const companyY = y + 8;
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(settings?.company_name || 'COMPANY NAME', centerX, companyY, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);

      let contactY = companyY + 7;
      if (settings?.company_address) {
        doc.text(settings.company_address, centerX, contactY, { align: 'center' });
        contactY += 5;
      }

      const contact = [
        settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null,
        settings?.email_1 ? `Email: ${settings.email_1}` : null
      ].filter(Boolean).join(' | ');
      if (contact) {
        doc.text(contact, centerX, contactY, { align: 'center' });
        contactY += 5;
      }

      const tax = [
        settings?.ntn ? `NTN # ${settings.ntn}` : null,
        settings?.str ? `STR # ${settings.str}` : null
      ].filter(Boolean).join('   ');
      if (tax) {
        doc.text(tax, centerX, contactY, { align: 'center' });
      }

      // QR Code (right aligned)
      if (images.qr) {
        try {
          doc.addImage(images.qr, 'JPEG', pageWidth - margin - 30, y, 30, 30);
        } catch (error) {
          console.error('Error adding QR code:', error);
        }
      }

      y += 45;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 40, y, centerX + 40, y);
      y += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('EXPENSE REPORT', centerX, y, { align: 'center' });
      y += 4;
      doc.setDrawColor(0, 0, 0);
      doc.line(centerX - 42, y, centerX + 42, y);
      y += 10;

      // Date info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, centerX, y, { align: 'center' });
      y += 10;

      // Summary section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      const leftX = margin;
      const rightX = pageWidth - margin;

      doc.setFont('helvetica', 'bold');
      doc.text('Total Expenses:', leftX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${filteredExpenses.length}`, leftX + 35, y);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Amount:', rightX - 60, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text(formatCurrency(totalAmount), rightX, y, { align: 'right' });

      y += 10;

      // Table data
      const tableData = expensesData.map((expense) => [
        String(expense.idx),
        expense.date,
        expense.category,
        expense.description,
        formatCurrency(expense.amount)
      ]);

      autoTable(doc, {
        startY: y,
        head: [['S.N', 'Date', 'Category', 'Description', 'Amount']],
        body: tableData,
        foot: [['', '', '', 'TOTAL', formatCurrency(totalAmount)]],
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 4, right: 1, bottom: 7, left: 1 },
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          lineColor: [255, 255, 255],
          minCellHeight: 10,
          cellPadding: { top: 3, right: 1, bottom: 3, left: 1 },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 7, right: 1, bottom: 2, left: 1 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 18 },
          1: { halign: 'center', cellWidth: 28 },
          2: { halign: 'center', cellWidth: 35 },
          3: { halign: 'left', cellWidth: 80 },
          4: { halign: 'right', cellWidth: 34 },
        },
        tableWidth: 195,
        styles: { overflow: 'linebreak', cellPadding: 2 },
        margin: { left: (pageWidth - 195) / 2, right: (pageWidth - 195) / 2, bottom: 30 },
        showHead: 'everyPage',
        showFoot: 'lastPage',
        willDrawPage: function (data) {
          if (data.pageNumber > 1) {
            const topY = 10;
            const lineY = topY + 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);

            doc.text('Expense Report', margin, topY);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, topY, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, lineY, pageWidth - margin, lineY);

            data.settings.startY = lineY + 8;
          }
        },
        didDrawPage: function(data) {
          // Draw border around header row with column separators
          const headerRow = data.table.head[0];
          if (headerRow && headerRow.cells[0]) {
            const startX = headerRow.cells[0].x;
            const startY = headerRow.cells[0].y;
            const tableWidth = 195;
            const borderHeight = headerRow.height - 3;

            if (startY >= 10) {
              doc.setDrawColor(0, 0, 0);
              doc.setLineWidth(0.3);

              doc.rect(startX, startY, tableWidth, borderHeight);

              let currentX = startX;
              const cells = headerRow.cells;
              Object.keys(cells).forEach((key, i) => {
                if (i < Object.keys(cells).length - 1) {
                  currentX += cells[key].width;
                  doc.line(currentX, startY, currentX, startY + borderHeight);
                }
              });
            }
          }

          // Draw border around footer row (only top and bottom lines)
          const footerRow = data.table.foot[0];
          if (footerRow && footerRow.cells[0]) {
            const startX = footerRow.cells[0].x;
            const startY = footerRow.cells[0].y;
            const tableWidth = 195;
            const footerHeight = footerRow.height;

            if (startY >= 10) {
              doc.setDrawColor(0, 0, 0);
              doc.setLineWidth(0.3);

              doc.line(startX, startY, startX + tableWidth, startY);
              doc.line(startX, startY + footerHeight, startX + tableWidth, startY + footerHeight);
            }
          }
        },
        didDrawCell: function(data) {
          if (data.section === 'foot' && data.row.index === 0) {
            data.cell.y += 3;
          }
        },
      });

      // Page numbers and footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      doc.save(`Expenses_${new Date().toISOString().split('T')[0]}.pdf`);

      toast.success('PDF exported successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(`Error generating PDF: ${error.message}`, {
        duration: 4000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportToExcel}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
                "shadow-lg shadow-emerald-500/20",
                "hover:from-emerald-600 hover:to-teal-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm",
                "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
                "shadow-lg shadow-blue-500/20",
                "hover:from-blue-600 hover:to-indigo-700",
                "transition-all duration-200",
                "flex items-center gap-2"
              )}
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
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
