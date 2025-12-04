'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Building2, Loader2 } from 'lucide-react';
import { sendSalesInvoiceWhatsApp, generateInvoicePDFBase64, isWhatsAppAvailable } from '@/lib/whatsapp';
import toast from 'react-hot-toast';

// Constants
const ITEMS_PER_PAGE = 9;
const STORAGE_KEY = 'company_settings_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Number to words converter
function numberToWords(num) {
  if (num === 0) return 'ZERO ONLY';

  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION'];

  function convertHundreds(n) {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' HUNDRED ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  }

  let result = '';
  let scaleIndex = 0;
  const intPart = Math.floor(num);

  let remaining = intPart;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      result = convertHundreds(chunk) + scales[scaleIndex] + ' ' + result;
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  return result.trim() + ' ONLY';
}

function SaleInvoiceContent() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('id');

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const printRef = useRef(null);

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  useEffect(() => {
    loadSettings();
    if (invoiceId) {
      fetchInvoiceDetails();
    } else {
      setLoading(false);
    }
  }, [invoiceId]);

  // Load settings from localStorage or fetch from DB
  async function loadSettings() {
    try {
      // Check localStorage first
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setSettings(data);
          return;
        }
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (!error && data) {
        setSettings(data);
        // Cache in localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function fetchInvoiceDetails() {
    setLoading(true);
    try {
      const [invoiceRes, itemsRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('*, customers(customer_name, mobile_no, address, ntn, str)')
          .eq('id', invoiceId)
          .single(),
        supabase
          .from('sales_invoice_items')
          .select('*, products(categories(name))')
          .eq('invoice_id', invoiceId)
          .order('id', { ascending: true })
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      setInvoice(invoiceRes.data);
      setItems(itemsRes.data || []);
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = async () => {
    if (!invoice) return;

    // Check if running in Electron with WhatsApp support
    if (!isWhatsAppAvailable()) {
      // Fallback to wa.me link for browser
      const message = `Invoice #${invoice.invoice_no}\nAmount: Rs. ${formatCurrency(invoice.total_amount)}\nDate: ${formatDate(invoice.invoice_date)}`;
      const phone = invoice.customers?.mobile_no?.replace(/\D/g, '') || '';
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      return;
    }

    if (!invoice.customers?.mobile_no) {
      toast.error('Customer does not have a phone number', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSendingWhatsApp(true);

    try {
      // Format items for PDF generation
      const formattedItems = items.map(item => ({
        ...item,
        product_name: item.product_name || 'Unknown Product'
      }));

      // Generate PDF as base64 if attachment is enabled
      let pdfBase64 = null;
      if (settings?.whatsapp_attach_invoice_image !== false) {
        pdfBase64 = await generateInvoicePDFBase64(invoice, formattedItems, settings);
      }

      // Send via WhatsApp
      await sendSalesInvoiceWhatsApp({
        invoice,
        items: formattedItems,
        settings,
        pdfBase64,
        onSuccess: () => {
          toast.success('Invoice sent via WhatsApp!', {
            duration: 2000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
        },
        onError: (error) => {
          toast.error(error, {
            duration: 3000,
            style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
          });
        },
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Error sending via WhatsApp: ' + error.message, {
        duration: 3000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleEmail = () => {
    if (!invoice) return;
    const subject = `Invoice #${invoice.invoice_no} - ${settings?.company_name || 'Invoice'}`;
    const body = `Dear ${invoice.customers?.customer_name || 'Customer'},\n\nPlease find attached Invoice #${invoice.invoice_no}\n\nAmount: Rs. ${formatCurrency(invoice.total_amount)}\nDate: ${formatDate(invoice.invoice_date)}\n\nThank you for your business.\n\nRegards,\n${settings?.company_name || 'Company'}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalQty = 0;
    let totalTax = 0;
    let totalAmount = 0;

    items.forEach(item => {
      const qty = item.quantity || 0;
      const price = item.unit_price || 0;
      const taxPercent = invoice?.gst_percentage || 0;
      const taxAmount = (price * qty * taxPercent) / 100;
      const amount = (price * qty) + taxAmount;

      totalQty += qty;
      totalTax += taxAmount;
      totalAmount += amount;
    });

    return { totalQty, totalTax, totalAmount };
  };

  const totals = calculateTotals();

  if (!invoiceId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={cn(
          "bg-white/80 backdrop-blur-xl rounded-2xl p-12",
          "border border-neutral-200/60",
          "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
          "text-center max-w-md"
        )}>
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-neutral-400" />
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight mb-2">
            No Invoice Selected
          </h1>
          <p className="text-sm text-neutral-500">
            Please select an invoice from the Invoice History page to view it here.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 10mm;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* Action Buttons Bar - Matching your image exactly */}
        <div className="no-print flex items-center justify-center mb-0 bg-neutral-700 overflow-hidden">
          <button
            onClick={handleWhatsApp}
            disabled={sendingWhatsApp}
            className={cn(
              "flex-1 px-4 py-2.5 text-white text-[11px] font-medium border-r border-neutral-500 transition-colors uppercase tracking-wide flex items-center justify-center gap-2",
              sendingWhatsApp ? "bg-green-600" : "hover:bg-neutral-600"
            )}
          >
            {sendingWhatsApp ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Sending...
              </>
            ) : (
              'Whatsapp'
            )}
          </button>
          <button
            onClick={handleEmail}
            className="flex-1 px-4 py-2.5 text-white text-[11px] font-medium hover:bg-neutral-600 border-r border-neutral-500 transition-colors uppercase tracking-wide"
          >
            Email PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-2.5 text-white text-[11px] font-medium hover:bg-neutral-600 border-r border-neutral-500 transition-colors uppercase tracking-wide"
          >
            Print
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-2.5 text-white text-[11px] font-medium hover:bg-neutral-600 border-r border-neutral-500 transition-colors uppercase tracking-wide"
          >
            Save PDF
          </button>
          <button
            className="flex-1 px-4 py-2.5 text-white text-[11px] font-medium hover:bg-neutral-600 transition-colors uppercase tracking-wide"
          >
            Save Excel File
          </button>
        </div>

        {/* Invoice Content - Exact match to your image */}
        <div ref={printRef} className="print-area bg-white border border-neutral-300 p-6" style={{ fontFamily: 'Arial, sans-serif' }}>

          {/* Company Header */}
          <div className="flex items-start justify-between mb-3">
            {/* Logo */}
            <div className="flex-shrink-0 w-20">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <div className="w-16 h-16 border border-neutral-300 flex items-center justify-center text-[10px] text-neutral-400">
                  LOGO
                </div>
              )}
            </div>

            {/* Company Info - Center */}
            <div className="text-center flex-1 px-4">
              <h1 className="text-lg font-bold text-black tracking-wide">
                {settings?.company_name || 'COMPANY NAME'}
              </h1>
              <p className="text-[11px] text-neutral-700">
                {settings?.company_address}{settings?.contact_detail_1 && `. Contact # ${settings.contact_detail_1}`}{settings?.contact_detail_2 && `, ${settings.contact_detail_2}`}
              </p>
              <p className="text-[11px] text-neutral-700">
                {settings?.ntn && `NTN # ${settings.ntn}`}{settings?.str && `   STR # ${settings.str}`}
              </p>
            </div>

            {/* QR Code */}
            <div className="flex-shrink-0 w-20 flex justify-end">
              {settings?.qr_code_url ? (
                <img src={settings.qr_code_url} alt="QR Code" className="w-16 h-16" />
              ) : (
                <div className="w-16 h-16 border border-neutral-300 flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-0.5 p-1">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sale Invoice Title with lines */}
          <div className="flex items-center my-3">
            <div className="flex-1 h-px bg-neutral-400" />
            <h2 className="px-6 text-base font-semibold text-neutral-800 tracking-wider">
              SALE INVOICE
            </h2>
            <div className="flex-1 h-px bg-neutral-400" />
          </div>

          {/* Bill To and Invoice Details */}
          <div className="flex justify-between mb-3">
            {/* Bill To - Left */}
            <div className="text-[11px]">
              <p className="text-neutral-600">BILL TO,</p>
              <p className="font-bold text-black text-[12px]">
                {invoice?.customers?.customer_name?.toUpperCase() || 'CUSTOMER NAME'}
              </p>
              {invoice?.customers?.address && (
                <p className="text-neutral-700">{invoice.customers.address}</p>
              )}
              {invoice?.customers?.mobile_no && (
                <p className="text-neutral-700">Call. {invoice.customers.mobile_no}</p>
              )}
              {(invoice?.customers?.ntn || invoice?.customers?.str) && (
                <p className="text-neutral-700">
                  {invoice.customers?.ntn && `NTN # ${invoice.customers.ntn}`}
                  {invoice.customers?.str && `   STR # ${invoice.customers.str}`}
                </p>
              )}
            </div>

            {/* Invoice Details - Right */}
            <div className="text-right text-[11px]">
              <p className="font-bold text-black">{invoice?.invoice_no}</p>
              {invoice?.customer_po && (
                <p className="text-neutral-700">Custome PO # {invoice.customer_po}</p>
              )}
              <p className="text-neutral-700">PO Date: {formatDate(invoice?.po_date || invoice?.invoice_date)}</p>
              <p className="text-neutral-700">
                Payment Mode: {invoice?.payment_mode?.toUpperCase() || 'CREDIT'}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse text-[11px] mb-2">
            <thead>
              <tr className="border-t-2 border-b border-black">
                <th className="py-1.5 px-1 text-left font-bold text-black w-8">S.N</th>
                <th className="py-1.5 px-1 text-left font-bold text-black">Item Name</th>
                <th className="py-1.5 px-1 text-center font-bold text-black w-14">Qty</th>
                <th className="py-1.5 px-1 text-center font-bold text-black w-12">Unit</th>
                <th className="py-1.5 px-1 text-center font-bold text-black w-12">Price</th>
                <th className="py-1.5 px-1 text-center font-bold text-black w-16">Tax</th>
                <th className="py-1.5 px-1 text-right font-bold text-black w-20">Amount</th>
              </tr>
            </thead>
            <tbody>
              {getCurrentPageItems().map((item, index) => {
                const qty = item.quantity || 0;
                const price = item.unit_price || 0;
                const taxPercent = invoice?.gst_percentage || 0;
                const taxAmount = (price * qty * taxPercent) / 100;
                const amount = (price * qty) + taxAmount;
                const serialNum = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

                return (
                  <tr key={item.id} className="border-b border-neutral-200">
                    <td className="py-1.5 px-1 text-neutral-700">{serialNum}</td>
                    <td className="py-1.5 px-1">
                      <div className="font-medium text-black">{item.product_name}</div>
                      {item.description && (
                        <div className="text-neutral-500 text-[9px]">({item.description})</div>
                      )}
                    </td>
                    <td className="py-1.5 px-1 text-center text-neutral-700">{qty}</td>
                    <td className="py-1.5 px-1 text-center text-neutral-700">{item.unit || 'PCS'}</td>
                    <td className="py-1.5 px-1 text-center text-neutral-700">{price.toFixed(2)}</td>
                    <td className="py-1.5 px-1 text-center">
                      <div className="text-neutral-700">{taxAmount.toFixed(0)}</div>
                      <div className="text-neutral-500 text-[9px]">({taxPercent}%)</div>
                    </td>
                    <td className="py-1.5 px-1 text-right text-neutral-900">{formatCurrency(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* TOTAL Row */}
          <table className="w-full border-collapse text-[11px] mb-3">
            <tbody>
              <tr className="border-t-2 border-b-2 border-black bg-neutral-50">
                <td className="py-1.5 px-1 font-bold text-black w-8">TOTAL</td>
                <td className="py-1.5 px-1"></td>
                <td className="py-1.5 px-1 text-center font-bold text-black w-14">{totals.totalQty}</td>
                <td className="py-1.5 px-1 w-12"></td>
                <td className="py-1.5 px-1 w-12"></td>
                <td className="py-1.5 px-1 text-center font-bold text-black w-16">{formatCurrency(totals.totalTax)}</td>
                <td className="py-1.5 px-1 text-right font-bold text-black w-20">{formatCurrency(totals.totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Invoice Amount in Words */}
          <div className="mb-4 text-[10px]">
            <span className="font-bold text-black">INVOICE AMOUNT IN WORDS</span>
            <span className="ml-2 text-neutral-700 italic">{numberToWords(Math.round(totals.totalAmount))}</span>
          </div>

          {/* Bottom Section - Summary and Signature */}
          <div className="flex justify-between items-end mt-4">
            {/* Left - Amount Summary */}
            <div className="text-[10px]">
              <table className="border-collapse">
                <tbody>
                  <tr>
                    <td className="pr-4 py-0.5 text-neutral-600">INV. AMOUNT</td>
                    <td className="pr-4 py-0.5 text-neutral-600">TAXABLE AMOUNT</td>
                    <td className="pr-4 py-0.5 text-neutral-600">RATE</td>
                    <td className="pr-4 py-0.5 text-neutral-600">TAX AMOUNT</td>
                    <td className="pr-4 py-0.5 text-neutral-600">PREVIOUS BALANCE</td>
                    <td className="py-0.5 text-neutral-600">TOTAL BALANCE</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-0.5 font-medium text-black">{formatCurrency(totals.totalAmount)}</td>
                    <td className="pr-4 py-0.5 font-medium text-black">{formatCurrency(invoice?.subtotal || (totals.totalAmount - totals.totalTax))}</td>
                    <td className="pr-4 py-0.5 font-medium text-black">{invoice?.gst_percentage || 0}%</td>
                    <td className="pr-4 py-0.5 font-medium text-black">{formatCurrency(totals.totalTax)}</td>
                    <td className="pr-4 py-0.5 font-medium text-black">{formatCurrency(invoice?.previous_balance || 0)}</td>
                    <td className="py-0.5 font-medium text-black">{formatCurrency(invoice?.final_balance || totals.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature Section */}
          <div className="flex justify-end mt-8">
            <div className="text-center">
              <p className="text-[11px] text-neutral-700 mb-6">For, {settings?.company_name || 'COMPANY NAME'}</p>
              {settings?.signature_url && (
                <img src={settings.signature_url} alt="Signature" className="h-10 mx-auto mb-1" />
              )}
              <div className="w-40 border-t border-neutral-400 mx-auto"></div>
              <p className="text-[10px] text-neutral-600 mt-1">Authorized Authority</p>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center mt-4 pt-2 border-t border-neutral-200">
              <span className="text-[11px] text-neutral-600">
                page {currentPage} of {totalPages}
              </span>
            </div>
          )}

          {/* Page Navigation (no-print) */}
          {totalPages > 1 && (
            <div className="no-print flex items-center justify-center gap-4 mt-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function SaleInvoicePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full" />
        </div>
      }>
        <SaleInvoiceContent />
      </Suspense>
    </DashboardLayout>
  );
}
