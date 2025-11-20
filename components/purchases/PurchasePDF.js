/**
 * Purchase Order PDF Generation Utility
 * Handles PDF generation for purchase orders with logo, QR code, and company details
 */

'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert image URL to base64 data URL
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
 * Generate a purchase order PDF
 */
export async function generatePurchaseOrderPDF(purchase, items, settings, options = {}) {
  const { showLogo = true, showQR = true } = options;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const primaryColor = [23, 23, 23];
  const grayColor = [115, 115, 115];
  const lightGray = [245, 245, 245];

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

  // Purchase Order Title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(34, 197, 94); // green-500
  doc.text('PURCHASE ORDER', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;
  doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

  yPos += 10;

  // Order Details
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);

  doc.setFont(undefined, 'bold');
  doc.text('PO #:', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(purchase.po_no || '-', margin + 20, yPos);

  doc.setFont(undefined, 'bold');
  doc.text('Date:', margin, yPos + 5);
  doc.setFont(undefined, 'normal');
  doc.text(formatDate(purchase.po_date), margin + 20, yPos + 5);

  doc.setFont(undefined, 'bold');
  doc.text('Status:', margin, yPos + 10);
  doc.setFont(undefined, 'normal');
  doc.text(purchase.status || 'Pending', margin + 20, yPos + 10);

  // Supplier Details
  const rightCol = pageWidth - margin - 60;
  doc.setFont(undefined, 'bold');
  doc.text('Supplier:', rightCol, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(purchase.suppliers?.supplier_name || '-', rightCol, yPos + 5);

  if (purchase.suppliers?.mobile_no) {
    doc.text(`Mobile: ${purchase.suppliers.mobile_no}`, rightCol, yPos + 10);
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
      fillColor: [34, 197, 94],
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
  doc.roundedRect(totalsX - 5, finalY - 3, 75, 40, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text('Subtotal:', totalsX, finalY + 2);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(purchase.subtotal), pageWidth - margin, finalY + 2, { align: 'right' });

  if (purchase.is_gst) {
    doc.setTextColor(...grayColor);
    doc.text(`GST (${purchase.gst_percentage || 0}%):`, totalsX, finalY + 9);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(purchase.gst_amount), pageWidth - margin, finalY + 9, { align: 'right' });
  }

  // Total line
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX, finalY + 13, pageWidth - margin, finalY + 13);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Total:', totalsX, finalY + 20);
  doc.text(formatCurrency(purchase.total_amount), pageWidth - margin, finalY + 20, { align: 'right' });

  // Previous Balance and Final Payable
  if (purchase.previous_balance && purchase.previous_balance > 0) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    doc.text('Previous Balance:', totalsX, finalY + 27);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(purchase.previous_balance), pageWidth - margin, finalY + 27, { align: 'right' });

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(239, 68, 68); // red-500
    doc.text('Final Payable:', totalsX, finalY + 34);
    doc.text(formatCurrency(purchase.final_payable), pageWidth - margin, finalY + 34, { align: 'right' });
  }

  // Notes
  if (purchase.notes) {
    const notesY = finalY + 50;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Notes:', margin, notesY);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    const noteLines = doc.splitTextToSize(purchase.notes, pageWidth - (margin * 2));
    doc.text(noteLines, margin, notesY + 5);
  }

  // Footer
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

  return doc;
}

/**
 * Generate and download a purchase order PDF
 */
export async function downloadPurchaseOrderPDF(purchase, items, settings, options = {}) {
  try {
    const doc = await generatePurchaseOrderPDF(purchase, items, settings, options);
    doc.save(`PO-${purchase.po_no}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

/**
 * Generate a purchases report PDF
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
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 8 },
    });

    doc.save(`purchases-report-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating purchases report PDF:', error);
    throw new Error('Failed to generate purchases report PDF: ' + error.message);
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
