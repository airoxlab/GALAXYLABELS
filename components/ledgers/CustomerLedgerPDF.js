/**
 * Customer Ledger PDF Generation Utility
 * Generates PDF with complete transaction history, invoices, payments, and balances
 * Professional design matching Purchase/Sales Order reports
 */

'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert image URL to compressed base64 data URL
 */
async function getImageAsBase64(url, maxWidth = 150, quality = 0.9) {
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
 * Generate a customer ledger PDF
 */
export async function generateCustomerLedgerPDF(customer, ledgerEntries, stats, settings) {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  let y = 14;
  const centerX = pageWidth / 2;

  // Load images with compression
  const images = {};
  if (settings?.logo_url) {
    try {
      images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
      console.log('Logo loaded:', images.logo ? 'success' : 'null');
    } catch (error) {
      console.error('Error loading logo:', error);
      images.logo = null;
    }
  }
  if (settings?.qr_code_url) {
    try {
      images.qr = await getImageAsBase64(settings.qr_code_url, 150, 0.9);
      console.log('QR loaded:', images.qr ? 'success' : 'null');
    } catch (error) {
      console.error('Error loading QR:', error);
      images.qr = null;
    }
  }

  // Logo (left aligned)
  if (images.logo && typeof images.logo === 'string' && images.logo.length > 0) {
    try {
      doc.addImage(images.logo, 'JPEG', margin, y, 30, 30);
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  // Company details (centered)
  const companyY = y + 8;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(settings?.company_name || 'COMPANY NAME', centerX, companyY, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  let contactY = companyY + 7;
  if (settings?.company_address) {
    doc.text(settings.company_address, centerX, contactY, { align: 'center' });
    contactY += 5;
  }

  const contact = [
    settings?.contact_detail_1 ? `Contact # ${settings.contact_detail_1}` : null,
    settings?.email_1 ? `Email: ${settings.email_1}` : null
  ].filter(Boolean).join(' | ');
  if (contact) {
    doc.text(contact, centerX, contactY, { align: 'center' });
    contactY += 5;
  }

  const tax = [
    settings?.ntn ? `NTN # ${settings.ntn}` : null,
    settings?.str ? `STR # ${settings.str}` : null
  ].filter(Boolean).join('   ');
  if (tax) {
    doc.text(tax, centerX, contactY, { align: 'center' });
  }

  // QR Code (right aligned)
  if (images.qr && typeof images.qr === 'string' && images.qr.length > 0) {
    try {
      doc.addImage(images.qr, 'JPEG', pageWidth - margin - 30, y, 30, 30);
    } catch (error) {
      console.error('Error adding QR code:', error);
    }
  }

  y += 45;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(centerX - 40, y, centerX + 40, y);
  y += 6;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CUSTOMER LEDGER', centerX, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(0, 0, 0);
  doc.line(centerX - 42, y, centerX + 42, y);
  y += 10;

  // Date info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, centerX, y, { align: 'center' });
  y += 10;

  // Customer Info Section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const leftX = margin;
  const rightX = pageWidth - margin;

  // Left side - Customer Details
  doc.setFont('helvetica', 'bold');
  doc.text('Customer:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.customer_name || '-', leftX + 25, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Mobile:', leftX, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.mobile_no || '-', leftX + 25, y + 6);

  // Right side - Summary Stats
  doc.setFont('helvetica', 'bold');
  doc.text('Total Sales:', rightX - 60, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalSales), rightX, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Total Paid:', rightX - 60, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalPayments), rightX, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Balance:', rightX - 60, y + 12);
  doc.setFont('helvetica', 'normal');
  if (stats.outstandingBalance > 0) {
    doc.setTextColor(220, 38, 38);
  } else {
    doc.setTextColor(34, 197, 94);
  }
  doc.text(formatCurrency(stats.outstandingBalance), rightX, y + 12, { align: 'right' });

  y += 20;

  // Ledger Table
  const tableData = ledgerEntries.map((entry) => [
    formatDate(entry.date),
    entry.type,
    entry.reference,
    entry.description,
    entry.debit > 0 ? formatCurrency(entry.debit) : '-',
    entry.credit > 0 ? formatCurrency(entry.credit) : '-',
    formatCurrency(Math.abs(entry.balance))
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']],
    body: tableData,
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
      fontSize: 9,
      textColor: [0, 0, 0],
      halign: 'left',
      valign: 'middle',
      lineWidth: 0,
      lineColor: [255, 255, 255],
      minCellHeight: 10,
      cellPadding: { top: 3, right: 0.75, bottom: 2, left: 0.75 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'left', cellWidth: 'auto' },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28 },
    },
    tableWidth: 195,
    styles: { overflow: 'linebreak', cellPadding: 1.5 },
    margin: { left: (pageWidth - 195) / 2, right: (pageWidth - 195) / 2, bottom: 30 },
    showHead: 'everyPage',
    willDrawPage: function (data) {
      if (data.pageNumber > 1) {
        const topY = 10;
        const lineY = topY + 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        doc.text('Customer Ledger', margin, topY);
        doc.text(`${customer.customer_name}`, pageWidth - margin, topY, { align: 'right' });

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, lineY, pageWidth - margin, lineY);

        data.settings.startY = lineY + 8;
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

        if (startY >= 10) {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);

          doc.rect(startX, startY, tableWidth, borderHeight);

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
    }
  });

  // Add summary on last page
  const finalY = doc.lastAutoTable.finalY || y;
  if (finalY < pageHeight - 50) {
    // Add summary on same page
    doc.setPage(doc.internal.getNumberOfPages());
    const summaryY = finalY + 10;
    const summaryX = pageWidth - margin - 70;

    // Summary content (no border, no background)
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Sales:', summaryX + 5, summaryY + 8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(stats.totalSales), summaryX + 65, summaryY + 8, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('Total Paid:', summaryX + 5, summaryY + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(stats.totalPayments), summaryX + 65, summaryY + 15, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('Outstanding:', summaryX + 5, summaryY + 22);
    doc.setFont('helvetica', 'bold');
    if (stats.outstandingBalance > 0) {
      doc.setTextColor(220, 38, 38);
    } else {
      doc.setTextColor(34, 197, 94);
    }
    doc.text(formatCurrency(stats.outstandingBalance), summaryX + 65, summaryY + 22, { align: 'right' });
  }

  // Page numbers and footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  return doc;
}

/**
 * View customer ledger PDF in new window
 */
export async function viewCustomerLedgerPDF(customer, ledgerEntries, stats, settings) {
  try {
    const doc = await generateCustomerLedgerPDF(customer, ledgerEntries, stats, settings);
    doc.output('dataurlnewwindow');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

/**
 * Download customer ledger PDF
 */
export async function downloadCustomerLedgerPDF(customer, ledgerEntries, stats, settings) {
  try {
    const doc = await generateCustomerLedgerPDF(customer, ledgerEntries, stats, settings);
    doc.save(`Customer-Ledger-${customer.customer_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
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
