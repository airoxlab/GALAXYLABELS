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
 * Generate a purchase order PDF with professional design matching sales order
 * @param {Object} purchase - Purchase order data
 * @param {Array} items - Purchase order items
 * @param {Object} settings - Company settings
 * @param {Object} options - PDF options (showLogo, showQR)
 * @returns {Promise<jsPDF>} - The PDF document
 */
export async function generatePurchaseOrderPDF(purchase, items, settings, options = {}) {
  const { showLogo = true } = options;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Load images (QR code removed from purchase orders - only used in sale orders)
  const images = {};
  if (showLogo && settings?.logo_url) images.logo = await getImageAsBase64(settings.logo_url, 200, 0.9);
  if (settings?.signature_url) images.signature = await getImageAsBase64(settings.signature_url, 150, 0.9);

  let totalQty = 0, totalTax = 0, totalAmount = 0, totalNetWeight = 0;
  const getCategory = (item) => item.category || item.products?.categories?.name || '';

  // Store item data for custom rendering
  const itemsData = items.map((item, idx) => {
    const qty = item.quantity || 0;
    const price = item.unit_price || 0;
    const weight = item.weight || 0;
    const netWeight = qty * weight;
    const taxPercent = purchase.gst_percentage || 0;
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

  y += 30;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(centerX - 26, y, centerX + 26, y);
  y += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PURCHASE ORDER REPORT', centerX, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(0, 0, 0);
  doc.line(centerX - 24, y, centerX + 24, y);
  y += 8;

  // Order From (Supplier)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('ORDER FROM,', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text((purchase.suppliers?.supplier_name || 'SUPPLIER').toUpperCase(), margin, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  let orderY = y + 10;
  if (purchase.suppliers?.address) { doc.text(purchase.suppliers.address, margin, orderY); orderY += 4; }
  const supplierTax = [purchase.suppliers?.ntn ? `NTN # ${purchase.suppliers.ntn}` : null, purchase.suppliers?.str ? `STR # ${purchase.suppliers.str}` : null].filter(Boolean).join('   ');
  if (supplierTax) doc.text(supplierTax, margin, orderY);

  const rightX = pageWidth - margin;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Purchase Order #', rightX, y, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  let invY = y + 5;
  doc.text(purchase.po_no || '-', rightX, invY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  invY += 5;
  doc.text(`PO Date: ${formatDate(purchase.po_date)}`, rightX, invY, { align: 'right' });
  invY += 4;
  if (purchase.receiving_date) {
    doc.text(`Receiving Date: ${formatDate(purchase.receiving_date)}`, rightX, invY, { align: 'right' });
    invY += 4;
  }
  doc.text(`Status: ${(purchase.status || 'Pending').toUpperCase()}`, rightX, invY, { align: 'right' });

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
      cellPadding: { top: 6, right: 0.75, bottom: 1, left: 0.75 },
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
        const topY = 10;
        const lineY = topY + 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        doc.text(`${purchase.po_no || 'N/A'}`, margin, topY);
        doc.text(`PO Date: ${formatDate(purchase.po_date)}`, pageWidth - margin, topY, { align: 'right' });

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

          doc.line(startX, startY, startX + tableWidth, startY);
          doc.line(startX, startY + footerHeight, startX + tableWidth, startY + footerHeight);
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

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(itemData.productName, cellCenterX, topY, { align: 'center' });

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

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(formatCurrency(itemData.taxAmt), cellCenterX, topY, { align: 'center' });

          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`(${itemData.taxPercent}%)`, cellCenterX, bottomY, { align: 'center' });
        }
      }

      if (data.section === 'foot' && data.row.index === 0) {
        data.cell.y += 3;
      }
    },
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  if (finalY > pageHeight - 70) {
    doc.addPage();
    finalY = 20;
  }

  // Amount in words
  const tableStartX = (pageWidth - 195) / 2;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('ORDER AMOUNT IN WORDS', tableStartX, finalY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const labelWidth = doc.getTextWidth('ORDER AMOUNT IN WORDS');
  doc.text(numberToWords(Math.round(totalAmount)).toUpperCase(), tableStartX + labelWidth + 5, finalY);

  finalY += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const tableEndX = tableStartX + 195;
  doc.line(tableStartX, finalY, tableEndX, finalY);

  finalY += 10;

  // Summary
  const summaryLabels = ['ORDER AMOUNT', 'TAXABLE AMOUNT', 'RATE', 'TAX AMOUNT', 'NET WEIGHT'];
  const taxableAmount = totalAmount - totalTax;
  const summaryValues = [formatCurrency(totalAmount), formatCurrency(taxableAmount), `${purchase.gst_percentage || 0}%`, formatCurrency(totalTax), `${totalNetWeight.toFixed(2)} kg`];
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

  // Signature
  const sigY = pageHeight - 60;
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
  doc.text('Authorized Authority', pageWidth - margin - 25, sigY + 30, { align: 'center' });

  // Page numbers
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
      // Open PDF in new window for preview
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Colors
    const primaryColor = [23, 23, 23];
    const grayColor = [115, 115, 115];

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Purchase Orders Report', margin, 20);

    // Report metadata
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...grayColor);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, 28);
    doc.text(`Total Orders: ${purchases.length}`, margin, 33);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, margin, 38);

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, 42, pageWidth - margin, 42);

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
      theme: 'grid',
      headStyles: {
        fillColor: [23, 23, 23],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        lineWidth: 0.4,
        lineColor: [0, 0, 0],
        cellPadding: { top: 1.5, right: 0.75, bottom: 4.5, left: 0.75 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 3, right: 0.75, bottom: 3, left: 0.75 },
      },
      styles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });

    // Footer
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(...grayColor);
    doc.text('Powered by airoxlab.com', pageWidth / 2, finalY, { align: 'center' });

    doc.save(`purchases-report-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating purchases report PDF:', error);
    throw new Error('Failed to generate purchases report PDF: ' + error.message);
  }
}

// Helper functions
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
