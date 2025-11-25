'use client';

import { useState, useEffect } from 'react';
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
        fetchCustomers(data.user.id);
        fetchSuppliers(data.user.id);
        fetchSettings(data.user.id);
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

  // Generate Sale Report PDF
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

      const doc = createReportPDF('SALE REPORT', settings);

      const tableData = invoices.map((inv, idx) => [
        idx + 1,
        inv.invoice_no || '-',
        formatDate(inv.invoice_date),
        inv.customers?.customer_name || '-',
        formatCurrency(inv.subtotal),
        formatCurrency(inv.gst_amount),
        formatCurrency(inv.total_amount)
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['#', 'Invoice #', 'Date', 'Customer', 'Subtotal', 'GST', 'Total']],
        body: tableData,
        foot: [['', '', '', 'TOTAL', formatCurrency(totalAmount - totalGst), formatCurrency(totalGst), formatCurrency(totalAmount)]],
        theme: 'grid',
        headStyles: { fillColor: [23, 23, 23], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [245, 245, 245], textColor: [23, 23, 23], fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      addReportFooter(doc);

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

  // Generate Purchase Report PDF
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

      const doc = createReportPDF('PURCHASE REPORT', settings);

      const tableData = orders.map((ord, idx) => [
        idx + 1,
        ord.po_no || '-',
        formatDate(ord.po_date),
        ord.suppliers?.supplier_name || '-',
        ord.status || '-',
        formatCurrency(ord.total_amount)
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['#', 'Order #', 'Date', 'Supplier', 'Status', 'Total']],
        body: tableData,
        foot: [['', '', '', '', 'TOTAL', formatCurrency(totalAmount)]],
        theme: 'grid',
        headStyles: { fillColor: [23, 23, 23], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [245, 245, 245], textColor: [23, 23, 23], fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          5: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      addReportFooter(doc);

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

      const doc = createReportPDF('CUSTOMER LEDGER REPORT', settings);

      autoTable(doc, {
        startY: 55,
        head: [['#', 'Date', 'Type', 'Ref #', 'Customer', 'Debit', 'Credit', 'Balance']],
        body: tableData,
        foot: [['', '', '', '', 'TOTAL', formatCurrency(totalDebit), formatCurrency(totalCredit), formatCurrency(balance)]],
        theme: 'grid',
        headStyles: { fillColor: [23, 23, 23], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [245, 245, 245], textColor: [23, 23, 23], fontStyle: 'bold', fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      addReportFooter(doc);

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

  // Generate GST Report PDF
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

      const doc = createReportPDF(gstReportType === 'gst-rate' ? 'GST RATE REPORT' : 'GST REPORT', settings);

      const tableData = invoices.map((inv, idx) => [
        idx + 1,
        inv.invoice_no || '-',
        formatDate(inv.invoice_date),
        inv.customers?.customer_name || '-',
        formatCurrency(inv.subtotal),
        `${inv.gst_percentage || 0}%`,
        formatCurrency(inv.gst_amount),
        formatCurrency(inv.total_amount)
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['#', 'Invoice #', 'Date', 'Customer', 'Subtotal', 'GST %', 'GST Amount', 'Total']],
        body: tableData,
        foot: [['', '', '', '', 'TOTAL', '', formatCurrency(totalGst), formatCurrency(totalAmount)]],
        theme: 'grid',
        headStyles: { fillColor: [23, 23, 23], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [245, 245, 245], textColor: [23, 23, 23], fontStyle: 'bold', fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      addReportFooter(doc);

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

  // Generate Stock Report PDF
  async function generateStockReport(preview = false) {
    if (!user) return;
    setLoading(true);

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`*, categories(name)`)
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      if (!products || products.length === 0) {
        showToast('No products found', 'error');
        setLoading(false);
        return;
      }

      const doc = createReportPDF('STOCK REPORT', settings);

      const tableData = products.map((prod, idx) => [
        idx + 1,
        prod.name || '-',
        prod.categories?.name || '-',
        prod.current_stock || 0,
        prod.min_stock || 0,
        formatCurrency(prod.unit_price),
        formatCurrency((prod.current_stock || 0) * (prod.unit_price || 0))
      ]);

      const totalValue = products.reduce((sum, p) => sum + ((p.current_stock || 0) * (p.unit_price || 0)), 0);

      autoTable(doc, {
        startY: 55,
        head: [['#', 'Product', 'Category', 'Stock', 'Min Stock', 'Unit Price', 'Value']],
        body: tableData,
        foot: [['', '', '', '', '', 'TOTAL VALUE', formatCurrency(totalValue)]],
        theme: 'grid',
        headStyles: { fillColor: [23, 23, 23], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [245, 245, 245], textColor: [23, 23, 23], fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'right' },
          6: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      addReportFooter(doc);

      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        doc.save(`Stock-Report-${new Date().toISOString().split('T')[0]}.pdf`);
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
        <ReportCard
          icon={<TrendingUp className="w-4 h-4" />}
          title="Sale Report"
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

        {/* Purchase Report */}
        <ReportCard
          icon={<TrendingDown className="w-4 h-4" />}
          title="Purchase Report"
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

        {/* Customer Ledger Report */}
        <div className="relative z-30">
          <ReportCard
            icon={<Users className="w-4 h-4" />}
            title="Customer Ledger Report"
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

              <div className="min-w-[200px] relative z-50">
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
          "bg-white/80 backdrop-blur-xl rounded-xl",
          "border border-neutral-200/60",
          "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
          "p-4 opacity-50"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900">Sale Tax Invoices Report</h3>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                    "bg-amber-100 text-amber-700 border border-amber-200"
                  )}>
                    <Clock className="w-3 h-3" />
                    PENDING
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500">This report is coming soon</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button disabled className="px-3 py-1.5 text-xs font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed">
                <Eye className="w-4 h-4" />
              </button>
              <button disabled className="px-3 py-1.5 text-xs font-medium text-neutral-400 bg-neutral-100 rounded-lg cursor-not-allowed">
                <FileDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* GST Report */}
        <ReportCard
          icon={<FileText className="w-4 h-4" />}
          title="GST Report"
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

        {/* Stock Report */}
        <ReportCard
          icon={<Package className="w-4 h-4" />}
          title="Stock Report"
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
    </DashboardLayout>
  );
}

// Report Card Component
function ReportCard({ icon, title, children, loading, onView, onDownload }) {
  return (
    <div className={cn(
      "bg-white/80 backdrop-blur-xl rounded-xl",
      "border border-neutral-200/60",
      "shadow-[0_2px_10px_rgba(0,0,0,0.03)]",
      "p-4"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            disabled={loading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={onDownload}
            disabled={loading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              "bg-neutral-900 text-white hover:bg-neutral-800",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <FileDown className="w-4 h-4" />
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
