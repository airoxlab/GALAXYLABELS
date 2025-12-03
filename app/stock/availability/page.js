'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Package, Search, AlertTriangle, TrendingUp, TrendingDown, ArrowDownToLine, RefreshCw, X, Plus, Download, FileText, Loader2 } from 'lucide-react';
import QuantityCounter from '@/components/ui/QuantityCounter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function StockAvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
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
        // Use parentUserId for data queries (staff sees parent account data)
        await fetchData(data.user.parentUserId || data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData(userId) {
    if (!userId) return;

    try {
      const [productsRes, categoriesRes, settingsRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            id,
            name,
            current_stock,
            unit_price,
            low_stock_threshold,
            unit_id,
            category_id,
            units (symbol),
            categories (name)
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('categories')
          .select('id, name')
          .eq('user_id', userId)
          .order('name'),
        supabase
          .from('settings')
          .select('*')
          .eq('user_id', userId)
          .single(),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setSettings(settingsRes.data || null);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(error.message || 'Error loading data', {
        duration: 4000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  }

  const handleRefresh = async () => {
    if (user) {
      setLoading(true);
      await fetchData(user.id);
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
        ['Stock Availability Report'],
        [`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`],
        [],
        [`Total Products: ${filteredProducts.length}`, `Stock Value: Rs ${totalStockValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`, `Low Stock: ${lowStockCount}`, `Out of Stock: ${outOfStockCount}`],
        []
      ];

      // Create data rows
      const dataRows = filteredProducts.map(product => [
        product.name,
        product.categories?.name || '-',
        product.current_stock || 0,
        product.units?.symbol || '-',
        product.unit_price || 0,
        ((product.current_stock || 0) * (product.unit_price || 0)).toFixed(2),
        product.low_stock_threshold || 10,
        getStockStatus(product).label
      ]);

      // Add column headers
      const columnHeaders = ['Product Name', 'Category', 'Current Stock', 'Unit', 'Unit Price', 'Stock Value', 'Threshold', 'Status'];

      // Combine all rows
      const allRows = [...headerRows, columnHeaders, ...dataRows];

      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      // Auto-size columns
      const colWidths = [
        { wch: 30 }, // Product Name
        { wch: 15 }, // Category
        { wch: 12 }, // Current Stock
        { wch: 8 },  // Unit
        { wch: 12 }, // Unit Price
        { wch: 15 }, // Stock Value
        { wch: 10 }, // Threshold
        { wch: 10 }  // Status
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Availability');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Stock_Availability_${new Date().toISOString().split('T')[0]}.xlsx`);

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

  // Export to PDF with professional design matching Sale Order PDF
  const exportToPDF = async () => {
    try {
      if (filteredProducts.length === 0) {
        toast.error('No products to export', {
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

      // Calculate totals
      const totalValue = totalStockValue;
      const totalStock = filteredProducts.reduce((sum, p) => sum + (p.current_stock || 0), 0);

      // Prepare data with category in product name
      const productsData = filteredProducts.map((prod, idx) => ({
        idx: idx + 1,
        productName: prod.name || '-',
        category: prod.categories?.name || '',
        stock: prod.current_stock || 0,
        minStock: prod.low_stock_threshold || 10,
        unitPrice: prod.unit_price || 0,
        value: (prod.current_stock || 0) * (prod.unit_price || 0)
      }));

      // Format currency
      const formatCurrency = (value) => {
        return `Rs ${value.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
      };

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


      y += 45;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 40, y, centerX + 40, y);
      y += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('STOCK AVAILABILITY REPORT', centerX, y, { align: 'center' });
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
      doc.text('Date:', leftX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('en-GB'), leftX + 15, y);

      doc.setFont('helvetica', 'bold');
      doc.text('Stock Value:', rightX - 60, y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrency(totalValue), rightX, y, { align: 'right' });

      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Total Products:', leftX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${filteredProducts.length}`, leftX + 32, y);

      doc.setFont('helvetica', 'bold');
      doc.text('Low Stock:', rightX - 60, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(202, 138, 4);
      doc.text(`${lowStockCount}`, rightX, y, { align: 'right' });

      y += 6;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Out of Stock:', rightX - 60, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text(`${outOfStockCount}`, rightX, y, { align: 'right' });

      y += 10;

      // Simple table body (empty strings for custom-rendered columns)
      const simpleTableBody = productsData.map((prod) => [
        String(prod.idx),
        '',  // Product name will be custom rendered
        String(prod.stock),
        prod.unitPrice.toFixed(2),
        formatCurrency(prod.value)
      ]);

      autoTable(doc, {
        startY: y,
        head: [['S.N', 'Product Name', 'Current Stock', 'Unit Price', 'Stock Value']],
        body: simpleTableBody,
        foot: [['TOTAL', '', String(totalStock), '', formatCurrency(totalValue)]],
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
          fontSize: 11,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'top',
          lineWidth: 0,
          lineColor: [255, 255, 255],
          minCellHeight: 14,
          cellPadding: { top: 4, right: 1, bottom: 3, left: 1 },
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
          1: { halign: 'center', cellWidth: 77 },
          2: { halign: 'center', cellWidth: 33 },
          3: { halign: 'center', cellWidth: 33 },
          4: { halign: 'center', cellWidth: 34 },
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

            doc.text('Stock Availability Report', margin, topY);
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
          // Custom rendering for Product Name column (column 1) in body
          if (data.section === 'body' && data.column.index === 1) {
            const prodData = productsData[data.row.index];
            if (prodData) {
              const cellCenterX = data.cell.x + data.cell.width / 2;
              const topY = data.cell.y + 7;
              const bottomY = data.cell.y + 13;

              doc.setFontSize(11);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(0, 0, 0);
              doc.text(prodData.productName, cellCenterX, topY, { align: 'center' });

              if (prodData.category) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                doc.text(`(${prodData.category})`, cellCenterX, bottomY, { align: 'center' });
              }
            }
          }

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

      doc.save(`Stock_Availability_${new Date().toISOString().split('T')[0]}.pdf`);

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

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !filterCategory || product.category_id?.toString() === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'stock':
          aVal = a.current_stock || 0;
          bVal = b.current_stock || 0;
          break;
        case 'value':
          aVal = (a.current_stock || 0) * (a.unit_price || 0);
          bVal = (b.current_stock || 0) * (b.unit_price || 0);
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const getStockStatus = (product) => {
    const stock = product.current_stock || 0;
    const threshold = product.low_stock_threshold || 10;

    if (stock <= 0) {
      return { status: 'out', label: 'Out', color: 'text-red-600 bg-red-50' };
    } else if (stock <= threshold) {
      return { status: 'low', label: 'Low', color: 'text-yellow-600 bg-yellow-50' };
    }
    return { status: 'ok', label: 'OK', color: 'text-green-600 bg-green-50' };
  };

  const totalStockValue = filteredProducts.reduce((sum, p) =>
    sum + ((p.current_stock || 0) * (p.unit_price || 0)), 0
  );

  const lowStockCount = filteredProducts.filter(p => {
    const stock = p.current_stock || 0;
    const threshold = p.low_stock_threshold || 10;
    return stock <= threshold && stock > 0;
  }).length;

  const outOfStockCount = filteredProducts.filter(p => (p.current_stock || 0) <= 0).length;

  const openStockInSidebar = (product) => {
    setSelectedProduct(product);
    setStockInForm({
      quantity: '',
      unit_cost: product.unit_price || '',
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
        user_id: user.parentUserId || user.id,
        product_id: selectedProduct.id,
        quantity: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        reference_type: 'purchase',
        notes: stockInForm.notes || `Quick stock in for ${selectedProduct.name}`,
        date: new Date().toISOString().split('T')[0],
        created_by: user.parentUserId || user.id
      });

      if (error) throw error;

      toast.success(`Added ${quantity} ${selectedProduct.units?.symbol || 'units'} to ${selectedProduct.name}`, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      closeStockInSidebar();
      await fetchData(user.id);
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
              <h1 className="text-xl font-bold text-neutral-900">Stock Availability</h1>
              <p className="text-sm text-neutral-500">Current stock levels for all products</p>
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
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Products</p>
                <p className="text-xl font-bold text-blue-900">{filteredProducts.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-xl border border-emerald-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Stock Value</p>
                <p className="text-xl font-bold text-emerald-900">
                  {totalStockValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-xl border border-amber-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Low Stock</p>
                <p className="text-xl font-bold text-amber-900">{lowStockCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl border border-red-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Out of Stock</p>
                <p className="text-xl font-bold text-red-900">{outOfStockCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-neutral-200/60 p-3 shadow-sm">
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
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={cn(
                "px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id.toString()}>{cat.name}</option>
              ))}
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className={cn(
                "px-3 py-2 text-sm rounded-lg transition-all",
                "bg-white border border-neutral-300",
                "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              )}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="stock-asc">Stock (Low-High)</option>
              <option value="stock-desc">Stock (High-Low)</option>
              <option value="value-asc">Value (Low-High)</option>
              <option value="value-desc">Value (High-Low)</option>
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
        <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-neutral-200/60 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Product Stock Levels</h2>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Product</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Category</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Stock</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Value</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    const stockValue = (product.current_stock || 0) * (product.unit_price || 0);

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
                            {product.current_stock || 0}
                          </span>
                          {product.units?.symbol && (
                            <span className="text-sm text-neutral-400 ml-1">{product.units.symbol}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-neutral-700">
                            {(product.unit_price || 0).toLocaleString('en-PK')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-neutral-900">
                            {stockValue.toLocaleString('en-PK')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-sm font-medium",
                            stockStatus.color
                          )}>
                            {stockStatus.label}
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
                            Stock In
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
              <h2 className="text-sm font-semibold text-neutral-900">Stock In</h2>
              <button
                onClick={closeStockInSidebar}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            <form onSubmit={handleStockIn} className="flex-1 p-4 flex flex-col" autoComplete="off">
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
                  {savingStockIn ? 'Adding...' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
