/**
 * WhatsApp utility functions for sending messages via Electron
 */

import { supabase } from './supabase';

/**
 * Check if running in Electron with WhatsApp support
 */
export const isWhatsAppAvailable = () => {
  return typeof window !== 'undefined' && window.electron?.whatsapp;
};

/**
 * Get WhatsApp connection status
 */
export const getWhatsAppStatus = async () => {
  if (!isWhatsAppAvailable()) {
    return { isReady: false, error: 'WhatsApp not available in browser mode' };
  }
  return await window.electron.whatsapp.getStatus();
};

/**
 * Format phone number for WhatsApp - Universal formatter
 * Handles ANY format: "+92 704906902", " +92 704906902 ", "+92704906902",
 * "03704906902", "3704906902", "92704906902", etc.
 *
 * WhatsApp requires: country code + number (no + sign, no spaces)
 * Example: 92704906902 for Pakistan
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return null;

  // Convert to string and trim
  let formatted = String(phone).trim();

  // Remove ALL non-numeric characters (spaces, +, -, (), etc.)
  formatted = formatted.replace(/[^0-9]/g, '');

  // If empty or too short after cleaning, return null
  if (!formatted || formatted.length < 9) return null;

  // Universal formatting logic:
  // 1. If already starts with country code (92 for Pakistan), use as is
  // 2. If starts with 0, remove 0 and add country code
  // 3. Otherwise, add country code

  // Check if number already has a valid country code (starts with 92, 91, 1, 44, etc.)
  // For now, focus on Pakistani numbers but keep it flexible

  if (formatted.startsWith('92')) {
    // Already has Pakistan country code - use as is
    // This handles: +92704906902, 92704906902, +92 704906902
    return formatted;
  }

  if (formatted.startsWith('0')) {
    // Local format with leading 0 - remove 0 and add country code
    // This handles: 03704906902, 0704906902
    return '92' + formatted.substring(1);
  }

  // Check for other common country codes (don't add 92 if already has one)
  const commonCountryCodes = ['1', '44', '91', '971', '966', '974', '973', '968', '965', '962', '961', '86', '81'];
  for (const code of commonCountryCodes) {
    if (formatted.startsWith(code) && formatted.length >= code.length + 9) {
      // Already has a country code
      return formatted;
    }
  }

  // No country code detected - assume Pakistan and add 92
  // This handles: 704906902, 3704906902
  return '92' + formatted;
};

/**
 * Get the best phone number for WhatsApp from customer/supplier
 * Prioritizes whatsapp_no over mobile_no
 */
export const getWhatsAppNumber = (entity) => {
  if (!entity) return null;
  // Prioritize whatsapp_no if available, fallback to mobile_no
  return entity.whatsapp_no || entity.mobile_no || null;
};

/**
 * Replace template variables with actual values
 */
export const parseMessageTemplate = (template, data) => {
  if (!template) return '';

  return template
    .replace(/{Transaction_Date}/g, data.transactionDate || '')
    .replace(/{Party_Name}/g, data.partyName || '')
    .replace(/{Invoice_No}/g, data.invoiceNo || '')
    .replace(/{Invoice_Amount}/g, data.invoiceAmount || '')
    .replace(/{PO_No}/g, data.poNo || '')
    .replace(/{PO_Amount}/g, data.poAmount || '')
    .replace(/{Party_Balance}/g, data.partyBalance || '0')
    .replace(/{Company_Name}/g, data.companyName || '')
    .replace(/{Company_Phone}/g, data.companyPhone || '');
};

/**
 * Send WhatsApp message for sales invoice
 */
export const sendSalesInvoiceWhatsApp = async ({
  invoice,
  items,
  settings,
  pdfBase64 = null,
  onSuccess,
  onError,
}) => {
  if (!isWhatsAppAvailable()) {
    onError?.('WhatsApp is only available in the desktop app');
    return { success: false, error: 'WhatsApp not available' };
  }

  try {
    // Check connection status
    const status = await window.electron.whatsapp.getStatus();
    if (!status.isReady) {
      onError?.('WhatsApp is not connected. Please connect in Settings.');
      return { success: false, error: 'WhatsApp not connected' };
    }

    // Get customer phone number (prioritize whatsapp_no, fallback to mobile_no)
    const rawPhone = getWhatsAppNumber(invoice.customers);
    const phoneNumber = formatPhoneNumber(rawPhone);
    if (!phoneNumber) {
      onError?.('Customer does not have a phone number');
      return { success: false, error: 'No phone number' };
    }

    // Get message template from settings
    const messageTemplate = settings?.whatsapp_sales_message_template ||
      `Dear Sir, Aslam-o-Alaikam!
Please see the new Invoice.
{Transaction_Date}
{Party_Name}

Invoice #  {Invoice_No}
Inv. Amount  {Invoice_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}`;

    // Format the message
    const message = parseMessageTemplate(messageTemplate, {
      transactionDate: new Date(invoice.invoice_date).toLocaleDateString('en-GB'),
      partyName: invoice.customers?.customer_name || '',
      invoiceNo: invoice.invoice_no,
      invoiceAmount: new Intl.NumberFormat('en-PK').format(invoice.total_amount || 0),
      partyBalance: new Intl.NumberFormat('en-PK').format(invoice.party_balance || 0),
      companyName: settings?.company_name || '',
      companyPhone: settings?.contact_detail_1 || '',
    });

    // Send via Electron IPC
    let result;
    if (pdfBase64 && settings?.whatsapp_attach_invoice_image !== false) {
      result = await window.electron.whatsapp.sendInvoice(
        phoneNumber,
        message,
        pdfBase64,
        invoice.invoice_no
      );
    } else {
      result = await window.electron.whatsapp.sendMessage(phoneNumber, message);
    }

    if (result.success) {
      // Log the message
      await logWhatsAppMessage({
        userId: invoice.user_id,
        transactionType: 'sales_invoice',
        transactionId: invoice.id,
        recipientPhone: phoneNumber,
        recipientName: invoice.customers?.customer_name,
        messageContent: message,
        attachmentSent: !!pdfBase64,
        status: 'sent',
      });

      onSuccess?.();
      return { success: true, messageId: result.messageId };
    } else {
      onError?.(result.error || 'Failed to send message');
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    onError?.(error.message || 'Failed to send message');
    return { success: false, error: error.message };
  }
};

/**
 * Send WhatsApp message for purchase invoice
 */
export const sendPurchaseInvoiceWhatsApp = async ({
  purchase,
  settings,
  pdfBase64 = null,
  onSuccess,
  onError,
}) => {
  if (!isWhatsAppAvailable()) {
    onError?.('WhatsApp is only available in the desktop app');
    return { success: false, error: 'WhatsApp not available' };
  }

  try {
    // Check connection status
    const status = await window.electron.whatsapp.getStatus();
    if (!status.isReady) {
      onError?.('WhatsApp is not connected. Please connect in Settings.');
      return { success: false, error: 'WhatsApp not connected' };
    }

    // Get supplier phone number (prioritize whatsapp_no, fallback to mobile_no)
    const rawPhone = getWhatsAppNumber(purchase.suppliers);
    const phoneNumber = formatPhoneNumber(rawPhone);
    if (!phoneNumber) {
      onError?.('Supplier does not have a phone number');
      return { success: false, error: 'No phone number' };
    }

    // Get message template from settings
    const messageTemplate = settings?.whatsapp_purchase_message_template ||
      `Dear Sir, Aslam-o-Alaikam!
Please see the new Purchase Order.
{Transaction_Date}
{Party_Name}

PO #  {PO_No}
Amount  {PO_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}`;

    // Format the message
    const message = parseMessageTemplate(messageTemplate, {
      transactionDate: new Date(purchase.po_date || purchase.purchase_date || purchase.created_at).toLocaleDateString('en-GB'),
      partyName: purchase.suppliers?.supplier_name || '',
      poNo: purchase.po_no || purchase.purchase_no,
      poAmount: new Intl.NumberFormat('en-PK').format(purchase.total_amount || 0),
      partyBalance: new Intl.NumberFormat('en-PK').format(purchase.suppliers?.current_balance || purchase.party_balance || 0),
      companyName: settings?.company_name || '',
      companyPhone: settings?.contact_detail_1 || '',
    });

    // Send via Electron IPC
    let result;
    if (pdfBase64 && settings?.whatsapp_attach_invoice_image !== false) {
      result = await window.electron.whatsapp.sendInvoice(
        phoneNumber,
        message,
        pdfBase64,
        purchase.po_no || purchase.purchase_no
      );
    } else {
      result = await window.electron.whatsapp.sendMessage(phoneNumber, message);
    }

    if (result.success) {
      // Log the message
      await logWhatsAppMessage({
        userId: purchase.user_id,
        transactionType: 'purchase_invoice',
        transactionId: purchase.id,
        recipientPhone: phoneNumber,
        recipientName: purchase.suppliers?.supplier_name,
        messageContent: message,
        attachmentSent: !!pdfBase64,
        status: 'sent',
      });

      onSuccess?.();
      return { success: true, messageId: result.messageId };
    } else {
      onError?.(result.error || 'Failed to send message');
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    onError?.(error.message || 'Failed to send message');
    return { success: false, error: error.message };
  }
};

/**
 * Send WhatsApp message for sale order
 */
export const sendSaleOrderWhatsApp = async ({
  order,
  settings,
  pdfBase64 = null,
  onSuccess,
  onError,
}) => {
  if (!isWhatsAppAvailable()) {
    onError?.('WhatsApp is only available in the desktop app');
    return { success: false, error: 'WhatsApp not available' };
  }

  try {
    // Check connection status
    const status = await window.electron.whatsapp.getStatus();
    if (!status.isReady) {
      onError?.('WhatsApp is not connected. Please connect in Settings.');
      return { success: false, error: 'WhatsApp not connected' };
    }

    // Get customer phone number (prioritize whatsapp_no, fallback to mobile_no)
    const rawPhone = getWhatsAppNumber(order.customers);
    const phoneNumber = formatPhoneNumber(rawPhone);
    if (!phoneNumber) {
      onError?.('Customer does not have a phone number');
      return { success: false, error: 'No phone number' };
    }

    // Get message template from settings (use sales template or custom)
    const messageTemplate = settings?.whatsapp_sales_message_template ||
      `Dear Sir, Aslam-o-Alaikam!
Please see the new Sale Order.
{Transaction_Date}
{Party_Name}

Order #  {Invoice_No}
Amount  {Invoice_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}`;

    // Format the message
    const message = parseMessageTemplate(messageTemplate, {
      transactionDate: new Date(order.order_date).toLocaleDateString('en-GB'),
      partyName: order.customers?.customer_name || '',
      invoiceNo: order.order_no,
      invoiceAmount: new Intl.NumberFormat('en-PK').format(order.total_amount || 0),
      partyBalance: new Intl.NumberFormat('en-PK').format(order.customers?.current_balance || 0),
      companyName: settings?.company_name || '',
      companyPhone: settings?.contact_detail_1 || '',
    });

    // Send via Electron IPC
    let result;
    if (pdfBase64 && settings?.whatsapp_attach_invoice_image !== false) {
      result = await window.electron.whatsapp.sendInvoice(
        phoneNumber,
        message,
        pdfBase64,
        order.order_no
      );
    } else {
      result = await window.electron.whatsapp.sendMessage(phoneNumber, message);
    }

    if (result.success) {
      // Log the message
      await logWhatsAppMessage({
        userId: order.user_id,
        transactionType: 'sale_order',
        transactionId: order.id,
        recipientPhone: phoneNumber,
        recipientName: order.customers?.customer_name,
        messageContent: message,
        attachmentSent: !!pdfBase64,
        status: 'sent',
      });

      onSuccess?.();
      return { success: true, messageId: result.messageId };
    } else {
      onError?.(result.error || 'Failed to send message');
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    onError?.(error.message || 'Failed to send message');
    return { success: false, error: error.message };
  }
};

/**
 * Log WhatsApp message to database
 */
const logWhatsAppMessage = async ({
  userId,
  transactionType,
  transactionId,
  recipientPhone,
  recipientName,
  messageContent,
  attachmentSent,
  status,
  errorMessage = null,
}) => {
  try {
    await supabase.from('whatsapp_message_logs').insert([{
      user_id: userId,
      transaction_type: transactionType,
      transaction_id: transactionId,
      recipient_phone: recipientPhone,
      recipient_name: recipientName,
      message_content: messageContent,
      attachment_sent: attachmentSent,
      status,
      error_message: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    }]);
  } catch (error) {
    console.error('Error logging WhatsApp message:', error);
  }
};

/**
 * Generate PDF as base64 for WhatsApp attachment (Sales Invoice)
 */
export const generateInvoicePDFBase64 = async (invoice, items, settings) => {
  try {
    const { generateInvoicePDF } = await import('@/components/sales/InvoicePDF');
    const doc = await generateInvoicePDF(invoice, items, settings, { showLogo: true, showQR: true });
    // Get as base64
    const pdfData = doc.output('datauristring');
    // Extract just the base64 part
    const base64 = pdfData.split(',')[1];
    return base64;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
};

/**
 * Generate Sale Order PDF as base64 for WhatsApp attachment
 */
export const generateSaleOrderPDFBase64 = async (order, items, settings) => {
  try {
    const { generateSaleOrderPDF } = await import('@/components/sales/InvoicePDF');
    const doc = await generateSaleOrderPDF(order, items, settings, { showLogo: true });
    // Get as base64
    const pdfData = doc.output('datauristring');
    // Extract just the base64 part
    const base64 = pdfData.split(',')[1];
    return base64;
  } catch (error) {
    console.error('Error generating Sale Order PDF:', error);
    return null;
  }
};
