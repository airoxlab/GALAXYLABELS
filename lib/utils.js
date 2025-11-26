// Format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

// Format number
export function formatNumber(number) {
  return new Intl.NumberFormat('en-PK').format(number || 0);
}

// Format date
export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format datetime
export function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate unique ID
export function generateId(prefix = 'ID') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

// Calculate GST
export function calculateGST(amount, gstPercentage) {
  const gstAmount = (amount * gstPercentage) / 100;
  return {
    subtotal: amount,
    gstAmount: gstAmount,
    total: amount + gstAmount,
  };
}

// Show toast notification (placeholder)
export function showToast(message, type = 'info') {
  // Simple alert for now - can be replaced with a proper toast library
  alert(message);
}

// Show notification placeholder
export function showNotificationPlaceholder(type) {
  const messages = {
    whatsapp: 'WhatsApp notification feature coming soon',
    email: 'Email notification feature coming soon',
    sms: 'SMS notification feature coming soon',
  };
  showToast(messages[type] || 'Notification feature coming soon', 'info');
}

// Validate email
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validate phone
export function isValidPhone(phone) {
  const re = /^[\d\s\-\+\(\)]+$/;
  return phone && phone.length >= 10 && re.test(phone);
}

// Truncate text
export function truncate(text, length = 50) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substr(0, length) + '...';
}

// Class names helper
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export to CSV
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    showToast('No data to export', 'warning');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const cell = row[header];
        return typeof cell === 'string' && cell.includes(',')
          ? `"${cell}"`
          : cell;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Print element
export function printElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    showToast('Element not found', 'error');
    return;
  }

  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Print</title>');
  printWindow.document.write('<style>body { font-family: Arial, sans-serif; }</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(element.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
}
