'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Smartphone,
  LogOut,
  Check,
  Info,
  Loader2,
  FileText,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import WhatsAppQRModal from './WhatsAppQRModal';

// WhatsApp SVG Icon
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function TransactionMessagesSection({ userId }) {
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttempted = useRef(false);
  const saveTimeoutRef = useRef(null);

  const [selectedTransactionType, setSelectedTransactionType] = useState('sales');

  const [whatsappStatus, setWhatsappStatus] = useState({
    isConnected: false,
    phoneNumber: null,
    connectedAt: null,
  });

  const [settings, setSettings] = useState({
    autoSendSales: false,
    autoSendPurchase: false,
    attachInvoiceImage: true,
    salesMessageTemplate: `Dear Sir, Aslam-o-Alaikam!
Please see the new Invoice.
{Transaction_Date}
{Party_Name}

Invoice #  {Invoice_No}
Inv. Amount  {Invoice_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}`,
    purchaseMessageTemplate: `Dear Sir, Aslam-o-Alaikam!
Please see the new Purchase Order.
{Transaction_Date}
{Party_Name}

PO #  {PO_No}
Amount  {PO_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}`,
  });

  const templateVariables = {
    sales: [
      { key: '{Transaction_Date}', label: 'Transaction Date' },
      { key: '{Party_Name}', label: 'Party Name' },
      { key: '{Invoice_No}', label: 'Invoice No' },
      { key: '{Invoice_Amount}', label: 'Invoice Amount' },
      { key: '{Party_Balance}', label: 'Party Balance' },
      { key: '{Company_Name}', label: 'Company Name' },
      { key: '{Company_Phone}', label: 'Company Phone' },
    ],
    purchase: [
      { key: '{Transaction_Date}', label: 'Transaction Date' },
      { key: '{Party_Name}', label: 'Party Name' },
      { key: '{PO_No}', label: 'PO No' },
      { key: '{PO_Amount}', label: 'PO Amount' },
      { key: '{Party_Balance}', label: 'Party Balance' },
      { key: '{Company_Name}', label: 'Company Name' },
      { key: '{Company_Phone}', label: 'Company Phone' },
    ],
  };

  const sampleData = {
    sales: {
      '{Transaction_Date}': '04/12/2024',
      '{Party_Name}': 'ABC Company Ltd.',
      '{Invoice_No}': 'INV-2024-001',
      '{Invoice_Amount}': '25,000',
      '{Party_Balance}': '150,000',
      '{Company_Name}': 'Galaxy Labels',
      '{Company_Phone}': '0300-1234567',
    },
    purchase: {
      '{Transaction_Date}': '04/12/2024',
      '{Party_Name}': 'XYZ Suppliers',
      '{PO_No}': 'PO-2024-001',
      '{PO_Amount}': '50,000',
      '{Party_Balance}': '75,000',
      '{Company_Name}': 'Galaxy Labels',
      '{Company_Phone}': '0300-1234567',
    },
  };

  const messagePreview = useMemo(() => {
    const template = selectedTransactionType === 'sales'
      ? settings.salesMessageTemplate
      : settings.purchaseMessageTemplate;
    const data = sampleData[selectedTransactionType];

    let result = template;
    Object.keys(data).forEach(key => {
      result = result.split(key).join(data[key]);
    });
    return result;
  }, [settings.salesMessageTemplate, settings.purchaseMessageTemplate, selectedTransactionType]);

  useEffect(() => {
    if (userId) {
      loadSettings();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [userId]);

  const autoReconnectWhatsApp = async () => {
    if (reconnectAttempted.current || !window.electron?.whatsapp) return;
    reconnectAttempted.current = true;

    try {
      setReconnecting(true);
      const sessionResult = await window.electron.whatsapp.checkSession(userId);
      if (!sessionResult.hasSession) {
        setReconnecting(false);
        return;
      }

      await window.electron.whatsapp.init(userId);
      const startResult = await window.electron.whatsapp.start();

      if (startResult.success) {
        let attempts = 0;
        const maxAttempts = 60;

        const pollConnection = setInterval(async () => {
          attempts++;
          try {
            const status = await window.electron.whatsapp.getStatus();
            if (status.isReady) {
              clearInterval(pollConnection);
              setReconnecting(false);
              setWhatsappStatus({
                isConnected: true,
                phoneNumber: status.phoneNumber,
                connectedAt: new Date().toISOString(),
              });

              await supabase
                .from('settings')
                .update({
                  whatsapp_connected: true,
                  whatsapp_phone_number: status.phoneNumber,
                  whatsapp_connected_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

              toast.success('WhatsApp reconnected!', {
                duration: 2000,
                style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
              });
            } else if (attempts >= maxAttempts) {
              clearInterval(pollConnection);
              setReconnecting(false);
            }
          } catch (err) {
            console.log('Poll error:', err);
          }
        }, 1000);
      } else {
        setReconnecting(false);
      }
    } catch (error) {
      console.error('Auto-reconnect error:', error);
      setReconnecting(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        setLoading(false);
        return;
      }

      if (data) {
        setWhatsappStatus({
          isConnected: data.whatsapp_connected || false,
          phoneNumber: data.whatsapp_phone_number || null,
          connectedAt: data.whatsapp_connected_at || null,
        });

        setSettings(prev => ({
          ...prev,
          autoSendSales: data.whatsapp_auto_send_sales || false,
          autoSendPurchase: data.whatsapp_auto_send_purchase || false,
          attachInvoiceImage: data.whatsapp_attach_invoice_image !== false,
          salesMessageTemplate: data.whatsapp_sales_message_template || prev.salesMessageTemplate,
          purchaseMessageTemplate: data.whatsapp_purchase_message_template || prev.purchaseMessageTemplate,
        }));

        if (data.whatsapp_connected && window.electron?.whatsapp) {
          try {
            const status = await window.electron.whatsapp.getStatus();
            if (!status.isReady) {
              autoReconnectWhatsApp();
            } else {
              setWhatsappStatus({
                isConnected: true,
                phoneNumber: status.phoneNumber || data.whatsapp_phone_number,
                connectedAt: data.whatsapp_connected_at,
              });
            }
          } catch (e) {
            autoReconnectWhatsApp();
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoSaveSettings = async (newSettings) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('settings')
          .update({
            whatsapp_auto_send_sales: newSettings.autoSendSales,
            whatsapp_auto_send_purchase: newSettings.autoSendPurchase,
            whatsapp_attach_invoice_image: newSettings.attachInvoiceImage,
            whatsapp_sales_message_template: newSettings.salesMessageTemplate,
            whatsapp_purchase_message_template: newSettings.purchaseMessageTemplate,
          })
          .eq('user_id', userId);

        if (error) throw error;

        toast.success('Saved', {
          duration: 1000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      } catch (error) {
        toast.error('Failed to save', {
          duration: 2000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      }
    }, 800);
  };

  const handleCheckboxChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    autoSaveSettings(newSettings);
  };

  const handleTemplateChange = (value) => {
    const key = selectedTransactionType === 'sales' ? 'salesMessageTemplate' : 'purchaseMessageTemplate';
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    autoSaveSettings(newSettings);
  };

  const handleWhatsAppConnect = () => setShowQRModal(true);

  const handleWhatsAppConnected = async (phoneNumber) => {
    try {
      await supabase
        .from('settings')
        .update({
          whatsapp_connected: true,
          whatsapp_phone_number: phoneNumber,
          whatsapp_connected_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      setWhatsappStatus({
        isConnected: true,
        phoneNumber,
        connectedAt: new Date().toISOString(),
      });
      setShowQRModal(false);

      toast.success('WhatsApp connected successfully!', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleWhatsAppLogout = async () => {
    if (!confirm('Disconnect WhatsApp?')) return;

    try {
      if (window.electron?.whatsapp) await window.electron.whatsapp.logout();

      await supabase
        .from('settings')
        .update({
          whatsapp_connected: false,
          whatsapp_phone_number: null,
          whatsapp_connected_at: null,
        })
        .eq('user_id', userId);

      setWhatsappStatus({ isConnected: false, phoneNumber: null, connectedAt: null });

      toast.success('WhatsApp disconnected', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      toast.error('Failed to disconnect', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('messageTemplate');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = selectedTransactionType === 'sales'
        ? settings.salesMessageTemplate
        : settings.purchaseMessageTemplate;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      handleTemplateChange(newValue);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

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
          <h2 className="text-sm font-semibold text-neutral-900">Transaction Messages</h2>
          <p className="text-[10px] text-neutral-500 mt-0.5">Configure WhatsApp messages for invoices and orders</p>
        </div>
      </div>

      {/* WhatsApp Connection Card */}
      <div className={cn(
        "p-4 rounded-lg border",
        whatsappStatus.isConnected
          ? "bg-green-50/80 border-green-200/60"
          : "bg-neutral-50/80 border-neutral-200/60"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              whatsappStatus.isConnected
                ? "bg-green-500"
                : reconnecting
                ? "bg-amber-500"
                : "bg-neutral-400"
            )}>
              {reconnecting ? (
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
              ) : (
                <WhatsAppIcon className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-neutral-900">WhatsApp</h3>
                {whatsappStatus.isConnected ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[10px] font-medium">
                    <XCircle className="w-3 h-3" />
                    {reconnecting ? 'Reconnecting...' : 'Not Connected'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {whatsappStatus.isConnected
                  ? `+${whatsappStatus.phoneNumber}`
                  : 'Scan QR code to connect your WhatsApp'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={whatsappStatus.isConnected ? handleWhatsAppLogout : handleWhatsAppConnect}
            disabled={reconnecting}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              whatsappStatus.isConnected
                ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                : "bg-neutral-900 text-white hover:bg-neutral-800",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {reconnecting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting</>
            ) : whatsappStatus.isConnected ? (
              <><LogOut className="w-3.5 h-3.5" /> Disconnect</>
            ) : (
              <><Smartphone className="w-3.5 h-3.5" /> Connect</>
            )}
          </button>
        </div>
      </div>

      {/* Settings Options */}
      <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-neutral-900 mb-3">Message Settings</h3>
        <div className="space-y-3">
          {/* Attach PDF */}
          <label className={cn(
            "flex items-center gap-3 cursor-pointer select-none",
            !whatsappStatus.isConnected && "opacity-50 cursor-not-allowed"
          )}>
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
              settings.attachInvoiceImage
                ? "bg-neutral-900 border-neutral-900"
                : "bg-white border-neutral-300"
            )}>
              {settings.attachInvoiceImage && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <input
              type="checkbox"
              checked={settings.attachInvoiceImage}
              onChange={(e) => whatsappStatus.isConnected && handleCheckboxChange('attachInvoiceImage', e.target.checked)}
              disabled={!whatsappStatus.isConnected}
              className="sr-only"
            />
            <div>
              <span className="text-xs font-medium text-neutral-700">Attach Invoice PDF</span>
              <p className="text-[10px] text-neutral-500">Include PDF attachment with the message</p>
            </div>
          </label>

          {/* Auto-send Sales */}
          <label className={cn(
            "flex items-center gap-3 cursor-pointer select-none",
            !whatsappStatus.isConnected && "opacity-50 cursor-not-allowed"
          )}>
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
              settings.autoSendSales
                ? "bg-neutral-900 border-neutral-900"
                : "bg-white border-neutral-300"
            )}>
              {settings.autoSendSales && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <input
              type="checkbox"
              checked={settings.autoSendSales}
              onChange={(e) => whatsappStatus.isConnected && handleCheckboxChange('autoSendSales', e.target.checked)}
              disabled={!whatsappStatus.isConnected}
              className="sr-only"
            />
            <div>
              <span className="text-xs font-medium text-neutral-700">Auto-send Sales Invoice</span>
              <p className="text-[10px] text-neutral-500">Automatically send message when creating sales invoice</p>
            </div>
          </label>

          {/* Auto-send Purchase */}
          <label className={cn(
            "flex items-center gap-3 cursor-pointer select-none",
            !whatsappStatus.isConnected && "opacity-50 cursor-not-allowed"
          )}>
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
              settings.autoSendPurchase
                ? "bg-neutral-900 border-neutral-900"
                : "bg-white border-neutral-300"
            )}>
              {settings.autoSendPurchase && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <input
              type="checkbox"
              checked={settings.autoSendPurchase}
              onChange={(e) => whatsappStatus.isConnected && handleCheckboxChange('autoSendPurchase', e.target.checked)}
              disabled={!whatsappStatus.isConnected}
              className="sr-only"
            />
            <div>
              <span className="text-xs font-medium text-neutral-700">Auto-send Purchase Order</span>
              <p className="text-[10px] text-neutral-500">Automatically send message when creating purchase order</p>
            </div>
          </label>
        </div>
      </div>

      {/* Transaction Type Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedTransactionType('sales')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            selectedTransactionType === 'sales'
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          Sales Invoice
        </button>
        <button
          type="button"
          onClick={() => setSelectedTransactionType('purchase')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            selectedTransactionType === 'purchase'
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          )}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Purchase Order
        </button>
      </div>

      {/* Message Template Editor & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Editor */}
        <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-neutral-100/80 border-b border-neutral-200/60">
            <h3 className="text-xs font-semibold text-neutral-900">Message Template</h3>
          </div>

          {/* Variables */}
          <div className="px-4 py-3 border-b border-neutral-200/60">
            <p className="text-[10px] text-neutral-500 mb-2">Click to insert variable:</p>
            <div className="flex flex-wrap gap-1.5">
              {templateVariables[selectedTransactionType].map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium",
                    "bg-neutral-200 text-neutral-700",
                    "hover:bg-neutral-300",
                    "transition-colors"
                  )}
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="p-4">
            <textarea
              id="messageTemplate"
              value={selectedTransactionType === 'sales' ? settings.salesMessageTemplate : settings.purchaseMessageTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              rows={12}
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-white border border-neutral-200",
                "text-xs text-neutral-800 leading-relaxed",
                "placeholder:text-neutral-400",
                "focus:outline-none focus:ring-1 focus:ring-neutral-900/10",
                "resize-none"
              )}
              placeholder="Type your message template here..."
            />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-neutral-100/80 border-b border-neutral-200/60 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-900">Message Preview</h3>
            <span className="text-[10px] text-neutral-500">Sample data</span>
          </div>

          <div className="p-4">
            {/* Simulated Message */}
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2 bg-green-600 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
                  {selectedTransactionType === 'sales' ? 'AC' : 'XY'}
                </div>
                <div>
                  <p className="text-xs font-medium text-white">
                    {selectedTransactionType === 'sales' ? 'ABC Company Ltd.' : 'XYZ Suppliers'}
                  </p>
                  <p className="text-[10px] text-white/70">online</p>
                </div>
              </div>

              {/* Message Body */}
              <div className="p-3 bg-[#ECE5DD] min-h-[200px]">
                <div className="flex justify-end">
                  <div className="max-w-[90%]">
                    {/* PDF Attachment */}
                    {settings.attachInvoiceImage && (
                      <div className="bg-[#DCF8C6] rounded-t-lg p-2 mb-0.5">
                        <div className="flex items-center gap-2 bg-white/80 rounded-lg p-2">
                          <div className="w-8 h-10 bg-red-500 rounded flex items-center justify-center">
                            <span className="text-white text-[8px] font-bold">PDF</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-medium text-neutral-800 truncate">
                              {selectedTransactionType === 'sales' ? 'Invoice-INV-2024-001.pdf' : 'PO-2024-001.pdf'}
                            </p>
                            <p className="text-[9px] text-neutral-500">12 KB</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Message Text */}
                    <div className={cn(
                      "bg-[#DCF8C6] p-3",
                      settings.attachInvoiceImage ? "rounded-b-lg" : "rounded-lg"
                    )}>
                      <p className="text-[11px] text-neutral-800 whitespace-pre-wrap leading-relaxed">
                        {messagePreview}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1.5">
                        <span className="text-[9px] text-neutral-500">
                          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <Check className="w-3 h-3 text-blue-500" />
                        <Check className="w-3 h-3 text-blue-500 -ml-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Note */}
      {!whatsappStatus.isConnected && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/60">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Connect WhatsApp to enable automatic message sending for your transactions.
          </p>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && (
        <WhatsAppQRModal
          userId={userId}
          onClose={() => setShowQRModal(false)}
          onConnected={handleWhatsAppConnected}
        />
      )}
    </div>
  );
}