'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { AlertTriangle, Package, ArrowDownToLine, Search, RefreshCw, X, Plus, Download, FileText } from 'lucide-react';
import QuantityCounter from '@/components/ui/QuantityCounter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function LowStockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, low, out
  const [user, setUser] = useState(null);

  // Stock In Sidebar
  const [showStockInSidebar, setShowStockInSidebar] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockInForm, setStockInForm] = useState({
    quantity: '',
    unit_cost: '',
    notes: ''
  });
  const [savingStockIn, setSavingStockIn] = useState(false);

  // Settings for export
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        await fetchLowStockProducts(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLowStockProducts(userId) {
    if (!userId) return;

    try {
      const [productsRes, settingsRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            id,
            name,
            current_stock,
            unit_price,
            low_stock_threshold,
            units (symbol),
            categories (name)
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('current_stock', { ascending: true }),
        supabase
          .from('settings')
          .select('*')
          .eq('user_id', userId)
          .single(),
      ]);

      if (productsRes.error) throw productsRes.error;

      // Filter products where stock is at or below threshold
      const lowStockProducts = (productsRes.data || []).filter(p => {
        const stock = p.current_stock || 0;
        const threshold = p.low_stock_threshold || 10;
        return stock <= threshold;
      });

      setProducts(lowStockProducts);
      setSettings(settingsRes.data || null);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      toast.error('Error loading data', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  const handleRefresh = async () => {
    if (user) {
      setLoading(true);
      await fetchLowStockProducts(user.id);
      setLoading(false);
      toast.success('Data refreshed', {
        duration: 1500,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      if (filteredProducts.length === 0) {
        toast.error('No products to export', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
        return;
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Create header rows with company info
      const headerRows = [
        [settings?.company_name || 'Company Name'],
        [settings?.company_address || ''],
        [`Phone: ${settings?.contact_detail_1 || ''}`],
        [`Email: ${settings?.email_1 || ''}`],
        [`NTN: ${settings?.ntn || ''}`],
        [],
        ['Low Stock Alert Report'],
        [`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`],
        [],
        [`Total Low Stock Items: ${filteredProducts.length}`, `Out of Stock: ${outOfStockCount}`, `Low Stock: ${lowStockCount}`],
        []
      ];

      // Create data rows
      const dataRows = filteredProducts.map(product => [
        product.name,
        product.categories?.name || '-',
        product.current_stock || 0,
        product.units?.symbol || '-',
        product.low_stock_threshold || 10,
        Math.max(0, (product.low_stock_threshold || 10) - (product.current_stock || 0)),
        getStockLevel(product).label
      ]);

      // Add column headers
      const columnHeaders = ['Product Name', 'Category', 'Current Stock', 'Unit', 'Threshold', 'Needed', 'Status'];

      // Combine all rows
      const allRows = [...headerRows, columnHeaders, ...dataRows];

      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      // Auto-size columns
      const colWidths = [
        { wch: 30 }, // Product Name
        { wch: 15 }, // Category
        { wch: 12 }, // Current Stock
        { wch: 8 },  // Unit
        { wch: 10 }, // Threshold
        { wch: 10 }, // Needed
        { wch: 10 }  // Status
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Low Stock Report');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Low_Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

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
      if (filteredProducts.length === 0) {
        toast.error('No products to export', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Colors
      const primaryColor = [23, 23, 23];
      const grayColor = [115, 115, 115];

      let yPos = 15;

      // Header with Logo
      if (settings?.logo_url) {
        try {
          const response = await fetch(settings.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          doc.addImage(base64, 'PNG', margin, yPos, 25, 25);
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }

      // Company Name and Details
      const companyX = settings?.logo_url ? margin + 30 : margin;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text(settings?.company_name || 'COMPANY NAME', companyX, yPos + 8);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayColor);

      let detailY = yPos + 14;
      if (settings?.company_address) {
        doc.text(settings.company_address, companyX, detailY);
        detailY += 4;
      }
      if (settings?.contact_detail_1) {
        doc.text(`Phone: ${settings.contact_detail_1}`, companyX, detailY);
        detailY += 4;
      }
      if (settings?.email_1) {
        doc.text(`Email: ${settings.email_1}`, companyX, detailY);
        detailY += 4;
      }
      if (settings?.ntn) {
        doc.text(`NTN: ${settings.ntn}`, companyX, detailY);
      }

      yPos += 40;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);

      yPos += 8;

      // Report Title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('LOW STOCK ALERT REPORT', pageWidth / 2, yPos, { align: 'center' });

      yPos += 8;

      // Another divider
      doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

      yPos += 10;

      // Summary Info
      doc.setFontSize(9);
      doc.setTextColor(...primaryColor);

      doc.setFont('helvetica', 'bold');
      doc.text('Date:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('en-GB'), margin + 20, yPos);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Items:', margin, yPos + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${filteredProducts.length}`, margin + 28, yPos + 5);

      // Right side summary
      const rightCol = pageWidth - margin - 50;
      doc.setFont('helvetica', 'bold');
      doc.text('Low Stock:', rightCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(202, 138, 4);
      doc.text(`${lowStockCount}`, rightCol + 28, yPos);

      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Out of Stock:', rightCol, yPos + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text(`${outOfStockCount}`, rightCol + 28, yPos + 5);

      yPos += 15;

      // Items Table
      const tableData = filteredProducts.map((product, index) => [
        index + 1,
        product.name,
        product.categories?.name || '-',
        `${product.current_stock || 0}`,
        `${product.low_stock_threshold || 10}`,
        `${Math.max(0, (product.low_stock_threshold || 10) - (product.current_stock || 0))}`,
        getStockLevel(product).label
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Product', 'Category', 'Stock', 'Threshold', 'Needed', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 5,
          minCellHeight: 10
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25 },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 20, halign: 'right' },
          6: { cellWidth: 18, halign: 'center' }
        },
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
          if (data.column.index === 6 && data.cell.section === 'body') {
            const status = data.cell.raw;
            if (status === 'Out') {
              doc.setTextColor(220, 38, 38);
            } else {
              doc.setTextColor(202, 138, 4);
            }
          }
        },
      });

      // Totals Section
      const finalY = doc.lastAutoTable.finalY + 10;
      const totalsX = pageWidth - margin - 70;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('Total Items:', totalsX, finalY);
      doc.text(`${filteredProducts.length}`, pageWidth - margin, finalY, { align: 'right' });

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text(`Page ${i} of ${pageCount}`, margin, pageHeight - 10);
        doc.text('Powered by airoxlab.com', pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      doc.save(`Low_Stock_Report_${new Date().toISOString().split('T')[0]}.pdf`);

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

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const stock = product.current_stock || 0;

    if (filterType === 'out') {
      return matchesSearch && stock <= 0;
    } else if (filterType === 'low') {
      return matchesSearch && stock > 0;
    }
    return matchesSearch;
  });

  const outOfStockCount = products.filter(p => (p.current_stock || 0) <= 0).length;
  const lowStockCount = products.filter(p => (p.current_stock || 0) > 0).length;

  const getStockLevel = (product) => {
    const stock = product.current_stock || 0;
    const threshold = product.low_stock_threshold || 10;

    if (stock <= 0) {
      return {
        label: 'Out',
        textColor: 'text-red-600',
        bgColor: 'bg-red-50'
      };
    }

    const percentage = Math.min((stock / threshold) * 100, 100);
    if (percentage <= 50) {
      return {
        label: 'Low',
        textColor: 'text-yellow-600',
        bgColor: 'bg-yellow-50'
      };
    }
    return {
      label: 'Low',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    };
  };

  const openStockInSidebar = (product) => {
    setSelectedProduct(product);
    setStockInForm({
      quantity: '',
      unit_cost: '',
      notes: ''
    });
    setShowStockInSidebar(true);
  };

  const closeStockInSidebar = () => {
    setShowStockInSidebar(false);
    setSelectedProduct(null);
    setStockInForm({ quantity: '', unit_cost: '', notes: '' });
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !stockInForm.quantity) return;

    setSavingStockIn(true);
    try {
      const quantity = parseFloat(stockInForm.quantity);
      const unitCost = parseFloat(stockInForm.unit_cost) || 0;

      const { error } = await supabase.from('stock_in').insert({
        user_id: user.id,
        product_id: selectedProduct.id,
        quantity: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        reference_type: 'purchase',
        notes: stockInForm.notes || `Restocking ${selectedProduct.name}`,
        date: new Date().toISOString().split('T')[0],
        created_by: user.id
      });

      if (error) throw error;

      toast.success(`Added ${quantity} ${selectedProduct.units?.symbol || 'units'} to ${selectedProduct.name}`, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      closeStockInSidebar();
      await fetchLowStockProducts(user.id);
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error(error.message || 'Error adding stock', {
        duration: 3000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSavingStockIn(false);
    }
  };

  if (loading) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

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
              <h1 className="text-xl font-bold text-neutral-900">Low Stock Alert</h1>
              <p className="text-sm text-neutral-500">Products that need to be restocked</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => router.push('/stock/in')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                "bg-neutral-900 text-white hover:bg-neutral-800"
              )}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Stock In
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Alerts</p>
                <p className="text-2xl font-bold text-neutral-900">{products.length}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
              </div>
              <Package className="w-6 h-6 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
              </div>
              <Package className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm rounded-lg transition-all",
                  "bg-white border border-neutral-300",
                  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                )}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={cn(
                "px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            >
              <option value="all">All Items</option>
              <option value="low">Low Stock Only</option>
              <option value="out">Out of Stock Only</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  "bg-neutral-900 text-white hover:bg-neutral-800"
                )}
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={exportToPDF}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  "bg-neutral-900 text-white hover:bg-neutral-800"
                )}
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Low Stock Products</h2>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">
                {products.length === 0 ? 'All products are well stocked!' : 'No products match your search'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Product</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Category</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Current</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Threshold</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map(product => {
                    const stockLevel = getStockLevel(product);
                    const stock = product.current_stock || 0;
                    const threshold = product.low_stock_threshold || 10;

                    return (
                      <tr key={product.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-neutral-900">{product.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-500">{product.categories?.name || '-'}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-neutral-900">
                            {stock}
                          </span>
                          {product.units?.symbol && (
                            <span className="text-sm text-neutral-400 ml-1">{product.units.symbol}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-neutral-700">
                            {threshold}
                          </span>
                          {product.units?.symbol && (
                            <span className="text-sm text-neutral-400 ml-1">{product.units.symbol}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-sm font-medium",
                            stockLevel.textColor, stockLevel.bgColor
                          )}>
                            {stockLevel.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => openStockInSidebar(product)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              "text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                            )}
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Stock In Sidebar */}
      {showStockInSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeStockInSidebar}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Restock Product</h2>
              <button
                onClick={closeStockInSidebar}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            <form onSubmit={handleStockIn} className="flex-1 p-4 flex flex-col">
              <div className="space-y-4 flex-1">
                {/* Product Info */}
                <div className="bg-neutral-50 rounded-lg p-4">
                  <p className="text-lg font-bold text-neutral-900 mb-3">{selectedProduct?.name}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Current Stock</span>
                      <span className="font-semibold text-neutral-900">
                        {selectedProduct?.current_stock || 0} {selectedProduct?.units?.symbol || ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Threshold</span>
                      <span className="text-neutral-700">
                        {selectedProduct?.low_stock_threshold || 10} {selectedProduct?.units?.symbol || ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Category</span>
                      <span className="text-neutral-700">{selectedProduct?.categories?.name || '-'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Quantity to Add *
                  </label>
                  <QuantityCounter
                    value={stockInForm.quantity}
                    onChange={(val) => setStockInForm(prev => ({ ...prev, quantity: val }))}
                    min={1}
                    step={1}
                    placeholder="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={stockInForm.notes}
                    onChange={(e) => setStockInForm(prev => ({ ...prev, notes: e.target.value }))}
                    className={cn(
                      "w-full px-3 py-2.5 text-sm rounded-lg resize-none",
                      "bg-white border border-neutral-300",
                      "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                    )}
                    placeholder="Optional notes..."
                    rows={3}
                  />
                </div>

                {stockInForm.quantity && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">New Stock Level</span>
                      <span className="text-lg font-bold text-green-700">
                        {((selectedProduct?.current_stock || 0) + parseFloat(stockInForm.quantity || 0)).toFixed(2)} {selectedProduct?.units?.symbol || ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-neutral-200 mt-4">
                <button
                  type="submit"
                  disabled={savingStockIn || !stockInForm.quantity}
                  className={cn(
                    "w-full py-3 rounded-lg font-semibold text-sm",
                    "bg-neutral-900 text-white",
                    "hover:bg-neutral-800",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2 transition-colors"
                  )}
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  {savingStockIn ? 'Adding...' : 'Restock'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
