/**
 * Purchase Order PDF Generation Utility
 * Handles PDF generation for purchase orders with logo, QR code, and company details
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
 * Generate a purchase order PDF with professional design
 * @param {Object} purchase - Purchase order data
 * @param {Array} items - Purchase order items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 * @returns {Promise<jsPDF>} - The PDF document
 */
export async function generatePurchaseOrderPDF(purchase, items, settings, options = {}) {
  const { showLogo = true } = options;
  const doc = new jsPDF();

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors - Clean monochrome design like Sales Invoice
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

  // Purchase Order Title - Clean monochrome design
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('PURCHASE ORDER', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;

  // Another divider
  doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

  yPos += 10;

  // Order Details and Supplier Info - Two columns
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);

  // Left column - Order Details
  doc.setFont(undefined, 'bold');
  doc.text('PO #:', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(purchase.po_no || '-', margin + 25, yPos);

  doc.setFont(undefined, 'bold');
  doc.text('Date:', margin, yPos + 5);
  doc.setFont(undefined, 'normal');
  doc.text(formatDate(purchase.po_date), margin + 25, yPos + 5);

  doc.setFont(undefined, 'bold');
  doc.text('Status:', margin, yPos + 10);
  doc.setFont(undefined, 'normal');
  doc.text(purchase.status || 'Pending', margin + 25, yPos + 10);

  // Right column - Supplier Details
  const rightCol = pageWidth - margin - 60;
  doc.setFont(undefined, 'bold');
  doc.text('Supplier:', rightCol, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(purchase.suppliers?.supplier_name || '-', rightCol, yPos + 5);

  if (purchase.suppliers?.mobile_no) {
    doc.text(`Mobile: ${purchase.suppliers.mobile_no}`, rightCol, yPos + 10);
  }

  if (purchase.suppliers?.address) {
    const addressLines = doc.splitTextToSize(purchase.suppliers.address, 55);
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
  doc.text(formatCurrency(purchase.subtotal), pageWidth - margin, finalY, { align: 'right' });

  doc.setTextColor(...grayColor);
  doc.text(`GST (${purchase.gst_percentage || 0}%):`, totalsX, finalY + 7);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(purchase.gst_amount), pageWidth - margin, finalY + 7, { align: 'right' });

  // Total with bold styling
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('Total:', totalsX, finalY + 16);
  doc.text(formatCurrency(purchase.total_amount), pageWidth - margin, finalY + 16, { align: 'right' });

  // Notes
  if (purchase.notes) {
    const notesY = finalY + 35;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Notes:', margin, notesY);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    const noteLines = doc.splitTextToSize(purchase.notes, pageWidth - (margin * 2));
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
 * Generate and download a purchase order PDF
 * @param {Object} purchase - Purchase order data
 * @param {Array} items - Purchase order items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 * @param {boolean} shouldPrint - Whether to open print dialog instead of downloading
 */
export async function downloadPurchaseOrderPDF(purchase, items, settings, options = {}, shouldPrint = false) {
  try {
    const doc = await generatePurchaseOrderPDF(purchase, items, settings, options);

    if (shouldPrint) {
      // Open PDF in new window and trigger print
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } else {
      doc.save(`PO-${purchase.po_no}.pdf`);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

/**
 * Generate a purchases report PDF with multiple orders
 * @param {Array} purchases - Array of purchase orders
 * @param {Number} totalAmount - Total amount of all orders
 */
export async function generatePurchasesReportPDF(purchases, totalAmount) {
  try {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Purchase Orders Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 28);
    doc.text(`Total Orders: ${purchases.length}`, 14, 34);
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, 14, 40);

    const tableData = purchases.map(po => [
      po.po_no || '-',
      po.suppliers?.supplier_name || '-',
      formatDate(po.po_date),
      formatCurrency(po.total_amount),
      po.status || 'Pending'
    ]);

    autoTable(doc, {
      startY: 46,
      head: [['PO #', 'Supplier', 'Date', 'Amount', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [23, 23, 23] },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { halign: 'right' }
      }
    });

    doc.save(`purchases-report-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating purchases report PDF:', error);
    throw new Error('Failed to generate purchases report PDF: ' + error.message);
  }
}

// Helper functions
function formatCurrency(amount) {
  return 'Rs ' + new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
}
