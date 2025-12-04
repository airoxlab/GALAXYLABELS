'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X, RefreshCw, Smartphone, Check, AlertCircle } from 'lucide-react';

// WhatsApp SVG Icon
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function WhatsAppQRModal({ userId, onClose, onConnected }) {
  const [status, setStatus] = useState('initializing'); // initializing, loading, qr, authenticated, connected, error
  const [qrCode, setQrCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(null);
  const initStarted = useRef(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    // Initialize WhatsApp when modal opens
    initializeWhatsApp();

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (window.electron?.whatsapp) {
        window.electron.whatsapp.removeAllListeners();
      }
    };
  }, []);

  const initializeWhatsApp = async () => {
    if (initStarted.current) return;
    initStarted.current = true;

    // Check if running in Electron
    if (!window.electron?.whatsapp) {
      setStatus('error');
      setErrorMessage('WhatsApp integration requires the desktop app. Please run in Electron.');
      return;
    }

    try {
      setStatus('initializing');

      // First remove any existing listeners to avoid duplicates
      window.electron.whatsapp.removeAllListeners();

      // Setup event listeners BEFORE initializing
      window.electron.whatsapp.onQR((qr) => {
        console.log('QR received in modal, setting state');
        setQrCode(qr);
        setStatus('qr');
      });

      window.electron.whatsapp.onAuthenticated(() => {
        console.log('WhatsApp authenticated');
        setStatus('authenticated');
      });

      window.electron.whatsapp.onReady((data) => {
        console.log('WhatsApp ready:', data);
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);
        // Notify parent after a short delay
        setTimeout(() => {
          onConnected(data.phoneNumber);
        }, 1500);
      });

      window.electron.whatsapp.onAuthFailure((msg) => {
        console.log('WhatsApp auth failure:', msg);
        setStatus('error');
        setErrorMessage(msg || 'Authentication failed. Please try again.');
      });

      window.electron.whatsapp.onDisconnected((reason) => {
        console.log('WhatsApp disconnected:', reason);
        setStatus('error');
        setErrorMessage(reason || 'WhatsApp disconnected. Please try again.');
      });

      // Small delay to ensure listeners are ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize the service
      console.log('Initializing WhatsApp service...');
      const initResult = await window.electron.whatsapp.init(userId);
      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize WhatsApp');
      }

      // Start the client (will trigger QR code)
      setStatus('loading');
      console.log('Starting WhatsApp client...');
      const startResult = await window.electron.whatsapp.start();

      // If start fails but is retryable, still continue and poll for QR
      if (!startResult.success && !startResult.retryable) {
        throw new Error(startResult.error || 'Failed to start WhatsApp');
      }

      if (startResult.message === 'Already initializing' || startResult.message === 'Already connected') {
        console.log('WhatsApp already running:', startResult.message);
      } else {
        console.log('WhatsApp client started, waiting for QR...');
      }

      // Start continuous polling for connection status
      // This handles both initial QR fetch AND detecting when user scans QR
      const startConnectionPolling = () => {
        let qrDisplayed = false;

        pollIntervalRef.current = setInterval(async () => {
          try {
            // Always check connection status first
            const statusResult = await window.electron.whatsapp.getStatus();
            if (statusResult.isReady) {
              console.log('WhatsApp is connected! Phone:', statusResult.phoneNumber);
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              setStatus('connected');
              setPhoneNumber(statusResult.phoneNumber || 'Connected');
              setTimeout(() => {
                onConnected(statusResult.phoneNumber || 'Connected');
              }, 1500);
              return;
            }

            // If not connected, check for QR code (only if not already displayed)
            if (!qrDisplayed) {
              const qrResult = await window.electron.whatsapp.getQR();
              if (qrResult.success && qrResult.qrCode) {
                console.log('Got QR code via polling');
                setQrCode(qrResult.qrCode);
                setStatus('qr');
                qrDisplayed = true;
              }
            }
          } catch (err) {
            console.log('Poll error:', err.message);
          }
        }, 1000); // Poll every 1 second
      };

      // Start polling after a short delay
      setTimeout(startConnectionPolling, 500);
    } catch (error) {
      console.error('WhatsApp initialization error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to initialize WhatsApp');
    }
  };

  const handleRetry = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    initStarted.current = false;
    setStatus('initializing');
    setQrCode(null);
    setErrorMessage('');
    initializeWhatsApp();
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={cn(
        "bg-white rounded-xl shadow-xl",
        "w-full max-w-md",
        "overflow-hidden",
        "my-auto"
      )}>
        {/* Header */}
        <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5" />
            <h2 className="text-sm font-semibold">Connect WhatsApp</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Initializing State */}
          {status === 'initializing' && (
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 text-green-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-sm font-medium text-neutral-900 mb-1">Initializing WhatsApp...</h3>
              <p className="text-xs text-neutral-500">Please wait while we set up the connection</p>
            </div>
          )}

          {/* Loading State */}
          {status === 'loading' && (
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 text-green-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-sm font-medium text-neutral-900 mb-1">Loading QR Code...</h3>
              <p className="text-xs text-neutral-500">This may take a few moments</p>
            </div>
          )}

          {/* QR Code State */}
          {status === 'qr' && qrCode && (
            <div className="text-center">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-neutral-900 mb-1">Scan QR Code</h3>
                <p className="text-xs text-neutral-500">
                  Open WhatsApp on your phone and scan this QR code
                </p>
              </div>

              <div className="inline-block p-4 bg-white border-2 border-green-200 rounded-xl shadow-lg">
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56"
                />
              </div>

              <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
                <h4 className="text-xs font-medium text-neutral-700 mb-2">How to scan:</h4>
                <ol className="text-[10px] text-neutral-600 text-left space-y-1">
                  <li>1. Open WhatsApp on your phone</li>
                  <li>2. Tap <strong>Menu</strong> or <strong>Settings</strong></li>
                  <li>3. Tap <strong>Linked Devices</strong></li>
                  <li>4. Point your phone at this screen to scan the code</li>
                </ol>
              </div>
            </div>
          )}

          {/* Authenticated State */}
          {status === 'authenticated' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-sm font-medium text-neutral-900 mb-1">Authenticated!</h3>
              <p className="text-xs text-neutral-500">Connecting to WhatsApp...</p>
            </div>
          )}

          {/* Connected State */}
          {status === 'connected' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-sm font-medium text-neutral-900 mb-1">Connected Successfully!</h3>
              <p className="text-xs text-neutral-500">
                WhatsApp is now linked to {phoneNumber}
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                Closing this window...
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-sm font-medium text-neutral-900 mb-1">Connection Failed</h3>
              <p className="text-xs text-red-600 mb-4">{errorMessage}</p>
              <button
                onClick={handleRetry}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg mx-auto",
                  "bg-green-600 text-white",
                  "text-xs font-medium",
                  "hover:bg-green-700",
                  "transition-all duration-200"
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status !== 'connected' && (
          <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200/60">
            <p className="text-[10px] text-neutral-500 text-center">
              Your session will be saved securely. You won&apos;t need to scan again unless you logout.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
