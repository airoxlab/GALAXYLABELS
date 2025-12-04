'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Search,
  RefreshCw,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Filter,
  ChevronDown,
  MessageSquare,
  FileText,
  ShoppingCart,
  Loader2,
  AlertCircle,
  RotateCw,
  Package,
} from 'lucide-react';
import { isWhatsAppAvailable, sendSalesInvoiceWhatsApp, sendPurchaseInvoiceWhatsApp, sendSaleOrderWhatsApp, generateInvoicePDFBase64, generateSaleOrderPDFBase64 } from '@/lib/whatsapp';
import { generatePurchaseOrderPDF } from '@/components/purchases/PurchasePDF';

// WhatsApp SVG Icon
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function WhatsAppLogsSection({ userId }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(null);
  const [resendingInvoice, setResendingInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  });

  useEffect(() => {
    if (userId) {
      loadLogs();
      loadSettings();
    }
  }, [userId, filterStatus, filterType]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('whatsapp_message_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterType !== 'all') {
        query = query.eq('transaction_type', filterType);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      setLogs(data || []);

      // Calculate stats
      const allLogs = data || [];
      setStats({
        total: allLogs.length,
        sent: allLogs.filter(l => l.status === 'sent').length,
        failed: allLogs.filter(l => l.status === 'failed').length,
        pending: allLogs.filter(l => l.status === 'pending').length,
      });
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load message logs', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!confirm('Are you sure you want to delete this log entry?')) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('whatsapp_message_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      setLogs(prev => prev.filter(l => l.id !== logId));
      toast.success('Log deleted', {
        duration: 1500,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error deleting log:', error);
      toast.error('Failed to delete log', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAllLogs = async () => {
    if (!confirm('Are you sure you want to clear all message logs? This action cannot be undone.')) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('whatsapp_message_logs')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setLogs([]);
      setStats({ total: 0, sent: 0, failed: 0, pending: 0 });
      toast.success('All logs cleared', {
        duration: 1500,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error clearing logs:', error);
      toast.error('Failed to clear logs', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleResend = async (log) => {
    if (!window.electron?.whatsapp) {
      toast.error('WhatsApp is not available', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    try {
      setResending(log.id);

      const status = await window.electron.whatsapp.getStatus();
      if (!status?.isReady) {
        toast.error('WhatsApp is not connected', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
        return;
      }

      // Resend the message
      const result = await window.electron.whatsapp.sendMessage({
        phone: log.recipient_phone,
        message: log.message_content,
      });

      if (result.success) {
        // Update log status
        await supabase
          .from('whatsapp_message_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', log.id);

        setLogs(prev => prev.map(l =>
          l.id === log.id
            ? { ...l, status: 'sent', sent_at: new Date().toISOString(), error_message: null }
            : l
        ));

        toast.success('Message resent successfully', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error resending message:', error);
      toast.error(error.message || 'Failed to resend message', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setResending(null);
    }
  };

  // Resend with fresh invoice/order data and PDF
  const handleResendInvoice = async (log) => {
    if (!isWhatsAppAvailable()) {
      toast.error('WhatsApp is not available', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    try {
      setResendingInvoice(log.id);

      const status = await window.electron.whatsapp.getStatus();
      if (!status?.isReady) {
        toast.error('WhatsApp is not connected', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
        return;
      }

      let result = { success: false };

      // Fetch fresh data based on transaction type and resend with PDF
      if (log.transaction_type === 'sales_invoice') {
        // Fetch sales invoice data
        const { data: invoice } = await supabase
          .from('sales_invoices')
          .select('*, customers(customer_name, mobile_no, whatsapp_no, current_balance)')
          .eq('id', log.transaction_id)
          .single();

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        const { data: items } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', log.transaction_id);

        // Generate PDF
        let pdfBase64 = null;
        if (settings?.whatsapp_attach_invoice_image !== false) {
          pdfBase64 = await generateInvoicePDFBase64(invoice, items || [], settings);
        }

        // Send WhatsApp
        result = await sendSalesInvoiceWhatsApp({
          invoice: { ...invoice, user_id: userId },
          items: items || [],
          settings,
          pdfBase64,
        });

      } else if (log.transaction_type === 'sale_order') {
        // Fetch sale order data
        const { data: order } = await supabase
          .from('sale_orders')
          .select('*, customers(customer_name, mobile_no, whatsapp_no, current_balance)')
          .eq('id', log.transaction_id)
          .single();

        if (!order) {
          throw new Error('Sale order not found');
        }

        const { data: items } = await supabase
          .from('sale_order_items')
          .select('*')
          .eq('order_id', log.transaction_id);

        // Generate PDF
        let pdfBase64 = null;
        if (settings?.whatsapp_attach_invoice_image !== false) {
          pdfBase64 = await generateSaleOrderPDFBase64(order, items || [], settings);
        }

        // Send WhatsApp
        result = await sendSaleOrderWhatsApp({
          order: { ...order, user_id: userId },
          settings,
          pdfBase64,
        });

      } else if (log.transaction_type === 'purchase_order' || log.transaction_type === 'purchase_invoice') {
        // Fetch purchase order data
        const { data: purchase } = await supabase
          .from('purchase_orders')
          .select('*, suppliers(supplier_name, mobile_no, whatsapp_no, current_balance)')
          .eq('id', log.transaction_id)
          .single();

        if (!purchase) {
          throw new Error('Purchase order not found');
        }

        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('*')
          .eq('order_id', log.transaction_id);

        // Generate PDF
        let pdfBase64 = null;
        if (settings?.whatsapp_attach_invoice_image !== false) {
          try {
            const doc = await generatePurchaseOrderPDF(purchase, items || [], settings, { showLogo: true, showQR: false });
            const pdfData = doc.output('datauristring');
            pdfBase64 = pdfData.split(',')[1];
          } catch (e) {
            console.error('Error generating PDF:', e);
          }
        }

        // Send WhatsApp
        result = await sendPurchaseInvoiceWhatsApp({
          purchase: { ...purchase, user_id: userId },
          settings,
          pdfBase64,
        });
      } else {
        throw new Error('Unknown transaction type');
      }

      if (result.success) {
        // Create new log entry for the resend
        await supabase.from('whatsapp_message_logs').insert([{
          user_id: userId,
          transaction_type: log.transaction_type,
          transaction_id: log.transaction_id,
          recipient_phone: log.recipient_phone,
          recipient_name: log.recipient_name,
          message_content: log.message_content,
          attachment_sent: settings?.whatsapp_attach_invoice_image !== false,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }]);

        toast.success('Invoice resent successfully!', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });

        // Reload logs
        loadLogs();
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error resending invoice:', error);
      toast.error(error.message || 'Failed to resend invoice', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setResendingInvoice(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      pending: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={cn(
        "px-2 py-0.5 rounded text-[10px] font-medium capitalize",
        styles[status] || 'bg-neutral-100 text-neutral-600'
      )}>
        {status}
      </span>
    );
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'sales_invoice':
        return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      case 'sale_order':
        return <Package className="w-3.5 h-3.5 text-green-500" />;
      case 'purchase_order':
      case 'purchase_invoice':
        return <ShoppingCart className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLogs = logs.filter(log =>
    log.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.recipient_phone?.includes(searchTerm) ||
    log.message_content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">WhatsApp Message Logs</h2>
          <p className="text-[10px] text-neutral-500 mt-0.5">View and manage sent WhatsApp messages</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className={cn(
              "p-2 rounded-lg",
              "bg-neutral-100 text-neutral-600",
              "hover:bg-neutral-200",
              "transition-colors"
            )}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleClearAllLogs}
              disabled={deleting}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium",
                "bg-red-50 text-red-600 border border-red-200",
                "hover:bg-red-100",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-neutral-900">{stats.total}</div>
          <div className="text-[10px] text-neutral-500 uppercase font-medium">Total</div>
        </div>
        <div className="bg-green-50/80 border border-green-200/60 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-green-700">{stats.sent}</div>
          <div className="text-[10px] text-green-600 uppercase font-medium">Sent</div>
        </div>
        <div className="bg-red-50/80 border border-red-200/60 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-red-700">{stats.failed}</div>
          <div className="text-[10px] text-red-600 uppercase font-medium">Failed</div>
        </div>
        <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-amber-700">{stats.pending}</div>
          <div className="text-[10px] text-amber-600 uppercase font-medium">Pending</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2",
              "bg-white border border-neutral-200/60 rounded-lg",
              "text-xs placeholder:text-neutral-400",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
              "transition-all"
            )}
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={cn(
              "appearance-none bg-white border border-neutral-200/60 rounded-lg",
              "pl-3 pr-8 py-2 text-xs",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
            )}
          >
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={cn(
              "appearance-none bg-white border border-neutral-200/60 rounded-lg",
              "pl-3 pr-8 py-2 text-xs",
              "focus:outline-none focus:ring-1 focus:ring-neutral-900/10"
            )}
          >
            <option value="all">All Types</option>
            <option value="sales_invoice">Sales Invoice</option>
            <option value="sale_order">Sale Order</option>
            <option value="purchase_order">Purchase Order</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-neutral-200/60 rounded-lg overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <WhatsAppIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-neutral-900 mb-1">No message logs</h3>
            <p className="text-xs text-neutral-500">
              {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                ? 'No logs match your filters'
                : 'WhatsApp message logs will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Recipient</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Phone</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Sent At</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Attachment</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-700 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {getTransactionIcon(log.transaction_type)}
                        <span className="text-xs text-neutral-600 capitalize">
                          {log.transaction_type?.replace('_', ' ') || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-900">
                      {log.recipient_name || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-600">
                      {log.recipient_phone || '-'}
                    </td>
                    <td className="px-3 py-2">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-600">
                      {formatDate(log.sent_at || log.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      {log.attachment_sent ? (
                        <span className="text-[10px] text-green-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-[10px] text-neutral-400">No</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetailModal(true);
                          }}
                          className={cn(
                            "p-1.5 rounded-lg",
                            "text-neutral-600 hover:bg-neutral-100",
                            "transition-colors"
                          )}
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {/* Resend Invoice Button - for any log with transaction_id */}
                        {log.transaction_id && (
                          <button
                            onClick={() => handleResendInvoice(log)}
                            disabled={resendingInvoice === log.id}
                            className={cn(
                              "p-1.5 rounded-lg",
                              "text-green-600 hover:bg-green-50",
                              "transition-colors",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                            title="Resend Invoice"
                          >
                            {resendingInvoice === log.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {/* Resend Message Button - for failed messages */}
                        {log.status === 'failed' && (
                          <button
                            onClick={() => handleResend(log)}
                            disabled={resending === log.id}
                            className={cn(
                              "p-1.5 rounded-lg",
                              "text-blue-600 hover:bg-blue-50",
                              "transition-colors",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                            title="Resend Message Only"
                          >
                            {resending === log.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          disabled={deleting}
                          className={cn(
                            "p-1.5 rounded-lg",
                            "text-red-600 hover:bg-red-50",
                            "transition-colors",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={cn(
            "bg-white rounded-xl shadow-xl",
            "w-full max-w-lg",
            "max-h-[90vh] overflow-y-auto"
          )}>
            <div className="sticky top-0 bg-white border-b border-neutral-200/60 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WhatsAppIcon className="w-5 h-5 text-green-500" />
                <h2 className="text-sm font-semibold text-neutral-900">Message Details</h2>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedLog(null);
                }}
                className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-lg">
                <span className="text-xs font-medium text-neutral-600">Status</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedLog.status)}
                  {getStatusBadge(selectedLog.status)}
                </div>
              </div>

              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50/80 rounded-lg">
                  <p className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Transaction Type</p>
                  <div className="flex items-center gap-1.5">
                    {getTransactionIcon(selectedLog.transaction_type)}
                    <span className="text-xs text-neutral-900 capitalize">
                      {selectedLog.transaction_type?.replace('_', ' ') || '-'}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-neutral-50/80 rounded-lg">
                  <p className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Transaction ID</p>
                  <span className="text-xs text-neutral-900">#{selectedLog.transaction_id}</span>
                </div>
              </div>

              {/* Recipient Info */}
              <div className="p-3 bg-neutral-50/80 rounded-lg">
                <p className="text-[10px] text-neutral-500 uppercase font-medium mb-2">Recipient</p>
                <p className="text-xs font-medium text-neutral-900">{selectedLog.recipient_name || '-'}</p>
                <p className="text-xs text-neutral-600">{selectedLog.recipient_phone}</p>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50/80 rounded-lg">
                  <p className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Created At</p>
                  <span className="text-xs text-neutral-900">{formatDate(selectedLog.created_at)}</span>
                </div>
                <div className="p-3 bg-neutral-50/80 rounded-lg">
                  <p className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Sent At</p>
                  <span className="text-xs text-neutral-900">{formatDate(selectedLog.sent_at) || '-'}</span>
                </div>
              </div>

              {/* Attachment */}
              <div className="p-3 bg-neutral-50/80 rounded-lg">
                <p className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Attachment</p>
                <span className="text-xs text-neutral-900">
                  {selectedLog.attachment_sent ? 'PDF Attached' : 'No Attachment'}
                </span>
              </div>

              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="p-3 bg-red-50/80 border border-red-200/60 rounded-lg">
                  <p className="text-[10px] text-red-600 uppercase font-medium mb-1">Error Message</p>
                  <p className="text-xs text-red-700">{selectedLog.error_message}</p>
                </div>
              )}

              {/* Message Content */}
              <div className="p-3 bg-neutral-50/80 rounded-lg">
                <p className="text-[10px] text-neutral-500 uppercase font-medium mb-2">Message Content</p>
                <div className="bg-[#E5DDD5] rounded-lg p-3">
                  <div className="bg-[#DCF8C6] rounded-lg p-3 shadow-sm">
                    <p className="text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed">
                      {selectedLog.message_content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedLog(null);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg",
                    "bg-neutral-100 text-neutral-700",
                    "text-xs font-medium",
                    "hover:bg-neutral-200",
                    "transition-colors"
                  )}
                >
                  Close
                </button>
                {selectedLog.transaction_id && (
                  <button
                    onClick={() => {
                      handleResendInvoice(selectedLog);
                      setShowDetailModal(false);
                      setSelectedLog(null);
                    }}
                    disabled={resendingInvoice === selectedLog.id}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg",
                      "bg-green-500 text-white",
                      "text-xs font-medium",
                      "hover:bg-green-600",
                      "transition-colors",
                      "flex items-center justify-center gap-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {resendingInvoice === selectedLog.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCw className="w-3.5 h-3.5" />
                    )}
                    Resend Invoice
                  </button>
                )}
                {selectedLog.status === 'failed' && (
                  <button
                    onClick={() => {
                      handleResend(selectedLog);
                      setShowDetailModal(false);
                      setSelectedLog(null);
                    }}
                    disabled={resending === selectedLog.id}
                    className={cn(
                      "px-4 py-2 rounded-lg",
                      "bg-blue-500 text-white",
                      "text-xs font-medium",
                      "hover:bg-blue-600",
                      "transition-colors",
                      "flex items-center justify-center gap-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {resending === selectedLog.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Resend Text
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
