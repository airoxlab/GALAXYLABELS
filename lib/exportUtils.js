import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportCustomersToPDF = (customers) => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // Blue color
  doc.text('Customers List', 14, 22);

  // Add date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  // Prepare table data
  const tableData = customers.map((customer, index) => [
    index + 1,
    customer.customer_name,
    customer.contact_person || '-',
    customer.mobile_no || '-',
    customer.email || '-',
    customer.ntn || '-',
    formatCurrency(customer.current_balance),
    customer.is_active ? 'Active' : 'Inactive'
  ]);

  // Add table
  doc.autoTable({
    startY: 35,
    head: [['#', 'Customer Name', 'Contact Person', 'Mobile', 'Email', 'NTN', 'Balance', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // Blue
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 18 }
    },
    margin: { top: 35 }
  });

  // Add footer with total count
  const finalY = doc.lastAutoTable.finalY || 35;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Total Customers: ${customers.length}`, 14, finalY + 10);

  // Save the PDF
  doc.save(`customers_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportCustomersToExcel = (customers) => {
  // Prepare data for Excel
  const excelData = customers.map((customer, index) => ({
    '#': index + 1,
    'Customer Name': customer.customer_name,
    'Contact Person': customer.contact_person || '-',
    'Mobile Number': customer.mobile_no || '-',
    'WhatsApp': customer.whatsapp_no || '-',
    'Email': customer.email || '-',
    'Address': customer.address || '-',
    'NTN': customer.ntn || '-',
    'STR': customer.str || '-',
    'Current Balance': customer.current_balance || 0,
    'Last Order Date': customer.last_order_date || '-',
    'Status': customer.is_active ? 'Active' : 'Inactive',
    'Created Date': customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = [
    { wch: 5 },  // #
    { wch: 30 }, // Customer Name
    { wch: 20 }, // Contact Person
    { wch: 15 }, // Mobile
    { wch: 15 }, // WhatsApp
    { wch: 25 }, // Email
    { wch: 35 }, // Address
    { wch: 15 }, // NTN
    { wch: 15 }, // STR
    { wch: 15 }, // Balance
    { wch: 15 }, // Last Order
    { wch: 10 }, // Status
    { wch: 15 }  // Created Date
  ];
  worksheet['!cols'] = columnWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

  // Save file
  XLSX.writeFile(workbook, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Helper function for currency formatting
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
}
