/**
 * Invoice PDF Generation Utility
 * Handles PDF generation for sales invoices with logo, QR code, and company details
 */

'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert image URL to base64 data URL
 * @param {string} url - Image URL
 * @returns {Promise<string>} - Base64 data URL
 */
async function getImageAsBase64(url) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

/**
 * Generate a single invoice PDF with professional design
 * @param {Object} invoice - Invoice data
 * @param {Array} items - Invoice items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 * @returns {Promise<jsPDF>} - The PDF document
 */
export async function generateInvoicePDF(invoice, items, settings, options = {}) {
  const { showLogo = true, showQR = true } = options;
  const doc = new jsPDF();

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors
  const primaryColor = [23, 23, 23]; // neutral-900
  const grayColor = [115, 115, 115]; // neutral-500
  const lightGray = [245, 245, 245]; // neutral-100

  let yPos = 15;

  // Load logo and QR images
  let logoBase64 = null;
  let qrBase64 = null;

  if (showLogo && settings?.logo_url) {
    logoBase64 = await getImageAsBase64(settings.logo_url);
  }

  if (showQR && settings?.qr_code_url) {
    qrBase64 = await getImageAsBase64(settings.qr_code_url);
  }

  // Header Section with Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, yPos, 25, 25);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }

  // Company Name and Details
  const companyX = logoBase64 ? margin + 30 : margin;

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(settings?.company_name || 'COMPANY NAME', companyX, yPos + 8);

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...grayColor);

  const contactLine = [
    settings?.company_address,
    settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null,
    settings?.contact_detail_2
  ].filter(Boolean).join(', ');

  doc.text(contactLine || 'Address, Contact', companyX, yPos + 14);

  const taxLine = [
    settings?.ntn ? `NTN # ${settings.ntn}` : null,
    settings?.str ? `STR # ${settings.str}` : null
  ].filter(Boolean).join('   ');

  if (taxLine) {
    doc.text(taxLine, companyX, yPos + 19);
  }

  // QR Code on the right
  if (qrBase64) {
    try {
      doc.addImage(qrBase64, 'PNG', pageWidth - margin - 25, yPos, 25, 25);
    } catch (e) {
      console.error('Error adding QR:', e);
    }
  }

  yPos += 35;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 8;

  // Invoice Title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(59, 130, 246); // blue-500
  doc.text('SALES INVOICE', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;

  // Another divider
  doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

  yPos += 10;

  // Invoice Details and Customer Info - Two columns
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);

  // Left column - Invoice Details
  doc.setFont(undefined, 'bold');
  doc.text('Invoice #:', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(invoice.invoice_no || '-', margin + 25, yPos);

  doc.setFont(undefined, 'bold');
  doc.text('Date:', margin, yPos + 5);
  doc.setFont(undefined, 'normal');
  doc.text(formatDate(invoice.invoice_date), margin + 25, yPos + 5);

  if (invoice.customer_po) {
    doc.setFont(undefined, 'bold');
    doc.text('PO #:', margin, yPos + 10);
    doc.setFont(undefined, 'normal');
    doc.text(invoice.customer_po, margin + 25, yPos + 10);
  }

  // Right column - Customer Details
  const rightCol = pageWidth - margin - 60;
  doc.setFont(undefined, 'bold');
  doc.text('Bill To:', rightCol, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(invoice.customers?.customer_name || '-', rightCol, yPos + 5);

  if (invoice.customers?.mobile_no) {
    doc.text(`Mobile: ${invoice.customers.mobile_no}`, rightCol, yPos + 10);
  }

  if (invoice.customers?.address) {
    const addressLines = doc.splitTextToSize(invoice.customers.address, 55);
    doc.text(addressLines, rightCol, yPos + 15);
  }

  yPos += 25;

  // Items Table
  const tableData = items.map((item, index) => [
    index + 1,
    item.product_name || '-',
    item.quantity || 0,
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price || (item.quantity * item.unit_price)),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Product', 'Qty', 'Unit Price', 'Amount']],
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
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    margin: { left: margin, right: margin },
  });

  // Totals Section
  const finalY = doc.lastAutoTable.finalY + 8;
  const totalsX = pageWidth - margin - 70;

  // Totals box
  doc.setFillColor(...lightGray);
  doc.roundedRect(totalsX - 5, finalY - 3, 75, 35, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text('Subtotal:', totalsX, finalY + 2);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin, finalY + 2, { align: 'right' });

  doc.setTextColor(...grayColor);
  doc.text(`GST (${invoice.gst_percentage || 0}%):`, totalsX, finalY + 9);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(invoice.gst_amount), pageWidth - margin, finalY + 9, { align: 'right' });

  // Total line
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX, finalY + 13, pageWidth - margin, finalY + 13);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Total:', totalsX, finalY + 20);
  doc.text(formatCurrency(invoice.total_amount), pageWidth - margin, finalY + 20, { align: 'right' });

  // Previous Balance and Final Balance
  let balanceY = finalY + 30;
  if (invoice.previous_balance && invoice.previous_balance > 0) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    doc.text('Previous Balance:', totalsX, balanceY);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(invoice.previous_balance), pageWidth - margin, balanceY, { align: 'right' });

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(239, 68, 68); // red-500
    doc.text('Final Balance:', totalsX, balanceY + 7);
    doc.text(formatCurrency(invoice.final_balance), pageWidth - margin, balanceY + 7, { align: 'right' });
    balanceY += 15;
  }

  // Notes
  if (invoice.notes) {
    const notesY = Math.max(balanceY + 10, finalY + 45);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Notes:', margin, notesY);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - (margin * 2));
    doc.text(noteLines, margin, notesY + 5);
  }

  // Footer with company name
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(`For, ${settings?.company_name || 'Company'}`, pageWidth - margin, pageHeight - 35, { align: 'right' });

  // Signature line
  doc.setDrawColor(...grayColor);
  doc.line(pageWidth - margin - 50, pageHeight - 25, pageWidth - margin, pageHeight - 25);
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('Authorized Signature', pageWidth - margin - 25, pageHeight - 20, { align: 'center' });

  // Thank you message
  doc.setFontSize(8);
  doc.setFont(undefined, 'italic');
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

/**
 * Generate and download a single invoice PDF
 * @param {Object} invoice - Invoice data
 * @param {Array} items - Invoice items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 */
export async function downloadInvoicePDF(invoice, items, settings, options = {}) {
  try {
    const doc = await generateInvoicePDF(invoice, items, settings, options);
    doc.save(`Invoice-${invoice.invoice_no}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

/**
 * Generate a sales report PDF with multiple invoices
 * @param {Array} invoices - Array of invoices
 * @param {Number} totalAmount - Total amount of all invoices
 */
export async function generateSalesReportPDF(invoices, totalAmount) {
  try {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Sales Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 28);
    doc.text(`Total Sales: ${invoices.length}`, 14, 34);
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, 14, 40);

    const tableData = invoices.map(invoice => [
      invoice.invoice_no || '-',
      invoice.customers?.customer_name || '-',
      formatDate(invoice.invoice_date),
      formatCurrency(invoice.total_amount),
    ]);

    autoTable(doc, {
      startY: 46,
      head: [['Invoice #', 'Customer', 'Date', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });

    doc.save(`sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating sales report PDF:', error);
    throw new Error('Failed to generate sales report PDF: ' + error.message);
  }
}

/**
 * Generate a sale order PDF
 * @param {Object} order - Order data
 * @param {Array} items - Order items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 */
export async function generateSaleOrderPDF(order, items, settings, options = {}) {
  try {
    const { showLogo = true, showQR = true } = options;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const primaryColor = [23, 23, 23];
    const grayColor = [115, 115, 115];

    let yPos = 15;

    // Load images
    let logoBase64 = null;
    let qrBase64 = null;

    if (showLogo && settings?.logo_url) {
      logoBase64 = await getImageAsBase64(settings.logo_url);
    }

    if (showQR && settings?.qr_code_url) {
      qrBase64 = await getImageAsBase64(settings.qr_code_url);
    }

    // Header with Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, yPos, 25, 25);
      } catch (e) {
        console.error('Error adding logo:', e);
      }
    }

    // Company Header
    const companyX = logoBase64 ? margin + 30 : margin;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(settings?.company_name || 'COMPANY NAME', companyX, yPos + 8);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);

    const contactLine = [
      settings?.company_address,
      settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null,
      settings?.contact_detail_2
    ].filter(Boolean).join(', ');

    doc.text(contactLine || 'Address', companyX, yPos + 14);

    const taxLine = [
      settings?.ntn ? `NTN # ${settings.ntn}` : null,
      settings?.str ? `STR # ${settings.str}` : null
    ].filter(Boolean).join('   ');

    if (taxLine) {
      doc.text(taxLine, companyX, yPos + 19);
    }

    // QR Code
    if (qrBase64) {
      try {
        doc.addImage(qrBase64, 'PNG', pageWidth - margin - 25, yPos, 25, 25);
      } catch (e) {
        console.error('Error adding QR:', e);
      }
    }

    yPos += 35;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 8;

    // Order Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(34, 197, 94); // green-500
    doc.text('SALE ORDER', pageWidth / 2, yPos, { align: 'center' });

    yPos += 8;
    doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

    yPos += 10;

    // Order Details
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);

    doc.setFont(undefined, 'bold');
    doc.text('Order #:', margin, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(order.order_no || '-', margin + 22, yPos);

    doc.setFont(undefined, 'bold');
    doc.text('Date:', margin, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(formatDate(order.order_date), margin + 22, yPos + 5);

    if (order.customer_po) {
      doc.setFont(undefined, 'bold');
      doc.text('PO #:', margin, yPos + 10);
      doc.setFont(undefined, 'normal');
      doc.text(order.customer_po, margin + 22, yPos + 10);
    }

    // Customer
    const rightCol = pageWidth - margin - 60;
    doc.setFont(undefined, 'bold');
    doc.text('Customer:', rightCol, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(order.customers?.customer_name || '-', rightCol, yPos + 5);

    yPos += 20;

    // Items Table
    const tableData = items.map((item, index) => [
      index + 1,
      item.product_name || '-',
      item.quantity || 0,
      formatCurrency(item.unit_price),
      formatCurrency(item.total_price || (item.quantity * item.unit_price)),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Product', 'Qty', 'Unit Price', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    // Totals
    const finalY = doc.lastAutoTable.finalY + 10;
    const totalsX = pageWidth - margin - 70;

    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('Subtotal:', totalsX, finalY);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(order.subtotal), pageWidth - margin, finalY, { align: 'right' });

    doc.setTextColor(...grayColor);
    doc.text(`GST (${order.gst_percentage || 0}%):`, totalsX, finalY + 6);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(order.gst_amount), pageWidth - margin, finalY + 6, { align: 'right' });

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('Total:', totalsX, finalY + 14);
    doc.text(formatCurrency(order.total_amount), pageWidth - margin, finalY + 14, { align: 'right' });

    // Notes
    if (order.notes) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('Notes:', margin, finalY + 25);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...grayColor);
      doc.text(order.notes, margin, finalY + 30, { maxWidth: 180 });
    }

    doc.save(`SaleOrder-${order.order_no}.pdf`);
  } catch (error) {
    console.error('Error generating sale order PDF:', error);
    throw new Error('Failed to generate sale order PDF: ' + error.message);
  }
}

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
}
