/**
 * Payment Invoice PDF Generation Utility
 * Clean design matching sales invoice design
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

// Helper: Format payment method
function formatPaymentMethod(method) {
  const methods = {
    'cash': 'CASH',
    'bank_transfer': 'BANK TRANSFER',
    'online': 'ONLINE PAYMENT'
  };
  return methods[method] || (method || 'CASH').toUpperCase();
}

/**
 * Generate Payment In Invoice PDF
 */
export async function generatePaymentInInvoicePDF(payment, customer, settings, options = {}) {
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
  if (settings?.signature_url) {
    images.signature = await getImageAsBase64(settings.signature_url, 150, 0.9);
  }

  // ===== DRAW HEADER =====
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
    doc.line(centerX - 35, y, centerX + 35, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('PAYMENT IN INVOICE', centerX, y, { align: 'center' });
    y += 3;
    doc.line(centerX - 31, y, centerX + 31, y);
    y += 8;

    return y;
  }

  const headerEndY = drawHeader();

  // ===== PAYMENT DETAILS =====
  let yPos = headerEndY + 5;

  // Received From (Left)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('RECEIVED FROM,', margin, yPos);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text((customer?.customer_name || 'CUSTOMER').toUpperCase(), margin, yPos + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  let leftY = yPos + 10;
  if (customer?.address) { doc.text(customer.address, margin, leftY); leftY += 4; }
  if (customer?.mobile_no) { doc.text(`Mobile: ${customer.mobile_no}`, margin, leftY); leftY += 4; }
  const custTax = [customer?.ntn ? `NTN # ${customer.ntn}` : null, customer?.str ? `STR # ${customer.str}` : null].filter(Boolean).join('   ');
  if (custTax) doc.text(custTax, margin, leftY);

  // Payment details (Right)
  const rightX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${payment.receipt_no || '-'}`, rightX, yPos, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  let rightY = yPos + 5;
  doc.text(`Date: ${formatDate(payment.payment_date || payment.date)}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  doc.text(`Payment Mode: ${formatPaymentMethod(payment.payment_method)}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  if (payment.online_reference) {
    doc.text(`Reference: ${payment.online_reference}`, rightX, rightY, { align: 'right' });
  }

  yPos += 30;

  // ===== PAYMENT AMOUNT TABLE =====
  const tableStartX = (pageWidth - 195) / 2;
  const tableData = [
    ['Payment Description', 'Amount']
  ];

  const bodyData = [
    ['Payment Received from Customer', formatCurrency(payment.amount)]
  ];

  const footData = [
    ['TOTAL AMOUNT', formatCurrency(payment.amount)]
  ];

  autoTable(doc, {
    startY: yPos,
    head: tableData,
    body: bodyData,
    foot: footData,
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
      valign: 'middle',
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
      cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 150 },
      1: { halign: 'center', cellWidth: 45 },
    },
    tableWidth: 195,
    margin: { left: tableStartX, right: tableStartX },
    didDrawPage: function(data) {
      // Draw border around header row
      const headerRow = data.table.head[0];
      if (headerRow && headerRow.cells[0]) {
        const startX = headerRow.cells[0].x;
        const startY = headerRow.cells[0].y;
        const tableWidth = 195;
        const borderHeight = headerRow.height - 3;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(startX, startY, tableWidth, borderHeight);

        // Draw vertical separators
        let currentX = startX;
        const cells = headerRow.cells;
        Object.keys(cells).forEach((key, i) => {
          if (i < Object.keys(cells).length - 1) {
            currentX += cells[key].width;
            doc.line(currentX, startY, currentX, startY + borderHeight);
          }
        });
      }

      // Draw border around footer row
      const footerRow = data.table.foot[0];
      if (footerRow && footerRow.cells[0]) {
        const startX = footerRow.cells[0].x;
        const startY = footerRow.cells[0].y;
        const tableWidth = 195;
        const footerHeight = footerRow.height;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(startX, startY, startX + tableWidth, startY);
        doc.line(startX, startY + footerHeight, startX + tableWidth, startY + footerHeight);
      }
    },
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // ===== AMOUNT IN WORDS =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('AMOUNT IN WORDS', tableStartX, finalY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const labelWidth = doc.getTextWidth('AMOUNT IN WORDS');
  doc.text(numberToWords(Math.round(payment.amount)).toUpperCase(), tableStartX + labelWidth + 5, finalY);

  finalY += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const tableEndX = tableStartX + 195;
  doc.line(tableStartX, finalY, tableEndX, finalY);

  finalY += 10;

  // ===== SUMMARY =====
  const summaryLabels = ['PREVIOUS BALANCE', 'PAYMENT RECEIVED', 'NEW BALANCE'];
  const previousBalance = payment.customer_balance + payment.amount;
  const summaryValues = [
    formatCurrency(previousBalance),
    formatCurrency(payment.amount),
    formatCurrency(payment.customer_balance)
  ];
  const summaryColors = [[220, 53, 69], [34, 197, 94], [0, 123, 255]];

  const colW = (pageWidth - margin * 2) / 3;

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

  // ===== NOTES =====
  if (payment.notes) {
    finalY += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('NOTES:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(payment.notes, pageWidth - (margin * 2));
    doc.text(noteLines, margin, finalY + 5);
  }

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
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text('page 1 of 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

/**
 * Generate Payment Out Invoice PDF
 */
export async function generatePaymentOutInvoicePDF(payment, supplier, settings, options = {}) {
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
  if (settings?.signature_url) {
    images.signature = await getImageAsBase64(settings.signature_url, 150, 0.9);
  }

  // ===== DRAW HEADER =====
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
    doc.line(centerX - 35, y, centerX + 35, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('PAYMENT OUT INVOICE', centerX, y, { align: 'center' });
    y += 3;
    doc.line(centerX - 31, y, centerX + 31, y);
    y += 8;

    return y;
  }

  const headerEndY = drawHeader();

  // ===== PAYMENT DETAILS =====
  let yPos = headerEndY + 5;

  // Paid To (Left)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('PAID TO,', margin, yPos);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text((supplier?.supplier_name || 'SUPPLIER').toUpperCase(), margin, yPos + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  let leftY = yPos + 10;
  if (supplier?.address) { doc.text(supplier.address, margin, leftY); leftY += 4; }
  if (supplier?.mobile_no) { doc.text(`Mobile: ${supplier.mobile_no}`, margin, leftY); leftY += 4; }
  const suppTax = [supplier?.ntn ? `NTN # ${supplier.ntn}` : null, supplier?.str ? `STR # ${supplier.str}` : null].filter(Boolean).join('   ');
  if (suppTax) doc.text(suppTax, margin, leftY);

  // Payment details (Right)
  const rightX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${payment.receipt_no || '-'}`, rightX, yPos, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  let rightY = yPos + 5;
  doc.text(`Date: ${formatDate(payment.payment_date || payment.date)}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  doc.text(`Payment Mode: ${formatPaymentMethod(payment.payment_method)}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  if (payment.online_reference) {
    doc.text(`Reference: ${payment.online_reference}`, rightX, rightY, { align: 'right' });
  }

  yPos += 30;

  // ===== PAYMENT AMOUNT TABLE =====
  const tableStartX = (pageWidth - 195) / 2;
  const tableData = [
    ['Payment Description', 'Amount']
  ];

  const bodyData = [
    ['Payment Made to Supplier', formatCurrency(payment.amount)]
  ];

  const footData = [
    ['TOTAL AMOUNT', formatCurrency(payment.amount)]
  ];

  autoTable(doc, {
    startY: yPos,
    head: tableData,
    body: bodyData,
    foot: footData,
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
      valign: 'middle',
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
      cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 150 },
      1: { halign: 'center', cellWidth: 45 },
    },
    tableWidth: 195,
    margin: { left: tableStartX, right: tableStartX },
    didDrawPage: function(data) {
      // Draw border around header row
      const headerRow = data.table.head[0];
      if (headerRow && headerRow.cells[0]) {
        const startX = headerRow.cells[0].x;
        const startY = headerRow.cells[0].y;
        const tableWidth = 195;
        const borderHeight = headerRow.height - 3;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(startX, startY, tableWidth, borderHeight);

        // Draw vertical separators
        let currentX = startX;
        const cells = headerRow.cells;
        Object.keys(cells).forEach((key, i) => {
          if (i < Object.keys(cells).length - 1) {
            currentX += cells[key].width;
            doc.line(currentX, startY, currentX, startY + borderHeight);
          }
        });
      }

      // Draw border around footer row
      const footerRow = data.table.foot[0];
      if (footerRow && footerRow.cells[0]) {
        const startX = footerRow.cells[0].x;
        const startY = footerRow.cells[0].y;
        const tableWidth = 195;
        const footerHeight = footerRow.height;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(startX, startY, startX + tableWidth, startY);
        doc.line(startX, startY + footerHeight, startX + tableWidth, startY + footerHeight);
      }
    },
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // ===== AMOUNT IN WORDS =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('AMOUNT IN WORDS', tableStartX, finalY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const labelWidth = doc.getTextWidth('AMOUNT IN WORDS');
  doc.text(numberToWords(Math.round(payment.amount)).toUpperCase(), tableStartX + labelWidth + 5, finalY);

  finalY += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const tableEndX = tableStartX + 195;
  doc.line(tableStartX, finalY, tableEndX, finalY);

  finalY += 10;

  // ===== SUMMARY =====
  const summaryLabels = ['PREVIOUS BALANCE', 'PAYMENT MADE', 'NEW BALANCE'];
  const previousBalance = payment.supplier_balance + payment.amount;
  const summaryValues = [
    formatCurrency(previousBalance),
    formatCurrency(payment.amount),
    formatCurrency(payment.supplier_balance)
  ];
  const summaryColors = [[220, 53, 69], [255, 165, 0], [0, 123, 255]];

  const colW = (pageWidth - margin * 2) / 3;

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

  // ===== NOTES =====
  if (payment.notes) {
    finalY += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('NOTES:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(payment.notes, pageWidth - (margin * 2));
    doc.text(noteLines, margin, finalY + 5);
  }

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
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text('page 1 of 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

/**
 * Preview Payment In Invoice PDF in new tab
 */
export async function previewPaymentInInvoicePDF(payment, customer, settings, options = {}) {
  try {
    const doc = await generatePaymentInInvoicePDF(payment, customer, settings, options);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

/**
 * Preview Payment Out Invoice PDF in new tab
 */
export async function previewPaymentOutInvoicePDF(payment, supplier, settings, options = {}) {
  try {
    const doc = await generatePaymentOutInvoicePDF(payment, supplier, settings, options);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}
