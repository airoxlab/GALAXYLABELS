/**
 * Invoice PDF Generation Utility
 * Handles PDF generation for sales invoices with logo, QR code, and company details
 */

'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert image URL to compressed base64 data URL
 * @param {string} url - Image URL
 * @param {number} maxWidth - Maximum width for compression
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} - Compressed base64 data URL
 */
async function getImageAsBase64(url, maxWidth = 150, quality = 0.7) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas for compression
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
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
  const { showLogo = true } = options;
  const doc = new jsPDF();

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors - Clean monochrome design like Stock Availability Report
  const primaryColor = [23, 23, 23]; // neutral-900
  const grayColor = [115, 115, 115]; // neutral-500

  let yPos = 15;

  // Load images in parallel for speed
  const imagePromises = [];

  if (showLogo && settings?.logo_url) {
    imagePromises.push(getImageAsBase64(settings.logo_url, 150, 0.7).then(img => ({ type: 'logo', data: img })));
  }

  // Only load QR if it exists in settings
  if (settings?.qr_code_url) {
    imagePromises.push(getImageAsBase64(settings.qr_code_url, 100, 0.8).then(img => ({ type: 'qr', data: img })));
  }

  // Load signature if exists
  if (settings?.signature_url) {
    imagePromises.push(getImageAsBase64(settings.signature_url, 120, 0.8).then(img => ({ type: 'signature', data: img })));
  }

  const loadedImages = await Promise.all(imagePromises);
  const images = {};
  loadedImages.forEach(img => {
    if (img && img.data) images[img.type] = img.data;
  });

  // Header Section with Logo
  if (images.logo) {
    try {
      doc.addImage(images.logo, 'JPEG', margin, yPos, 25, 25);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }

  // Company Name and Details
  const companyX = images.logo ? margin + 30 : margin;

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

  // QR Code on the right (only if exists in settings)
  if (images.qr) {
    try {
      doc.addImage(images.qr, 'JPEG', pageWidth - margin - 25, yPos, 25, 25);
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

  // Invoice Title - Clean monochrome design
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...primaryColor);
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

  // Totals Section - Clean monochrome design
  const finalY = doc.lastAutoTable.finalY + 10;
  const totalsX = pageWidth - margin - 70;

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text('Subtotal:', totalsX, finalY);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin, finalY, { align: 'right' });

  doc.setTextColor(...grayColor);
  doc.text(`GST (${invoice.gst_percentage || 0}%):`, totalsX, finalY + 7);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(invoice.gst_amount), pageWidth - margin, finalY + 7, { align: 'right' });

  // Total with bold styling
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('Total:', totalsX, finalY + 16);
  doc.text(formatCurrency(invoice.total_amount), pageWidth - margin, finalY + 16, { align: 'right' });

  // Previous Balance and Final Balance
  let balanceY = finalY + 28;
  if (invoice.previous_balance && invoice.previous_balance > 0) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    doc.text('Previous Balance:', totalsX, balanceY);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(invoice.previous_balance), pageWidth - margin, balanceY, { align: 'right' });

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('Final Balance:', totalsX, balanceY + 7);
    doc.text(formatCurrency(invoice.final_balance), pageWidth - margin, balanceY + 7, { align: 'right' });
    balanceY += 18;
  }

  // Notes
  if (invoice.notes) {
    const notesY = Math.max(balanceY + 5, finalY + 35);
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
  doc.text(`For, ${settings?.company_name || 'Company'}`, pageWidth - margin, pageHeight - 45, { align: 'right' });

  // Signature image or line
  if (images.signature) {
    try {
      doc.addImage(images.signature, 'PNG', pageWidth - margin - 45, pageHeight - 42, 40, 15);
    } catch (e) {
      console.error('Error adding signature:', e);
    }
  }

  // Signature line
  doc.setDrawColor(...grayColor);
  doc.line(pageWidth - margin - 50, pageHeight - 25, pageWidth - margin, pageHeight - 25);
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('Authorized Signature', pageWidth - margin - 25, pageHeight - 20, { align: 'center' });

  // Thank you message
  doc.setFontSize(8);
  doc.setFont(undefined, 'italic');
  doc.setTextColor(...primaryColor);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 12, { align: 'center' });

  // Powered by footer
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...grayColor);
  doc.text('Powered by airoxlab.com', pageWidth / 2, pageHeight - 6, { align: 'center' });

  return doc;
}

/**
 * Generate and download a single invoice PDF
 * @param {Object} invoice - Invoice data
 * @param {Array} items - Invoice items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 * @param {boolean} shouldPrint - Whether to open print dialog instead of downloading
 */
export async function downloadInvoicePDF(invoice, items, settings, options = {}, shouldPrint = false) {
  try {
    const doc = await generateInvoicePDF(invoice, items, settings, options);

    if (shouldPrint) {
      // Open PDF in new window and trigger print
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } else {
      doc.save(`Invoice-${invoice.invoice_no}.pdf`);
    }
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

    // Load images (compressed)
    let logoBase64 = null;

    if (showLogo && settings?.logo_url) {
      logoBase64 = await getImageAsBase64(settings.logo_url, 150, 0.7);
    }

    // Header with Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'JPEG', margin, yPos, 25, 25);
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
