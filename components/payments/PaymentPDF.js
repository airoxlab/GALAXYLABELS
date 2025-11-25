/**
 * Payment Receipt PDF Generation Utility
 * Handles PDF generation for payment receipts with logo, QR code, and company details
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
 * Generate a payment receipt PDF with professional design
 * @param {Object} payment - Payment data
 * @param {Object} customer - Customer data
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 * @returns {Promise<jsPDF>} - The PDF document
 */
export async function generatePaymentReceiptPDF(payment, customer, settings, options = {}) {
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
  const greenColor = [34, 197, 94]; // green-500

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

  // Receipt Title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...greenColor);
  doc.text('PAYMENT RECEIPT', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;

  // Another divider
  doc.line(margin + 50, yPos, pageWidth - margin - 50, yPos);

  yPos += 10;

  // Receipt Details and Customer Info - Two columns
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);

  // Left column - Receipt Details
  doc.setFont(undefined, 'bold');
  doc.text('Receipt #:', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(payment.receipt_no || '-', margin + 25, yPos);

  doc.setFont(undefined, 'bold');
  doc.text('Date:', margin, yPos + 6);
  doc.setFont(undefined, 'normal');
  doc.text(formatDate(payment.date), margin + 25, yPos + 6);

  doc.setFont(undefined, 'bold');
  doc.text('Method:', margin, yPos + 12);
  doc.setFont(undefined, 'normal');
  doc.text(formatPaymentMethod(payment.payment_method), margin + 25, yPos + 12);

  // Bank details if applicable
  if (payment.payment_method !== 'cash' && payment.bank_name) {
    doc.setFont(undefined, 'bold');
    doc.text('Bank:', margin, yPos + 18);
    doc.setFont(undefined, 'normal');
    doc.text(payment.bank_name, margin + 25, yPos + 18);
  }

  // Cheque details if applicable
  if (payment.payment_method === 'cheque') {
    if (payment.cheque_no) {
      doc.setFont(undefined, 'bold');
      doc.text('Cheque #:', margin, yPos + 24);
      doc.setFont(undefined, 'normal');
      doc.text(payment.cheque_no, margin + 25, yPos + 24);
    }
    if (payment.cheque_date) {
      doc.setFont(undefined, 'bold');
      doc.text('Cheque Date:', margin, yPos + 30);
      doc.setFont(undefined, 'normal');
      doc.text(formatDate(payment.cheque_date), margin + 30, yPos + 30);
    }
  }

  // Right column - Customer Details
  const rightCol = pageWidth - margin - 60;
  doc.setFont(undefined, 'bold');
  doc.text('Received From:', rightCol, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(customer?.customer_name || '-', rightCol, yPos + 6);

  if (customer?.mobile_no) {
    doc.text(`Mobile: ${customer.mobile_no}`, rightCol, yPos + 12);
  }

  if (customer?.address) {
    const addressLines = doc.splitTextToSize(customer.address, 55);
    doc.text(addressLines, rightCol, yPos + 18);
  }

  yPos += 45;

  // Amount Box
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 40, 3, 3, 'F');

  // Amount in words (simplified)
  const amount = parseFloat(payment.amount) || 0;
  const amountInWords = numberToWords(amount);

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text('Amount in Words:', margin + 5, yPos + 8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...primaryColor);

  const wordLines = doc.splitTextToSize(amountInWords + ' Only', pageWidth - (margin * 2) - 10);
  doc.text(wordLines, margin + 5, yPos + 14);

  // Amount in figures
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...greenColor);
  doc.text(`Rs. ${formatCurrency(amount)}`, pageWidth / 2, yPos + 32, { align: 'center' });

  yPos += 50;

  // Cash Denominations if cash payment
  if (payment.payment_method === 'cash' && payment.denominations) {
    const denom = payment.denominations;
    const hasAnyDenomination = Object.values(denom).some(v => v > 0);

    if (hasAnyDenomination) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('Cash Denominations:', margin, yPos);

      yPos += 5;

      const denomData = [
        ['5000', denom.note_5000 || 0, (denom.note_5000 || 0) * 5000],
        ['1000', denom.note_1000 || 0, (denom.note_1000 || 0) * 1000],
        ['500', denom.note_500 || 0, (denom.note_500 || 0) * 500],
        ['100', denom.note_100 || 0, (denom.note_100 || 0) * 100],
        ['50', denom.note_50 || 0, (denom.note_50 || 0) * 50],
        ['20', denom.note_20 || 0, (denom.note_20 || 0) * 20],
        ['10', denom.note_10 || 0, (denom.note_10 || 0) * 10],
      ].filter(row => row[1] > 0);

      if (denomData.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Note', 'Count', 'Amount']],
          body: denomData.map(row => [
            `PKR ${row[0]}`,
            row[1],
            formatCurrency(row[2])
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: greenColor,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 50, halign: 'right' },
          },
          margin: { left: margin, right: pageWidth - margin - 120 },
          tableWidth: 120,
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }
    }
  }

  // Balance Information
  if (customer) {
    const previousBalance = customer.current_balance || 0;
    const newBalance = previousBalance - amount;

    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('Previous Balance:', margin, yPos);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(previousBalance), margin + 40, yPos);

    doc.setTextColor(...grayColor);
    doc.text('Payment Amount:', margin, yPos + 6);
    doc.setTextColor(...greenColor);
    doc.text(`- ${formatCurrency(amount)}`, margin + 40, yPos + 6);

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos + 9, margin + 80, yPos + 9);

    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('New Balance:', margin, yPos + 15);
    doc.text(formatCurrency(newBalance), margin + 40, yPos + 15);
  }

  // Notes
  if (payment.notes) {
    const notesY = yPos + 25;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Notes:', margin, notesY);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    const noteLines = doc.splitTextToSize(payment.notes, pageWidth - (margin * 2));
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
  doc.text('Thank you for your payment!', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

/**
 * Generate and download a payment receipt PDF
 * @param {Object} payment - Payment data
 * @param {Object} customer - Customer data
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 */
export async function downloadPaymentReceiptPDF(payment, customer, settings, options = {}) {
  try {
    const doc = await generatePaymentReceiptPDF(payment, customer, settings, options);
    doc.save(`Receipt-${payment.receipt_no}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
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

function formatPaymentMethod(method) {
  const methods = {
    'cash': 'Cash',
    'cheque': 'Cheque',
    'bank_transfer': 'Bank Transfer',
    'online': 'Online Payment'
  };
  return methods[method] || method || '-';
}

function numberToWords(num) {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numString = Math.floor(num).toString();

  if (numString.length > 9) return 'Amount too large';

  const n = ('000000000' + numString).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (n[1] != 0) ? (ones[Number(n[1])] || tens[n[1][0]] + ' ' + ones[n[1][1]]) + ' Crore ' : '';
  str += (n[2] != 0) ? (ones[Number(n[2])] || tens[n[2][0]] + ' ' + ones[n[2][1]]) + ' Lakh ' : '';
  str += (n[3] != 0) ? (ones[Number(n[3])] || tens[n[3][0]] + ' ' + ones[n[3][1]]) + ' Thousand ' : '';
  str += (n[4] != 0) ? (ones[Number(n[4])] || tens[n[4][0]] + ' ' + ones[n[4][1]]) + ' Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (ones[Number(n[5])] || tens[n[5][0]] + ' ' + ones[n[5][1]]) + ' Rupees' : '';

  return str.trim() || 'Zero Rupees';
}
