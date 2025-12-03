'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ChevronLeft,
  Eye,
  FileDown,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Package,
  Users
} from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sale Report
  const [saleReportType, setSaleReportType] = useState('all');
  const [saleParty, setSaleParty] = useState('');
  const [saleStartDate, setSaleStartDate] = useState('');
  const [saleEndDate, setSaleEndDate] = useState('');

  // Purchase Report
  const [purchaseReportType, setPurchaseReportType] = useState('all');
  const [purchaseParty, setPurchaseParty] = useState('');
  const [purchaseStartDate, setPurchaseStartDate] = useState('');
  const [purchaseEndDate, setPurchaseEndDate] = useState('');

  // Customer Ledger Report
  const [customerLedgerParty, setCustomerLedgerParty] = useState('');
  const [customerLedgerType, setCustomerLedgerType] = useState('all');
  const [customerLedgerStartDate, setCustomerLedgerStartDate] = useState('');
  const [customerLedgerEndDate, setCustomerLedgerEndDate] = useState('');

  // GST Report
  const [gstReportType] = useState('gst');
  const [gstReportPartyType, setGstReportPartyType] = useState('all');
  const [gstParty, setGstParty] = useState('');
  const [gstStartDate, setGstStartDate] = useState('');
  const [gstEndDate, setGstEndDate] = useState('');

  // Stock Report
  const [stockReportType, setStockReportType] = useState('all');
  const [stockStartDate, setStockStartDate] = useState('');
  const [stockEndDate, setStockEndDate] = useState('');

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
        // Use parentUserId for data queries (staff sees parent account data)
        const dataUserId = data.user.parentUserId || data.user.id;
        fetchCustomers(dataUserId);
        fetchSuppliers(dataUserId);
        fetchSettings(dataUserId);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function fetchSettings(userId) {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    setSettings(data);
  }

  async function fetchCustomers(userId) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name')
        .eq('user_id', userId)
        .order('customer_name');

      if (error) {
        console.error('Error fetching customers:', error);
        return;
      }
      console.log('Fetched customers:', data);
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function fetchSuppliers(userId) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, supplier_name')
        .eq('user_id', userId)
        .order('supplier_name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        return;
      }
      console.log('Fetched suppliers:', data);
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  const showToast = (message, type = 'success') => {
    toast[type](message, {
      duration: 2000,
      style: { background: '#171717', color: '#fff', borderRadius: '10px', fontSize: '14px' }
    });
  };

  const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
    return `Rs ${formatted}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Helper function to convert image URL to base64
  async function getImageAsBase64(url, maxWidth = 200, quality = 0.9) {
    if (!url) return null;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = Math.min(maxWidth / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  }

  // Generate Sale Report PDF with professional design
  async function generateSaleReport(preview = false) {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales_invoices')
        .select(`*, customers(customer_name)`)
        .eq('user_id', user.id);

      if (saleReportType === 'random' && saleParty) {
        query = query.eq('customer_id', parseInt(saleParty));
      }
      if (saleStartDate) {
        query = query.gte('invoice_date', saleStartDate);
      }
      if (saleEndDate) {
        query = query.lte('invoice_date', saleEndDate);
      }

      const { data: invoices, error } = await query.order('invoice_date', { ascending: false });

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        showToast('No sales found for the selected criteria', 'error');
        setLoading(false);
        return;
      }

      const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
      const totalGst = invoices.reduce((sum, inv) => sum + (parseFloat(inv.gst_amount) || 0), 0);
      const totalSubtotal = totalAmount - totalGst;

      // Load images
      const images = {};
      if (settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      if (settings?.qr_code_url) images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Header
      let y = 14;
      const centerX = pageWidth / 2;

      if (images.logo) try { doc.addImage(images.logo, 'JPEG', margin, y, 24, 24); } catch (e) { }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(settings?.company_name || 'COMPANY NAME', centerX, y + 8, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contact = [settings?.company_address, settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null, settings?.contact_detail_2].filter(Boolean).join('. ');
      doc.text(contact, centerX, y + 15, { align: 'center' });
      const tax = [settings?.ntn ? `NTN # ${settings.ntn}` : null, settings?.str ? `STR # ${settings.str}` : null].filter(Boolean).join('   ');
      if (tax) doc.text(tax, centerX, y + 21, { align: 'center' });

      if (images.qr) try { doc.addImage(images.qr, 'JPEG', pageWidth - margin - 24, y, 24, 24); } catch (e) { }

      y += 30;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 26, y, centerX + 26, y);
      y += 5;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('SALE REPORT', centerX, y, { align: 'center' });
      y += 3;
      doc.setDrawColor(0, 0, 0);
      doc.line(centerX - 18, y, centerX + 18, y);
      y += 10;

      // Date range info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let dateRangeText = 'Period: ';
      if (saleStartDate || saleEndDate) {
        dateRangeText += `${saleStartDate ? formatDate(saleStartDate) : 'Start'} - ${saleEndDate ? formatDate(saleEndDate) : 'End'}`;
      } else {
        dateRangeText += 'All Time';
      }
      doc.text(dateRangeText, centerX, y, { align: 'center' });
      y += 8;

      // Table
      const tableData = invoices.map((inv, idx) => [
        String(idx + 1),
        inv.invoice_no || '-',
        formatDate(inv.invoice_date),
        inv.customers?.customer_name || '-',
        formatCurrency(inv.subtotal || 0),
        formatCurrency(inv.gst_amount || 0),
        formatCurrency(inv.total_amount || 0)
      ]);

      autoTable(doc, {
        startY: y,
        head: [['S.N', 'Invoice #', 'Date', 'Customer', 'Subtotal', 'GST', 'Total']],
        body: tableData,
        foot: [['TOTAL', '', '', '', formatCurrency(totalSubtotal), formatCurrency(totalGst), formatCurrency(totalAmount)]],
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          minCellHeight: 8,
          cellPadding: { top: 2, right: 0.75, bottom: 2, left: 0.75 },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 50 },
          4: { halign: 'center', cellWidth: 28 },
          5: { halign: 'center', cellWidth: 23 },
          6: { halign: 'center', cellWidth: 28 },
        },
        tableWidth: 199,
        margin: { left: (pageWidth - 199) / 2, right: (pageWidth - 199) / 2, bottom: 30 },
        showHead: 'everyPage',
        showFoot: 'lastPage',
        willDrawPage: function (data) {
          if (data.pageNumber > 1) {
            const topY = 10;
            const lineY = topY + 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text('Sale Report', margin, topY);
            doc.text(dateRangeText, pageWidth - margin, topY, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, lineY, pageWidth - margin, lineY);

            data.settings.startY = lineY + 8;
          }
        },
        didDrawPage: function(data) {
          const headerRow = data.table.head[0];
          if (headerRow && headerRow.cells[0]) {
            const startX = headerRow.cells[0].x;
            const startY = headerRow.cells[0].y;
            const tableWidth = 199;
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

          const footerRow = data.table.foot[0];
          if (footerRow && footerRow.cells[0]) {
            const startX = footerRow.cells[0].x;
            const startY = footerRow.cells[0].y;
            const tableWidth = 199;
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

      // Page numbers
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

      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        doc.save(`Sale-Report-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Sale report downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating sale report:', error);
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Generate Purchase Report PDF with professional design
  async function generatePurchaseReport(preview = false) {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('purchase_orders')
        .select(`*, suppliers(supplier_name)`)
        .eq('user_id', user.id);

      if (purchaseReportType === 'random' && purchaseParty) {
        query = query.eq('supplier_id', parseInt(purchaseParty));
      }
      if (purchaseStartDate) {
        query = query.gte('po_date', purchaseStartDate);
      }
      if (purchaseEndDate) {
        query = query.lte('po_date', purchaseEndDate);
      }

      const { data: orders, error } = await query.order('po_date', { ascending: false });

      if (error) throw error;

      if (!orders || orders.length === 0) {
        showToast('No purchases found for the selected criteria', 'error');
        setLoading(false);
        return;
      }

      const totalAmount = orders.reduce((sum, ord) => sum + (parseFloat(ord.total_amount) || 0), 0);

      // Load images
      const images = {};
      if (settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      if (settings?.qr_code_url) images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Header
      let y = 14;
      const centerX = pageWidth / 2;

      if (images.logo) try { doc.addImage(images.logo, 'JPEG', margin, y, 24, 24); } catch (e) { }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(settings?.company_name || 'COMPANY NAME', centerX, y + 8, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contact = [settings?.company_address, settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null, settings?.contact_detail_2].filter(Boolean).join('. ');
      doc.text(contact, centerX, y + 15, { align: 'center' });
      const tax = [settings?.ntn ? `NTN # ${settings.ntn}` : null, settings?.str ? `STR # ${settings.str}` : null].filter(Boolean).join('   ');
      if (tax) doc.text(tax, centerX, y + 21, { align: 'center' });

      if (images.qr) try { doc.addImage(images.qr, 'JPEG', pageWidth - margin - 24, y, 24, 24); } catch (e) { }

      y += 30;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 26, y, centerX + 26, y);
      y += 5;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('PURCHASE REPORT', centerX, y, { align: 'center' });
      y += 3;
      doc.setDrawColor(0, 0, 0);
      doc.line(centerX - 22, y, centerX + 22, y);
      y += 10;

      // Date range info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let dateRangeText = 'Period: ';
      if (purchaseStartDate || purchaseEndDate) {
        dateRangeText += `${purchaseStartDate ? formatDate(purchaseStartDate) : 'Start'} - ${purchaseEndDate ? formatDate(purchaseEndDate) : 'End'}`;
      } else {
        dateRangeText += 'All Time';
      }
      doc.text(dateRangeText, centerX, y, { align: 'center' });
      y += 8;

      // Table
      const tableData = orders.map((ord, idx) => [
        String(idx + 1),
        ord.po_no || '-',
        formatDate(ord.po_date),
        ord.suppliers?.supplier_name || '-',
        ord.status || '-',
        formatCurrency(ord.total_amount || 0)
      ]);

      autoTable(doc, {
        startY: y,
        head: [['S.N', 'PO #', 'Date', 'Supplier', 'Status', 'Total']],
        body: tableData,
        foot: [['TOTAL', '', '', '', '', formatCurrency(totalAmount)]],
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          minCellHeight: 8,
          cellPadding: { top: 2, right: 0.75, bottom: 2, left: 0.75 },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 55 },
          4: { halign: 'center', cellWidth: 25 },
          5: { halign: 'center', cellWidth: 30 },
        },
        tableWidth: 180,
        margin: { left: (pageWidth - 180) / 2, right: (pageWidth - 180) / 2, bottom: 30 },
        showHead: 'everyPage',
        showFoot: 'lastPage',
        willDrawPage: function (data) {
          if (data.pageNumber > 1) {
            const topY = 10;
            const lineY = topY + 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text('Purchase Report', margin, topY);
            doc.text(dateRangeText, pageWidth - margin, topY, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, lineY, pageWidth - margin, lineY);

            data.settings.startY = lineY + 8;
          }
        },
        didDrawPage: function(data) {
          const headerRow = data.table.head[0];
          if (headerRow && headerRow.cells[0]) {
            const startX = headerRow.cells[0].x;
            const startY = headerRow.cells[0].y;
            const tableWidth = 180;
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

          const footerRow = data.table.foot[0];
          if (footerRow && footerRow.cells[0]) {
            const startX = footerRow.cells[0].x;
            const startY = footerRow.cells[0].y;
            const tableWidth = 180;
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

      // Page numbers
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

      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        doc.save(`Purchase-Report-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Purchase report downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating purchase report:', error);
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Generate Customer Ledger Report PDF
  async function generateCustomerLedgerReport(preview = false) {
    if (!user) return;

    if (customerLedgerType === 'random' && !customerLedgerParty) {
      showToast('Please select a customer', 'error');
      return;
    }

    setLoading(true);

    try {
      // Get invoices
      let invoiceQuery = supabase
        .from('sales_invoices')
        .select(`*, customers(customer_name)`)
        .eq('user_id', user.id);

      // Get payments
      let paymentQuery = supabase
        .from('payments_in')
        .select(`*, customers(customer_name)`)
        .eq('user_id', user.id);

      if (customerLedgerType === 'random' && customerLedgerParty) {
        invoiceQuery = invoiceQuery.eq('customer_id', parseInt(customerLedgerParty));
        paymentQuery = paymentQuery.eq('customer_id', parseInt(customerLedgerParty));
      }

      if (customerLedgerStartDate) {
        invoiceQuery = invoiceQuery.gte('invoice_date', customerLedgerStartDate);
        paymentQuery = paymentQuery.gte('payment_date', customerLedgerStartDate);
      }
      if (customerLedgerEndDate) {
        invoiceQuery = invoiceQuery.lte('invoice_date', customerLedgerEndDate);
        paymentQuery = paymentQuery.lte('payment_date', customerLedgerEndDate);
      }

      const [invoicesResult, paymentsResult] = await Promise.all([
        invoiceQuery.order('invoice_date', { ascending: true }),
        paymentQuery.order('payment_date', { ascending: true })
      ]);

      if (invoicesResult.error) throw invoicesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      // Combine and sort by date
      const transactions = [
        ...(invoicesResult.data || []).map(inv => ({
          date: inv.invoice_date,
          type: 'Invoice',
          ref: inv.invoice_no,
          customer: inv.customers?.customer_name,
          debit: inv.total_amount,
          credit: 0
        })),
        ...(paymentsResult.data || []).map(pay => ({
          date: pay.payment_date,
          type: 'Payment',
          ref: `PAY-${pay.id}`,
          customer: pay.customers?.customer_name,
          debit: 0,
          credit: pay.amount
        }))
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      if (transactions.length === 0) {
        showToast('No transactions found for the selected criteria', 'error');
        setLoading(false);
        return;
      }

      let balance = 0;
      const tableData = transactions.map((txn, idx) => {
        balance += (txn.debit - txn.credit);
        return [
          idx + 1,
          formatDate(txn.date),
          txn.type,
          txn.ref,
          txn.customer || '-',
          txn.debit ? formatCurrency(txn.debit) : '-',
          txn.credit ? formatCurrency(txn.credit) : '-',
          formatCurrency(balance)
        ];
      });

      const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
      const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

      // Load images
      const images = {};
      if (settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      if (settings?.qr_code_url) images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Header
      let y = 14;
      const centerX = pageWidth / 2;

      if (images.logo) try { doc.addImage(images.logo, 'JPEG', margin, y, 24, 24); } catch (e) { }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(settings?.company_name || 'COMPANY NAME', centerX, y + 8, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contact = [settings?.company_address, settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null, settings?.contact_detail_2].filter(Boolean).join('. ');
      doc.text(contact, centerX, y + 15, { align: 'center' });
      const tax = [settings?.ntn ? `NTN # ${settings.ntn}` : null, settings?.str ? `STR # ${settings.str}` : null].filter(Boolean).join('   ');
      if (tax) doc.text(tax, centerX, y + 21, { align: 'center' });

      if (images.qr) try { doc.addImage(images.qr, 'JPEG', pageWidth - margin - 24, y, 24, 24); } catch (e) { }

      y += 30;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 30, y, centerX + 30, y);
      y += 5;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('CUSTOMER LEDGER REPORT', centerX, y, { align: 'center' });
      y += 3;
      doc.setDrawColor(0, 0, 0);
      doc.line(centerX - 32, y, centerX + 32, y);
      y += 10;

      // Date range info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let dateRangeText = 'Period: ';
      if (customerLedgerStartDate || customerLedgerEndDate) {
        dateRangeText += `${customerLedgerStartDate ? formatDate(customerLedgerStartDate) : 'Start'} - ${customerLedgerEndDate ? formatDate(customerLedgerEndDate) : 'End'}`;
      } else {
        dateRangeText += 'All Time';
      }
      doc.text(dateRangeText, centerX, y, { align: 'center' });
      y += 8;

      // Recreate table data with running balance
      balance = 0;
      const tableDataNew = transactions.map((txn, idx) => {
        balance += (txn.debit - txn.credit);
        return [
          String(idx + 1),
          formatDate(txn.date),
          txn.type,
          txn.ref,
          txn.customer || '-',
          txn.debit ? formatCurrency(txn.debit) : '-',
          txn.credit ? formatCurrency(txn.credit) : '-',
          formatCurrency(balance)
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['S.N', 'Date', 'Type', 'Ref #', 'Customer', 'Debit', 'Credit', 'Balance']],
        body: tableDataNew,
        foot: [['TOTAL', '', '', '', '', formatCurrency(totalDebit), formatCurrency(totalCredit), formatCurrency(balance)]],
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          minCellHeight: 7,
          cellPadding: { top: 2, right: 0.75, bottom: 2, left: 0.75 },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'center', cellWidth: 45 },
          5: { halign: 'center', cellWidth: 25 },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'center', cellWidth: 25 },
        },
        tableWidth: 201,
        margin: { left: (pageWidth - 201) / 2, right: (pageWidth - 201) / 2, bottom: 30 },
        showHead: 'everyPage',
        showFoot: 'lastPage',
        willDrawPage: function (data) {
          if (data.pageNumber > 1) {
            const topY = 10;
            const lineY = topY + 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text('Customer Ledger Report', margin, topY);
            doc.text(dateRangeText, pageWidth - margin, topY, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, lineY, pageWidth - margin, lineY);

            data.settings.startY = lineY + 8;
          }
        },
        didDrawPage: function(data) {
          const headerRow = data.table.head[0];
          if (headerRow && headerRow.cells[0]) {
            const startX = headerRow.cells[0].x;
            const startY = headerRow.cells[0].y;
            const tableWidth = 201;
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

          const footerRow = data.table.foot[0];
          if (footerRow && footerRow.cells[0]) {
            const startX = footerRow.cells[0].x;
            const startY = footerRow.cells[0].y;
            const tableWidth = 201;
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

      // Page numbers
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

      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        doc.save(`Customer-Ledger-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Customer ledger report downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating customer ledger report:', error);
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Generate GST Report PDF with professional design
  async function generateGstReport(preview = false) {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales_invoices')
        .select(`*, customers(customer_name)`)
        .eq('user_id', user.id)
        .gt('gst_amount', 0);

      if (gstReportPartyType === 'random' && gstParty) {
        query = query.eq('customer_id', parseInt(gstParty));
      }
      if (gstStartDate) {
        query = query.gte('invoice_date', gstStartDate);
      }
      if (gstEndDate) {
        query = query.lte('invoice_date', gstEndDate);
      }

      const { data: invoices, error } = await query.order('invoice_date', { ascending: false });

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        showToast('No GST invoices found for the selected criteria', 'error');
        setLoading(false);
        return;
      }

      const totalGst = invoices.reduce((sum, inv) => sum + (parseFloat(inv.gst_amount) || 0), 0);
      const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
      const totalSubtotal = totalAmount - totalGst;

      // Load images
      const images = {};
      if (settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      if (settings?.qr_code_url) images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Header
      let y = 14;
      const centerX = pageWidth / 2;

      if (images.logo) try { doc.addImage(images.logo, 'JPEG', margin, y, 24, 24); } catch (e) { }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(settings?.company_name || 'COMPANY NAME', centerX, y + 8, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contact = [settings?.company_address, settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null, settings?.contact_detail_2].filter(Boolean).join('. ');
      doc.text(contact, centerX, y + 15, { align: 'center' });
      const tax = [settings?.ntn ? `NTN # ${settings.ntn}` : null, settings?.str ? `STR # ${settings.str}` : null].filter(Boolean).join('   ');
      if (tax) doc.text(tax, centerX, y + 21, { align: 'center' });

      if (images.qr) try { doc.addImage(images.qr, 'JPEG', pageWidth - margin - 24, y, 24, 24); } catch (e) { }

      y += 30;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 20, y, centerX + 20, y);
      y += 5;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('GST REPORT', centerX, y, { align: 'center' });
      y += 3;
      doc.setDrawColor(0, 0, 0);
      doc.line(centerX - 16, y, centerX + 16, y);
      y += 10;

      // Date range info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let dateRangeText = 'Period: ';
      if (gstStartDate || gstEndDate) {
        dateRangeText += `${gstStartDate ? formatDate(gstStartDate) : 'Start'} - ${gstEndDate ? formatDate(gstEndDate) : 'End'}`;
      } else {
        dateRangeText += 'All Time';
      }
      doc.text(dateRangeText, centerX, y, { align: 'center' });
      y += 8;

      // Table
      const tableData = invoices.map((inv, idx) => [
        String(idx + 1),
        inv.invoice_no || '-',
        formatDate(inv.invoice_date),
        inv.customers?.customer_name || '-',
        formatCurrency(inv.subtotal || 0),
        `${inv.gst_percentage || 0}%`,
        formatCurrency(inv.gst_amount || 0),
        formatCurrency(inv.total_amount || 0)
      ]);

      autoTable(doc, {
        startY: y,
        head: [['S.N', 'Invoice #', 'Date', 'Customer', 'Subtotal', 'GST %', 'GST Amount', 'Total']],
        body: tableData,
        foot: [['TOTAL', '', '', '', formatCurrency(totalSubtotal), '', formatCurrency(totalGst), formatCurrency(totalAmount)]],
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          minCellHeight: 7,
          cellPadding: { top: 2, right: 0.75, bottom: 2, left: 0.75 },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 45 },
          4: { halign: 'center', cellWidth: 28 },
          5: { halign: 'center', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'center', cellWidth: 28 },
        },
        tableWidth: 203,
        margin: { left: (pageWidth - 203) / 2, right: (pageWidth - 203) / 2, bottom: 30 },
        showHead: 'everyPage',
        showFoot: 'lastPage',
        willDrawPage: function (data) {
          if (data.pageNumber > 1) {
            const topY = 10;
            const lineY = topY + 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text('GST Report', margin, topY);
            doc.text(dateRangeText, pageWidth - margin, topY, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, lineY, pageWidth - margin, lineY);

            data.settings.startY = lineY + 8;
          }
        },
        didDrawPage: function(data) {
          const headerRow = data.table.head[0];
          if (headerRow && headerRow.cells[0]) {
            const startX = headerRow.cells[0].x;
            const startY = headerRow.cells[0].y;
            const tableWidth = 203;
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

          const footerRow = data.table.foot[0];
          if (footerRow && footerRow.cells[0]) {
            const startX = footerRow.cells[0].x;
            const startY = footerRow.cells[0].y;
            const tableWidth = 203;
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

      // Page numbers
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

      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        doc.save(`GST-Report-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('GST report downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating GST report:', error);
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Generate Stock Report PDF with professional design
  async function generateStockReport(preview = false) {
    if (!user) return;
    setLoading(true);

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`*, categories(name)`)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      if (!products || products.length === 0) {
        showToast('No products found', 'error');
        setLoading(false);
        return;
      }

      // Calculate totals
      const totalValue = products.reduce((sum, p) => sum + ((p.current_stock || 0) * (p.unit_price || 0)), 0);
      const totalStock = products.reduce((sum, p) => sum + (p.current_stock || 0), 0);

      // Prepare data with category in product name
      const productsData = products.map((prod, idx) => ({
        idx: idx + 1,
        productName: prod.name || '-',
        category: prod.categories?.name || '',
        stock: prod.current_stock || 0,
        minStock: prod.min_stock || 0,
        unitPrice: prod.unit_price || 0,
        value: (prod.current_stock || 0) * (prod.unit_price || 0)
      }));

      // Load images
      const images = {};
      if (settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      if (settings?.qr_code_url) images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Header
      let y = 14;
      const centerX = pageWidth / 2;

      if (images.logo) try { doc.addImage(images.logo, 'JPEG', margin, y, 24, 24); } catch (e) { }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(settings?.company_name || 'COMPANY NAME', centerX, y + 8, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contact = [settings?.company_address, settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null, settings?.contact_detail_2].filter(Boolean).join('. ');
      doc.text(contact, centerX, y + 15, { align: 'center' });
      const tax = [settings?.ntn ? `NTN # ${settings.ntn}` : null, settings?.str ? `STR # ${settings.str}` : null].filter(Boolean).join('   ');
      if (tax) doc.text(tax, centerX, y + 21, { align: 'center' });

      if (images.qr) try { doc.addImage(images.qr, 'JPEG', pageWidth - margin - 24, y, 24, 24); } catch (e) { }

      y += 30;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(centerX - 32, y, centerX + 32, y);
      y += 5;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('STOCK AVAILABILITY REPORT', centerX, y, { align: 'center' });
      y += 3;
      doc.setDrawColor(0, 0, 0);
      doc.line(centerX - 38, y, centerX + 38, y);
      y += 10;

      // Date info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let dateRangeText = `Generated: ${new Date().toLocaleDateString('en-GB')}`;
      doc.text(dateRangeText, centerX, y, { align: 'center' });
      y += 8;

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
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'top',
          lineWidth: 0,
          lineColor: [255, 255, 255],
          minCellHeight: 12,
          cellPadding: { top: 3, right: 0.75, bottom: 2, left: 0.75 },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0,
          cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 18 },
          1: { halign: 'center', cellWidth: 70 },
          2: { halign: 'center', cellWidth: 35 },
          3: { halign: 'center', cellWidth: 35 },
          4: { halign: 'center', cellWidth: 35 },
        },
        tableWidth: 193,
        styles: { overflow: 'linebreak', cellPadding: 1.5 },
        margin: { left: (pageWidth - 193) / 2, right: (pageWidth - 193) / 2, bottom: 30 },
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
            doc.text(dateRangeText, pageWidth - margin, topY, { align: 'right' });

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
            const tableWidth = 193;
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
            const tableWidth = 193;
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
              const topY = data.cell.y + 6;
              const bottomY = data.cell.y + 11;

              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(0, 0, 0);
              doc.text(prodData.productName, cellCenterX, topY, { align: 'center' });

              if (prodData.category) {
                doc.setFontSize(7);
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

      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        doc.save(`Stock-Availability-Report-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Stock report downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating stock report:', error);
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Helper function to create PDF with header
  function createReportPDF(title, settings) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Company Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(23, 23, 23);
    doc.text(settings?.company_name || 'Company Name', margin, 20);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(115, 115, 115);

    const contactLine = [
      settings?.company_address,
      settings?.contact_detail_1 ? `Contact: ${settings.contact_detail_1}` : null
    ].filter(Boolean).join(' | ');

    if (contactLine) {
      doc.text(contactLine, margin, 26);
    }

    // Report Title
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(23, 23, 23);
    doc.text(title, pageWidth / 2, 40, { align: 'center' });

    // Date Range
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(115, 115, 115);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth / 2, 47, { align: 'center' });

    return doc;
  }

  // Helper function to add footer
  function addReportFooter(doc) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    doc.text('Powered by airoxlab.com', pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Customer and Supplier options for dropdowns
  const customerOptions = customers.map(c => ({ value: c.id.toString(), label: c.customer_name }));
  const supplierOptions = suppliers.map(s => ({ value: s.id.toString(), label: s.supplier_name }));

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className={cn(
              "p-1.5 rounded-lg transition-all flex-shrink-0",
              "hover:bg-neutral-100"
            )}
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
              Reports
            </h1>
            <p className="text-xs text-neutral-500">
              Generate and download business reports
            </p>
          </div>
        </div>

        {/* Sale Report */}
        <div className="relative z-40">
          <ReportCard
            icon={<TrendingUp className="w-4 h-4" />}
            title="Sale Report"
            iconColor="bg-emerald-500"
            loading={loading}
            onView={() => generateSaleReport(true)}
            onDownload={() => generateSaleReport(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="flex items-center gap-4">
                <RadioOption
                  checked={saleReportType === 'all'}
                  onChange={() => { setSaleReportType('all'); setSaleParty(''); }}
                  label="All"
                />
                <RadioOption
                  checked={saleReportType === 'random'}
                  onChange={() => setSaleReportType('random')}
                  label="Specific"
                />
              </div>

              <div className="min-w-[200px]">
                <SearchableDropdown
                  placeholder="Select Customer"
                  options={customerOptions}
                  value={saleParty}
                  onChange={setSaleParty}
                  disabled={saleReportType === 'all'}
                  searchPlaceholder="Search customers..."
                />
              </div>

              <DateInput label="Start Date" value={saleStartDate} onChange={setSaleStartDate} />
              <DateInput label="End Date" value={saleEndDate} onChange={setSaleEndDate} />
            </div>
          </ReportCard>
        </div>

        {/* Purchase Report */}
        <div className="relative z-30">
          <ReportCard
          icon={<TrendingDown className="w-4 h-4" />}
          title="Purchase Report"
          iconColor="bg-rose-500"
          loading={loading}
          onView={() => generatePurchaseReport(true)}
          onDownload={() => generatePurchaseReport(false)}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="flex items-center gap-4">
              <RadioOption
                checked={purchaseReportType === 'all'}
                onChange={() => { setPurchaseReportType('all'); setPurchaseParty(''); }}
                label="All"
              />
              <RadioOption
                checked={purchaseReportType === 'random'}
                onChange={() => setPurchaseReportType('random')}
                label="Specific"
              />
            </div>

            <div className="min-w-[200px]">
              <SearchableDropdown
                placeholder="Select Supplier"
                options={supplierOptions}
                value={purchaseParty}
                onChange={setPurchaseParty}
                disabled={purchaseReportType === 'all'}
                searchPlaceholder="Search suppliers..."
              />
            </div>

              <DateInput label="Start Date" value={purchaseStartDate} onChange={setPurchaseStartDate} />
              <DateInput label="End Date" value={purchaseEndDate} onChange={setPurchaseEndDate} />
            </div>
          </ReportCard>
        </div>

        {/* Customer Ledger Report */}
        <div className="relative z-20">
          <ReportCard
            icon={<Users className="w-4 h-4" />}
            title="Customer Ledger Report"
            iconColor="bg-blue-500"
            loading={loading}
            onView={() => generateCustomerLedgerReport(true)}
            onDownload={() => generateCustomerLedgerReport(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="flex items-center gap-4">
                <RadioOption
                  checked={customerLedgerType === 'all'}
                  onChange={() => { setCustomerLedgerType('all'); setCustomerLedgerParty(''); }}
                  label="All"
                />
                <RadioOption
                  checked={customerLedgerType === 'random'}
                  onChange={() => setCustomerLedgerType('random')}
                  label="Specific"
                />
              </div>

              <div className="min-w-[200px]">
                <SearchableDropdown
                  placeholder="Select Customer"
                  options={customerOptions}
                  value={customerLedgerParty}
                  onChange={setCustomerLedgerParty}
                  disabled={customerLedgerType === 'all'}
                  searchPlaceholder="Search customers..."
                />
              </div>

              <DateInput label="Start Date" value={customerLedgerStartDate} onChange={setCustomerLedgerStartDate} />
              <DateInput label="End Date" value={customerLedgerEndDate} onChange={setCustomerLedgerEndDate} />
            </div>
          </ReportCard>
        </div>

        {/* Sale Tax Invoice Report - PENDING */}
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-2xl",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "px-6 py-8 opacity-50"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-neutral-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-neutral-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-neutral-900">Sale Tax Invoices Report</h3>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                    "bg-amber-100 text-amber-700 border border-amber-200"
                  )}>
                    <Clock className="w-3 h-3" />
                    PENDING
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">This report is coming soon</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button disabled className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed">
                <Eye className="w-4.5 h-4.5" />
                View
              </button>
              <button disabled className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed">
                <FileDown className="w-4.5 h-4.5" />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* GST Report */}
        <div className="relative z-10">
          <ReportCard
            icon={<FileText className="w-4 h-4" />}
            title="GST Report"
            iconColor="bg-violet-500"
            loading={loading}
            onView={() => generateGstReport(true)}
            onDownload={() => generateGstReport(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="flex items-center gap-4">
                <RadioOption
                  checked={gstReportPartyType === 'all'}
                  onChange={() => { setGstReportPartyType('all'); setGstParty(''); }}
                  label="All"
                />
                <RadioOption
                  checked={gstReportPartyType === 'random'}
                  onChange={() => setGstReportPartyType('random')}
                  label="Specific"
                />
              </div>

              <div className="min-w-[200px]">
                <SearchableDropdown
                  placeholder="Select Customer"
                  options={customerOptions}
                  value={gstParty}
                  onChange={setGstParty}
                  disabled={gstReportPartyType === 'all'}
                  searchPlaceholder="Search customers..."
              />
            </div>

              <DateInput label="Start Date" value={gstStartDate} onChange={setGstStartDate} />
              <DateInput label="End Date" value={gstEndDate} onChange={setGstEndDate} />
            </div>
          </ReportCard>
        </div>

        {/* Stock Report */}
        <div className="relative z-0">
          <ReportCard
            icon={<Package className="w-4 h-4" />}
            title="Stock Report"
            iconColor="bg-amber-500"
            loading={loading}
            onView={() => generateStockReport(true)}
            onDownload={() => generateStockReport(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="flex items-center gap-4">
                <RadioOption
                  checked={stockReportType === 'all'}
                  onChange={() => setStockReportType('all')}
                  label="All Products"
                />
              </div>

              <div></div>

              <DateInput label="Start Date" value={stockStartDate} onChange={setStockStartDate} />
              <DateInput label="End Date" value={stockEndDate} onChange={setStockEndDate} />
            </div>
          </ReportCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Report Card Component
function ReportCard({ icon, title, children, loading, onView, onDownload, iconColor = "bg-blue-500" }) {
  return (
    <div className={cn(
      "bg-white/80 backdrop-blur-xl rounded-2xl",
      "border border-neutral-200/60",
      "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
      "px-6 py-8"
    )}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-white", iconColor)}>
            {React.cloneElement(icon, { className: "w-6 h-6" })}
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onView}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all",
              "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <Eye className="w-4.5 h-4.5" />
            View
          </button>
          <button
            onClick={onDownload}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all",
              "bg-neutral-900 text-white hover:bg-neutral-800",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <FileDown className="w-4.5 h-4.5" />
            Download
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// Radio Option Component
function RadioOption({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-neutral-900 border-neutral-300 focus:ring-neutral-900"
      />
      <span className="text-xs font-medium text-neutral-700">{label}</span>
    </label>
  );
}

// Date Input Component
function DateInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-neutral-500 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-3 py-2 text-xs rounded-lg",
          "bg-white border border-neutral-200/60",
          "focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-300",
          "transition-all"
        )}
      />
    </div>
  );
}
