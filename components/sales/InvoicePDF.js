/**
 * Invoice PDF Generation Utility
 * Clean design matching reference screenshots
 */

'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper: Load image as base64
async function getImageAsBase64(url, maxWidth = 150, quality = 0.8) {
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
}

// Helper: Number to words
function numberToWords(num) {
  if (num === 0) return 'ZERO ONLY';
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION'];

  function convertHundreds(n) {
    let result = '';
    if (n >= 100) { result += ones[Math.floor(n / 100)] + ' HUNDRED '; n %= 100; }
    if (n >= 20) { result += tens[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) { result += ones[n] + ' '; }
    return result;
  }

  let result = '';
  let scaleIndex = 0;
  let remaining = Math.floor(num);
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) result = convertHundreds(chunk) + scales[scaleIndex] + ' ' + result;
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }
  return result.trim() + ' ONLY';
}

// Helper: Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
}

// Helper: Format date
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

/**
 * Generate Invoice PDF
 */
export async function generateInvoicePDF(invoice, items, settings, options = {}) {
  const { showLogo = true } = options;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Load images
  const images = {};
  if (showLogo && settings?.logo_url) {
    images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
  }
  if (settings?.qr_code_url) {
    images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);
  }
  if (settings?.signature_url) {
    images.signature = await getImageAsBase64(settings.signature_url, 150, 0.9);
  }

  // Calculate totals
  let totalQty = 0, totalTax = 0, totalAmount = 0;

  const getCategory = (item) => item.category || item.products?.categories?.name || '';

  // Store item data for custom rendering
  const itemsData = items.map((item, idx) => {
    const qty = item.quantity || 0;
    const price = item.unit_price || 0;
    const taxPercent = invoice.gst_percentage || 0;
    const taxAmt = (price * qty * taxPercent) / 100;
    const amount = (price * qty) + taxAmt;

    totalQty += qty;
    totalTax += taxAmt;
    totalAmount += amount;

    const category = getCategory(item);
    return {
      idx: idx + 1,
      productName: item.product_name,
      category: category,
      qty: qty,
      unit: item.unit || 'PCS',
      price: price,
      taxAmt: taxAmt,
      taxPercent: taxPercent,
      amount: amount
    };
  });

  // Empty cells for custom drawn columns
  const tableBody = itemsData.map((item) => [
    String(item.idx),
    '', // Empty - will be custom drawn
    String(item.qty),
    item.unit,
    item.price.toFixed(2),
    '', // Empty - will be custom drawn
    formatCurrency(item.amount)
  ]);

  let totalPages = 1;

  // ===== DRAW FIRST PAGE HEADER =====
  function drawHeader() {
    let y = 14;
    const centerX = pageWidth / 2;

    // Logo
    if (images.logo) {
      try { doc.addImage(images.logo, 'JPEG', margin, y, 24, 24); } catch (e) { }
    }

    // Company name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(settings?.company_name || 'COMPANY NAME', centerX, y + 8, { align: 'center' });

    // Contact
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const contact = [settings?.company_address, settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null, settings?.contact_detail_2].filter(Boolean).join('. ');
    doc.text(contact, centerX, y + 15, { align: 'center' });

    // NTN/STR
    const tax = [settings?.ntn ? `NTN # ${settings.ntn}` : null, settings?.str ? `STR # ${settings.str}` : null].filter(Boolean).join('   ');
    if (tax) doc.text(tax, centerX, y + 21, { align: 'center' });

    // QR
    if (images.qr) {
      try { doc.addImage(images.qr, 'JPEG', pageWidth - margin - 24, y, 24, 24); } catch (e) { }
    }

    y += 30;

    // Title lines
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(centerX - 30, y, centerX + 30, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SALE INVOICE', centerX, y, { align: 'center' });
    y += 3;
    doc.line(centerX - 26, y, centerX + 26, y);
    y += 8;

    // Bill To
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('BILL TO,', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text((invoice.customers?.customer_name || 'CUSTOMER').toUpperCase(), margin, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    let billY = y + 10;
    if (invoice.customers?.address) { doc.text(invoice.customers.address, margin, billY); billY += 4; }
    if (invoice.customers?.mobile_no) { doc.text(`Call. ${invoice.customers.mobile_no}`, margin, billY); billY += 4; }
    const custTax = [invoice.customers?.ntn ? `NTN # ${invoice.customers.ntn}` : null, invoice.customers?.str ? `STR # ${invoice.customers.str}` : null].filter(Boolean).join('   ');
    if (custTax) doc.text(custTax, margin, billY);

    // Invoice details (right)
    const rightX = pageWidth - margin;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${invoice.invoice_no || '-'}`, rightX, y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    let invY = y + 5;
    if (invoice.customer_po) { doc.text(`Custome PO # ${invoice.customer_po}`, rightX, invY, { align: 'right' }); invY += 4; }
    doc.text(`PO Date: ${formatDate(invoice.po_date || invoice.invoice_date)}`, rightX, invY, { align: 'right' });
    invY += 4;
    doc.text(`Payment Mode: ${(invoice.payment_mode || 'CREDIT').toUpperCase()}`, rightX, invY, { align: 'right' });

    return y + 24;
  }

  // Draw page 2+ header
  function drawContinuationHeader() {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${invoice.invoice_no || '-'}`, margin, 14);
    if (invoice.customer_po) {
      doc.text(`Custome PO # ${invoice.customer_po}`, pageWidth - margin, 14, { align: 'right' });
    }
    return 22;
  }

  const tableStartY = drawHeader();

  // ===== TABLE =====
  autoTable(doc, {
    startY: tableStartY,
    head: [['S.N', 'Item Name', 'Qty', 'Unit', 'Price', 'Tax', 'Amount']],
    body: tableBody,
    foot: [['TOTAL', '', String(totalQty), '', '', formatCurrency(totalTax), formatCurrency(totalAmount)]],
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle',
      lineWidth: 0,
      lineColor: [255, 255, 255],
      minCellHeight: 11,
      cellPadding: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 },
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 52 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 25 },
      6: { halign: 'center', cellWidth: 28 },
    },
    tableWidth: 195,
    styles: {
      overflow: 'linebreak',
      cellPadding: 1.5,
      font: 'helvetica',
    },
    margin: { left: (pageWidth - 195) / 2, right: (pageWidth - 195) / 2 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    willDrawPage: function(data) {
      if (data.pageNumber > 1) {
        data.settings.startY = drawContinuationHeader();
      }
    },
    willDrawCell: function(data) {
      // Add extra top padding to first body row
      if (data.section === 'body' && data.row.index === 0) {
        data.cell.styles.cellPadding = { top: 4.5, right: 0.75, bottom: 0.75, left: 0.75 };
      }
    },
    didDrawCell: function(data) {
      // Custom rendering for Item Name column (column 1) in body
      if (data.section === 'body' && data.column.index === 1) {
        const itemData = itemsData[data.row.index];
        if (itemData) {
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const cellCenterY = data.cell.y + data.cell.height / 2;

          if (itemData.category) {
            // Draw product name (normal font, NOT bold, larger size)
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(itemData.productName, cellCenterX, cellCenterY - 2, { align: 'center' });
            // Draw category (MUCH smaller font, black color, in brackets)
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(`(${itemData.category})`, cellCenterX, cellCenterY + 2, { align: 'center' });
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(itemData.productName, cellCenterX, cellCenterY, { align: 'center' });
          }
        }
      }
      // Custom rendering for Tax column (column 5) in body
      if (data.section === 'body' && data.column.index === 5) {
        const itemData = itemsData[data.row.index];
        if (itemData) {
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const cellCenterY = data.cell.y + data.cell.height / 2;

          // Draw tax amount (larger font)
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(itemData.taxAmt.toFixed(0), cellCenterX, cellCenterY - 2, { align: 'center' });

          // Draw tax percentage (smaller but VISIBLE font, black)
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(`(${itemData.taxPercent}%)`, cellCenterX, cellCenterY + 2, { align: 'center' });
        }
      }
    },
  });

  totalPages = doc.internal.getNumberOfPages();
  let finalY = doc.lastAutoTable.finalY + 10;

  // Check if need new page for footer
  if (finalY > pageHeight - 80) {
    doc.addPage();
    finalY = 20;
    totalPages = doc.internal.getNumberOfPages();
  }

  // ===== INVOICE AMOUNT IN WORDS =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('INVOICE AMOUNT IN WORDS', margin, finalY);

  finalY += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(numberToWords(Math.round(totalAmount)).toUpperCase(), margin, finalY);

  finalY += 12;

  // ===== SUMMARY =====
  const summaryLabels = ['INV. AMOUNT', 'TAXABLE AMOUNT', 'RATE', 'TAX AMOUNT'];
  const taxableAmount = totalAmount - totalTax;
  const summaryValues = [
    formatCurrency(totalAmount),
    formatCurrency(taxableAmount),
    `${invoice.gst_percentage || 0}%`,
    formatCurrency(totalTax)
  ];
  const summaryColors = [[0,0,0], [0,123,255], [0,0,0], [220,53,69]];

  const colW = (pageWidth - margin * 2) / 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  summaryLabels.forEach((label, i) => {
    const x = margin + (i * colW) + (colW / 2);
    doc.setTextColor(128, 128, 128);
    doc.text(label, x, finalY, { align: 'center' });
    const lw = doc.getTextWidth(label);
    doc.setDrawColor(128, 128, 128);
    doc.setLineWidth(0.2);
    doc.line(x - lw/2, finalY + 1, x + lw/2, finalY + 1);
  });

  finalY += 8;
  doc.setFontSize(9);
  summaryValues.forEach((val, i) => {
    const x = margin + (i * colW) + (colW / 2);
    doc.setTextColor(...summaryColors[i]);
    doc.text(val, x, finalY, { align: 'center' });
  });

  // ===== SIGNATURE =====
  const sigY = pageHeight - 45;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`For, ${settings?.company_name || 'COMPANY'}`, pageWidth - margin, sigY, { align: 'right' });

  if (images.signature) {
    try { doc.addImage(images.signature, 'PNG', pageWidth - margin - 45, sigY + 4, 42, 16); } catch (e) { }
  }

  doc.setDrawColor(128, 128, 128);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 50, sigY + 24, pageWidth - margin, sigY + 24);
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text('Authorized Authority', pageWidth - margin - 25, sigY + 30, { align: 'center' });

  // ===== PAGE NUMBERS =====
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(`page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  return doc;
}

/**
 * Download Invoice PDF
 */
export async function downloadInvoicePDF(invoice, items, settings, options = {}, shouldPrint = false) {
  try {
    const doc = await generateInvoicePDF(invoice, items, settings, options);
    if (shouldPrint) {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) printWindow.onload = () => printWindow.print();
    } else {
      doc.save(`Invoice-${invoice.invoice_no}.pdf`);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

/**
 * Generate Sales Report PDF
 */
export async function generateSalesReportPDF(invoices, totalAmount) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Sales Report', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 28);
  doc.text(`Total Sales: ${invoices.length}`, 14, 34);
  doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, 14, 40);

  autoTable(doc, {
    startY: 46,
    head: [['Invoice #', 'Customer', 'Date', 'Amount']],
    body: invoices.map(inv => [inv.invoice_no || '-', inv.customers?.customer_name || '-', formatDate(inv.invoice_date), formatCurrency(inv.total_amount)]),
    theme: 'striped',
    headStyles: { fillColor: [23, 23, 23] },
  });

  doc.save(`sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Generate Sale Order PDF
 */
export async function generateSaleOrderPDF(order, items, settings, options = {}) {
  const { showLogo = true } = options;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Load images
  const images = {};
  if (showLogo && settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
  if (settings?.qr_code_url) images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);
  if (settings?.signature_url) images.signature = await getImageAsBase64(settings.signature_url, 150, 0.9);

  let totalQty = 0, totalTax = 0, totalAmount = 0;
  const getCategory = (item) => item.category || item.products?.categories?.name || '';

  // Store item data for custom rendering
  const itemsData = items.map((item, idx) => {
    const qty = item.quantity || 0;
    const price = item.unit_price || 0;
    const taxPercent = order.gst_percentage || 0;
    const taxAmt = (price * qty * taxPercent) / 100;
    const amount = (price * qty) + taxAmt;
    totalQty += qty;
    totalTax += taxAmt;
    totalAmount += amount;
    const category = getCategory(item);
    return {
      idx: idx + 1,
      productName: item.product_name,
      category: category,
      qty: qty,
      unit: item.unit || 'PCS',
      price: price,
      taxAmt: taxAmt,
      taxPercent: taxPercent,
      amount: amount
    };
  });

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
  doc.text('SALES ORDER REPORT', centerX, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(0, 0, 0);
  doc.line(centerX - 22, y, centerX + 22, y);
  y += 8;

  // Order To
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('ORDER TO,', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text((order.customers?.customer_name || 'CUSTOMER').toUpperCase(), margin, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  let orderY = y + 10;
  if (order.customers?.address) { doc.text(order.customers.address, margin, orderY); orderY += 4; }
  const custTax = [order.customers?.ntn ? `NTN # ${order.customers.ntn}` : null, order.customers?.str ? `STR # ${order.customers.str}` : null].filter(Boolean).join('   ');
  if (custTax) doc.text(custTax, margin, orderY);

  const rightX = pageWidth - margin;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Sale Order #', rightX, y, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  let invY = y + 5;
  doc.text(order.order_no || order.invoice_no || '-', rightX, invY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  invY += 5;
  doc.text(`Customer PO # ${order.customer_po || '-'}`, rightX, invY, { align: 'right' });
  invY += 4;
  doc.text(`PO Date: ${formatDate(order.order_date || order.invoice_date)}`, rightX, invY, { align: 'right' });
  invY += 4;
  doc.text(`Bill Situation: ${(order.bill_situation || 'Pending').toUpperCase()}`, rightX, invY, { align: 'right' });

  y += 24;

  // Table - use simple format for Item Name column, custom draw for Tax column
  const simpleTableBody = itemsData.map((item) => [
    String(item.idx),
    '', // Empty - will be custom drawn
    String(item.qty),
    item.unit,
    item.price.toFixed(2),
    '', // Empty - will be custom drawn
    formatCurrency(item.amount)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['S.N', 'Item Name', 'Qty', 'Unit', 'Price', 'Tax', 'Amount']],
    body: simpleTableBody,
    foot: [['TOTAL', '', String(totalQty), '', '', formatCurrency(totalTax), formatCurrency(totalAmount)]],
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle',
      lineWidth: 0,
      lineColor: [255, 255, 255],
      minCellHeight: 11,
      cellPadding: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 },
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 52 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 25 },
      6: { halign: 'center', cellWidth: 28 },
    },
    tableWidth: 195,
    styles: { overflow: 'linebreak', cellPadding: 1.5 },
    margin: { left: (pageWidth - 195) / 2, right: (pageWidth - 195) / 2 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    willDrawCell: function(data) {
      // Add extra top padding to first body row
      if (data.section === 'body' && data.row.index === 0) {
        data.cell.styles.cellPadding = { top: 4.5, right: 0.75, bottom: 0.75, left: 0.75 };
      }
    },
    didDrawCell: function(data) {
      // Custom rendering for Item Name column (column 1) in body
      if (data.section === 'body' && data.column.index === 1) {
        const itemData = itemsData[data.row.index];
        if (itemData) {
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const cellCenterY = data.cell.y + data.cell.height / 2;

          if (itemData.category) {
            // Draw product name (normal font, NOT bold, larger size)
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(itemData.productName, cellCenterX, cellCenterY - 2, { align: 'center' });
            // Draw category (MUCH smaller font, black color, in brackets)
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(`(${itemData.category})`, cellCenterX, cellCenterY + 2, { align: 'center' });
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(itemData.productName, cellCenterX, cellCenterY, { align: 'center' });
          }
        }
      }
      // Custom rendering for Tax column (column 5) in body
      if (data.section === 'body' && data.column.index === 5) {
        const itemData = itemsData[data.row.index];
        if (itemData) {
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const cellCenterY = data.cell.y + data.cell.height / 2;

          // Draw tax amount (larger font)
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(itemData.taxAmt.toFixed(0), cellCenterX, cellCenterY - 2, { align: 'center' });

          // Draw tax percentage (smaller but VISIBLE font, black)
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(`(${itemData.taxPercent}%)`, cellCenterX, cellCenterY + 2, { align: 'center' });
        }
      }
    },
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // Check if we need a new page for footer (need ~70mm space)
  if (finalY > pageHeight - 70) {
    doc.addPage();
    finalY = 20;
  }

  // Amount in words - on separate line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('ORDER AMOUNT IN WORDS', margin, finalY);

  finalY += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(numberToWords(Math.round(totalAmount)).toUpperCase(), margin, finalY);

  finalY += 12;

  // Summary
  const summaryLabels = ['ORDER AMOUNT', 'TAXABLE AMOUNT', 'RATE', 'TAX AMOUNT'];
  const taxableAmount = totalAmount - totalTax;
  const summaryValues = [formatCurrency(totalAmount), formatCurrency(taxableAmount), `${order.gst_percentage || 0}%`, formatCurrency(totalTax)];
  const summaryColors = [[0,0,0], [0,123,255], [0,0,0], [220,53,69]];
  const colW = (pageWidth - margin * 2) / 4;

  doc.setFontSize(7);
  summaryLabels.forEach((label, i) => {
    const x = margin + (i * colW) + (colW / 2);
    doc.setTextColor(128, 128, 128);
    doc.text(label, x, finalY, { align: 'center' });
    const lw = doc.getTextWidth(label);
    doc.setDrawColor(128, 128, 128);
    doc.setLineWidth(0.2);
    doc.line(x - lw/2, finalY + 1, x + lw/2, finalY + 1);
  });

  finalY += 8;
  doc.setFontSize(9);
  summaryValues.forEach((val, i) => {
    const x = margin + (i * colW) + (colW / 2);
    doc.setTextColor(...summaryColors[i]);
    doc.text(val, x, finalY, { align: 'center' });
  });

  // Signature - positioned relative to content, not fixed to bottom
  finalY += 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`For, ${settings?.company_name || 'COMPANY'}`, pageWidth - margin, finalY, { align: 'right' });
  if (images.signature) try { doc.addImage(images.signature, 'PNG', pageWidth - margin - 45, finalY + 4, 42, 16); } catch (e) { }
  doc.setDrawColor(128, 128, 128);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 50, finalY + 24, pageWidth - margin, finalY + 24);
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text('Authorized Authority', pageWidth - margin - 25, finalY + 30, { align: 'center' });

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(`page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  return doc;
}

/**
 * Download Sale Order PDF
 */
export async function downloadSaleOrderPDF(order, items, settings, options = {}, shouldPrint = false) {
  try {
    const doc = await generateSaleOrderPDF(order, items, settings, options);
    if (shouldPrint) {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) printWindow.onload = () => printWindow.print();
    } else {
      doc.save(`SaleOrder-${order.order_no || order.invoice_no}.pdf`);
    }
  } catch (error) {
    console.error('Error generating Sale Order PDF:', error);
    throw new Error('Failed to generate Sale Order PDF: ' + error.message);
  }
}
