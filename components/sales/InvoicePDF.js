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

  // Load images (QR code removed from sale invoices - only used in sale orders)
  const images = {};
  if (showLogo && settings?.logo_url) {
    images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
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
  startY: y,
  head: [['S.N', 'Item Name', 'Qty', 'Unit', 'Price', 'Tax', 'Amount']],
  body: simpleTableBody,
  foot: [['TOTAL', '', String(totalQty), '', '', formatCurrency(totalTax), formatCurrency(totalAmount)]],
  theme: 'plain',
  headStyles: {
    fillColor: [255, 255, 255],
    textColor: [0, 0, 0],
    fontStyle: 'bold',
    fontSize: 10,
    halign: 'center',
    valign: 'middle',
    lineWidth: 0,
    cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
  },
  bodyStyles: {
    fontSize: 10,
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
    fontSize: 10,
    halign: 'center',
    valign: 'middle',
    lineWidth: 0,
    cellPadding: { top: 5, right: 0.75, bottom: 3, left: 0.75 },
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
willDrawPage: function(data) {
  if (data.pageNumber > 1) {
    // Draw continuation header text at top of page 2+
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Sale Order # ${order.order_no || order.invoice_no || '-'}`, margin, 12);
    doc.text(`Customer PO # ${order.customer_po || '-'}`, pageWidth - margin, 12, { align: 'right' });
    
    // Set table start position below the continuation header
    data.settings.startY = 32;
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
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    
    // Draw outer rectangle
    doc.rect(startX, startY, tableWidth, borderHeight);
    
    // Draw vertical separators between columns
    let currentX = startX;
    const cells = headerRow.cells;
    Object.keys(cells).forEach((key, i) => {
      if (i < Object.keys(cells).length - 1) {
        currentX += cells[key].width;
        doc.line(currentX, startY, currentX, startY + borderHeight);
      }
    });
  }
  
  // Draw border around footer row with column separators
  const footerRow = data.table.foot[0];
  if (footerRow && footerRow.cells[0]) {
    const startX = footerRow.cells[0].x;
    const startY = footerRow.cells[0].y;
    const tableWidth = 195;
    const footerHeight = footerRow.height;
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    
    // Draw outer rectangle
    doc.rect(startX, startY, tableWidth, footerHeight);
    
    // Draw vertical separators between columns
    let currentX = startX;
    const cells = footerRow.cells;
    Object.keys(cells).forEach((key, i) => {
      if (i < Object.keys(cells).length - 1) {
        currentX += cells[key].width;
        doc.line(currentX, startY, currentX, startY + footerHeight);
      }
    });
  }
},
  didDrawCell: function(data) {
    // Custom rendering for Item Name column (column 1) in body
    if (data.section === 'body' && data.column.index === 1) {
      const itemData = itemsData[data.row.index];
      if (itemData) {
        const cellCenterX = data.cell.x + data.cell.width / 2;
        const topY = data.cell.y + 6;
        const bottomY = data.cell.y + 11;

        // Draw product name on top line - BLACK
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(itemData.productName, cellCenterX, topY, { align: 'center' });
        
        // Draw category on bottom line - BLACK
        if (itemData.category) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`(${itemData.category})`, cellCenterX, bottomY, { align: 'center' });
        }
      }
    }
     if (data.section === 'foot' && data.row.index === 0 && data.column.index === 0) {
    data.cell.y += 2;  // Shift footer down by 2px
  }
    // Custom rendering for Tax column (column 5) in body
    if (data.section === 'body' && data.column.index === 5) {
      const itemData = itemsData[data.row.index];
      if (itemData) {
        const cellCenterX = data.cell.x + data.cell.width / 2;
        const topY = data.cell.y + 6;
        const bottomY = data.cell.y + 11;

        // Draw tax amount on top line - BLACK
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(formatCurrency(itemData.taxAmt), cellCenterX, topY, { align: 'center' });

        // Draw tax percentage on bottom line - BLACK
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`(${itemData.taxPercent}%)`, cellCenterX, bottomY, { align: 'center' });
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
      window.open(pdfUrl, '_blank');
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
  let totalNetWeight = 0;
  const itemsData = items.map((item, idx) => {
    const qty = item.quantity || 0;
    const price = item.unit_price || 0;
    const weight = item.weight || 0;
    const netWeight = qty * weight;
    const taxPercent = order.gst_percentage || 0;
    const taxAmt = (price * qty * taxPercent) / 100;
    const amount = (price * qty) + taxAmt;
    totalQty += qty;
    totalTax += taxAmt;
    totalAmount += amount;
    totalNetWeight += netWeight;
    const category = getCategory(item);
    return {
      idx: idx + 1,
      productName: item.product_name,
      category: category,
      qty: qty,
      weight: weight,
      netWeight: netWeight,
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

  // Table body data
  const simpleTableBody = itemsData.map((item) => [
    String(item.idx),
    '',
    String(item.qty),
    item.weight.toFixed(2),
    item.netWeight.toFixed(2),
    item.unit,
    item.price.toFixed(2),
    '',
    formatCurrency(item.amount)
  ]);

autoTable(doc, {
    startY: y,
    head: [['S.N', 'Item Name', 'Qty', 'Weight', 'Net Wt.', 'Unit', 'Price', 'Tax', 'Amount']],
    body: simpleTableBody,
    foot: [['TOTAL', '', String(totalQty), '', totalNetWeight.toFixed(2), '', '', formatCurrency(totalTax), formatCurrency(totalAmount)]],
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0,
      cellPadding: { top: 3, right: 0.75, bottom: 6, left: 0.75 },
    },
    bodyStyles: {
      fontSize: 10,
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
  fontSize: 10,
  halign: 'center',
  valign: 'middle',
  lineWidth: 0,
cellPadding: { top:6, right: 0.75, bottom: 1, left: 0.75 },
},
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 42 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 20 },
      8: { halign: 'center', cellWidth: 23 },
    },
    tableWidth: 195,
    styles: { overflow: 'linebreak', cellPadding: 1.5 },
    margin: { left: (pageWidth - 195) / 2, right: (pageWidth - 195) / 2 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
willDrawPage: function (data) {
  if (data.pageNumber > 1) {
    const topY = 10;           // Moves it very close to the top
    const lineY = topY + 6;    // Line just below the text

    // Continuation header – clean, non-bold, full width
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');  // ← NOT bold
    doc.setTextColor(80, 80, 80);        // Subtle gray (professional look)

    // Left: Sale Order #
    doc.text(
      `${order.order_no || order.invoice_no || 'N/A'}`,
      margin,
      topY
    );

    // Right: Customer PO #
    doc.text(
      `Customer PO # ${order.customer_po || '-'}`,
      pageWidth - margin,
      topY,
      { align: 'right' }
    );

    // Light separator line (very subtle)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, lineY, pageWidth - margin, lineY);

    // Give table enough space to start cleanly below
    data.settings.startY = lineY + 8;  // Starts table at ~24mm — perfect spacing
  }
},
didDrawPage: function(data) {
  const currentPage = data.pageNumber;
  
  // Draw border around header row with column separators
  const headerRow = data.table.head[0];
  if (headerRow && headerRow.cells[0]) {
    const startX = headerRow.cells[0].x;
    const startY = headerRow.cells[0].y;
    const tableWidth = 195;
    const borderHeight = headerRow.height - 3;
    
    // Page 1: header starts around y=84, Page 2+: header starts around y=38
    // Skip ghost headers that appear at y < 10
    if (startY >= 10) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      
      // Draw outer rectangle
      doc.rect(startX, startY, tableWidth, borderHeight);
      
      // Draw vertical separators between columns
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
  
  // Draw border around footer row WITHOUT vertical separators
  const footerRow = data.table.foot[0];
  if (footerRow && footerRow.cells[0]) {
    const startX = footerRow.cells[0].x;
    const startY = footerRow.cells[0].y;
    const tableWidth = 195;
    const footerHeight = footerRow.height;
    
    if (startY >= 10) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      
      // ← CHANGED: Draw ONLY horizontal lines (top and bottom)
      // Top horizontal line
      doc.line(startX, startY, startX + tableWidth, startY);
      
      // Bottom horizontal line
      doc.line(startX, startY + footerHeight, startX + tableWidth, startY + footerHeight);
      
      // ← REMOVED: No vertical column separators in footer
    }
  }
},

    didDrawCell: function(data) {
      // Custom rendering for Item Name column (column 1) in body
      if (data.section === 'body' && data.column.index === 1) {
        const itemData = itemsData[data.row.index];
        if (itemData) {
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const topY = data.cell.y + 6;
          const bottomY = data.cell.y + 11;

          // Draw product name - BLACK
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(itemData.productName, cellCenterX, topY, { align: 'center' });

          // Draw category - BLACK
          if (itemData.category) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(`(${itemData.category})`, cellCenterX, bottomY, { align: 'center' });
          }
        }
      }

      // Custom rendering for Tax column (column 7) in body
      if (data.section === 'body' && data.column.index === 7) {
        const itemData = itemsData[data.row.index];
        if (itemData) {
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const topY = data.cell.y + 6;
          const bottomY = data.cell.y + 11;

          // Draw tax amount - BLACK
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(formatCurrency(itemData.taxAmt), cellCenterX, topY, { align: 'center' });

          // Draw tax percentage - BLACK
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`(${itemData.taxPercent}%)`, cellCenterX, bottomY, { align: 'center' });
        }
      }
      if (data.section === 'foot' && data.row.index === 0) {
    data.cell.y += 3;  // Shift ENTIRE footer row down (all columns)
}
    },
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // Check if we need a new page for footer
  if (finalY > pageHeight - 70) {
    doc.addPage();
    finalY = 20;
  }
// Amount in words - aligned with TOTAL (no shift)
const tableStartX = (pageWidth - 195) / 2;  // Same as TOTAL alignment
doc.setFontSize(8);
doc.setFont('helvetica', 'bold');
doc.setTextColor(0, 0, 0);
doc.text('ORDER AMOUNT IN WORDS', tableStartX, finalY);

// Amount text on same line, unbold
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
const labelWidth = doc.getTextWidth('ORDER AMOUNT IN WORDS');
doc.text(numberToWords(Math.round(totalAmount)).toUpperCase(), tableStartX + labelWidth + 5, finalY);

// Draw line below spanning table width
finalY += 2;
doc.setDrawColor(0, 0, 0);
doc.setLineWidth(0.3);
const tableEndX = tableStartX + 195;
doc.line(tableStartX, finalY, tableEndX, finalY);

finalY += 10;

  // Summary
  const summaryLabels = ['ORDER AMOUNT', 'TAXABLE AMOUNT', 'RATE', 'TAX AMOUNT', 'NET WEIGHT'];
  const taxableAmount = totalAmount - totalTax;
  const summaryValues = [formatCurrency(totalAmount), formatCurrency(taxableAmount), `${order.gst_percentage || 0}%`, formatCurrency(totalTax), `${totalNetWeight.toFixed(2)} kg`];
  const summaryColors = [[0,0,0], [0,123,255], [0,0,0], [220,53,69], [180,130,0]];
  const colW = (pageWidth - margin * 2) / 5;

  doc.setFontSize(9);
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
  doc.setFontSize(11);
  summaryValues.forEach((val, i) => {
    const x = margin + (i * colW) + (colW / 2);
    doc.setTextColor(...summaryColors[i]);
    doc.text(val, x, finalY, { align: 'center' });
  });

// Signature - positioned at bottom with space for page number
const sigY = pageHeight - 60;  // Changed from 45 to 60 for more clearance
doc.setFontSize(10);
doc.setFont('helvetica', 'normal');
doc.setTextColor(0, 0, 0);
doc.text(`For, ${settings?.company_name || 'COMPANY'}`, pageWidth - margin, sigY, { align: 'right' });
if (images.signature) try { doc.addImage(images.signature, 'PNG', pageWidth - margin - 45, sigY + 4, 42, 16); } catch (e) { }
doc.setDrawColor(128, 128, 128);
doc.setLineWidth(0.3);
doc.line(pageWidth - margin - 50, sigY + 24, pageWidth - margin, sigY + 24);
doc.setFontSize(9);
doc.setTextColor(128, 128, 128);
doc.text('Authorized Authority', pageWidth - margin - 25, sigY + 30, { align: 'center' });  // ===== PAGE NUMBERS WITH LINE ABOVE =====
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Draw horizontal line above page number
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    
    // Draw page number
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  return doc;
}
export async function downloadSaleOrderPDF(order, items, settings, options = {}, shouldPrint = false) {
  try {
    const doc = await generateSaleOrderPDF(order, items, settings, options);
    if (shouldPrint) {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } else {
      doc.save(`SaleOrder-${order.order_no || order.invoice_no}.pdf`);
    }
  } catch (error) {
    console.error('Error generating Sale Order PDF:', error);
    throw new Error('Failed to generate Sale Order PDF: ' + error.message);
  }
}
