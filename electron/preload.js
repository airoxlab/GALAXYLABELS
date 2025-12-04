const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Example: Send message to main process
  send: (channel, data) => {
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // Example: Receive message from main process
  receive: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  // Platform info
  platform: process.platform,

  // WhatsApp API
  whatsapp: {
    // Check if session exists (before init)
    checkSession: (userId) => ipcRenderer.invoke('whatsapp-check-session', userId),

    // Initialize WhatsApp service
    init: (userId) => ipcRenderer.invoke('whatsapp-init', userId),

    // Start WhatsApp (begins QR code generation)
    start: () => ipcRenderer.invoke('whatsapp-start'),

    // Get current QR code if available (for late-joining renderers)
    getQR: () => ipcRenderer.invoke('whatsapp-get-qr'),

    // Get connection status
    getStatus: () => ipcRenderer.invoke('whatsapp-status'),

    // Logout from WhatsApp
    logout: () => ipcRenderer.invoke('whatsapp-logout'),

    // Send text message
    sendMessage: (phoneNumber, message) =>
      ipcRenderer.invoke('whatsapp-send-message', { phoneNumber, message }),

    // Send invoice with optional PDF attachment
    sendInvoice: (phoneNumber, message, pdfBase64, invoiceNo) =>
      ipcRenderer.invoke('whatsapp-send-invoice', { phoneNumber, message, pdfBase64, invoiceNo }),

    // Listen for QR code updates
    onQR: (callback) => {
      ipcRenderer.on('whatsapp-qr', (event, qrCode) => callback(qrCode));
    },

    // Listen for ready event
    onReady: (callback) => {
      ipcRenderer.on('whatsapp-ready', (event, data) => callback(data));
    },

    // Listen for authenticated event
    onAuthenticated: (callback) => {
      ipcRenderer.on('whatsapp-authenticated', () => callback());
    },

    // Listen for auth failure
    onAuthFailure: (callback) => {
      ipcRenderer.on('whatsapp-auth-failure', (event, msg) => callback(msg));
    },

    // Listen for disconnected event
    onDisconnected: (callback) => {
      ipcRenderer.on('whatsapp-disconnected', (event, reason) => callback(reason));
    },

    // Listen for message acknowledgment
    onMessageAck: (callback) => {
      ipcRenderer.on('whatsapp-message-ack', (event, data) => callback(data));
    },

    // Remove all listeners (cleanup)
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('whatsapp-qr');
      ipcRenderer.removeAllListeners('whatsapp-ready');
      ipcRenderer.removeAllListeners('whatsapp-authenticated');
      ipcRenderer.removeAllListeners('whatsapp-auth-failure');
      ipcRenderer.removeAllListeners('whatsapp-disconnected');
      ipcRenderer.removeAllListeners('whatsapp-message-ack');
    }
  }
});
