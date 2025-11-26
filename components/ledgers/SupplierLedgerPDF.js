/**
 * Supplier Ledger PDF Generation Utility
 * Generates PDF with complete transaction history, purchases, payments, and balances
 */

'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert image URL to compressed base64 data URL
 */
async function getImageAsBase64(url, maxWidth = 150, quality = 0.7) {
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
 * Generate a supplier ledger PDF
 */
export async function generateSupplierLedgerPDF(supplier, ledgerEntries, stats, settings) {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors - Monochrome design
  const primaryColor = [23, 23, 23];
  const grayColor = [115, 115, 115];

  let yPos = 15;

  // Load logo
  let logoImage = null;
  if (settings?.logo_url) {
    logoImage = await getImageAsBase64(settings.logo_url, 150, 0.7);
  }

  // Header with Logo
  if (logoImage) {
    try {
      doc.addImage(logoImage, 'JPEG', margin, yPos, 25, 25);
    } catch (e) {
      console.error('Error adding logo:', e);
    }
  }

  // Company Name and Details
  const companyX = logoImage ? margin + 30 : margin;

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

  yPos += 35;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 8;

  // Title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('SUPPLIER LEDGER', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;
  doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

  yPos += 10;

  // Supplier Info
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);

  // Left column
  doc.setFont(undefined, 'bold');
  doc.text('Supplier:', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(supplier.supplier_name || '-', margin + 30, yPos);

  doc.setFont(undefined, 'bold');
  doc.text('Mobile:', margin, yPos + 5);
  doc.setFont(undefined, 'normal');
  doc.text(supplier.mobile_no || '-', margin + 30, yPos + 5);

  // Right column - Stats
  const rightCol = pageWidth - margin - 60;
  doc.setFont(undefined, 'bold');
  doc.text('Total Purchases:', rightCol, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(stats.totalPurchaseAmount), rightCol + 35, yPos);

  doc.setFont(undefined, 'bold');
  doc.text('Total Paid:', rightCol, yPos + 5);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(stats.totalPayments), rightCol + 35, yPos + 5);

  doc.setFont(undefined, 'bold');
  doc.text('Payable:', rightCol, yPos + 10);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(stats.outstandingBalance), rightCol + 35, yPos + 10);

  yPos += 20;

  // Report Date
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(`Report Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, yPos);

  yPos += 8;

  // Ledger Table
  const tableData = ledgerEntries.map((entry) => [
    formatDate(entry.date),
    entry.type,
    entry.reference,
    entry.description,
    entry.debit > 0 ? formatCurrency(entry.debit) : '-',
    entry.credit > 0 ? formatCurrency(entry.credit) : '-',
    formatCurrency(Math.abs(entry.balance)) + (entry.balance < 0 ? ' CR' : ''),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 25 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
    },
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    margin: { left: margin, right: margin },
    didDrawPage: function (data) {
      // Footer on each page
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...grayColor);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });

  // Summary Section after table
  const finalY = doc.lastAutoTable.finalY + 10;

  // Summary Box
  doc.setFillColor(245, 245, 245);
  doc.rect(pageWidth - margin - 80, finalY, 80, 35, 'F');

  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('Total Debit:', pageWidth - margin - 75, finalY + 8);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(stats.totalPayments), pageWidth - margin - 5, finalY + 8, { align: 'right' });

  doc.setTextColor(...grayColor);
  doc.text('Total Credit:', pageWidth - margin - 75, finalY + 16);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(stats.totalPurchaseAmount), pageWidth - margin - 5, finalY + 16, { align: 'right' });

  doc.setFont(undefined, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Net Payable:', pageWidth - margin - 75, finalY + 26);
  doc.text(
    formatCurrency(stats.outstandingBalance),
    pageWidth - margin - 5,
    finalY + 26,
    { align: 'right' }
  );

  // Powered by footer
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...grayColor);
  doc.text('Powered by airoxlab.com', pageWidth / 2, pageHeight - 6, { align: 'center' });

  return doc;
}

/**
 * Download supplier ledger PDF
 */
export async function downloadSupplierLedgerPDF(supplier, ledgerEntries, stats, settings) {
  try {
    const doc = await generateSupplierLedgerPDF(supplier, ledgerEntries, stats, settings);
    doc.save(`Supplier-Ledger-${supplier.supplier_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
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
