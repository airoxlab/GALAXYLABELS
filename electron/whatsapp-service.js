/**
 * WhatsApp Service for Electron
 * Uses whatsapp-web.js to handle WhatsApp Web automation
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.isInitializing = false;
    this.qrCode = null;
    this.phoneNumber = null;
    this.mainWindow = null;
    this.sessionPath = null;
    this.userId = null;
    this.hasExistingSession = false;
  }

  /**
   * Check if a session exists for the given user
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  checkSessionExists(userId) {
    const sessionDir = path.join(__dirname, '..', '.wwebjs_auth', `session-user-${userId}`);
    return fs.existsSync(sessionDir);
  }

  /**
   * Initialize the WhatsApp client
   * @param {BrowserWindow} mainWindow - Electron main window for IPC
   * @param {string} userId - User ID for session isolation
   */
  async initialize(mainWindow, userId) {
    this.mainWindow = mainWindow;
    this.userId = userId;
    this.sessionPath = path.join(__dirname, '..', '.wwebjs_auth', `session-user-${userId}`);

    // Ensure session directory exists
    const authDir = path.join(__dirname, '..', '.wwebjs_auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Check if we have an existing session
    this.hasExistingSession = this.checkSessionExists(userId);
    console.log('Existing session found:', this.hasExistingSession);

    // If client already exists and ready, just return
    if (this.client && this.isReady) {
      console.log('WhatsApp already initialized and ready');
      return this;
    }

    // If client exists but not ready, destroy it first
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        console.log('Error destroying existing client:', e.message);
      }
      this.client = null;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: `user-${userId}`,
        dataPath: path.join(__dirname, '..', '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    this.setupEventListeners();

    return this;
  }

  /**
   * Setup WhatsApp client event listeners
   */
  setupEventListeners() {
    // QR Code event - emit to renderer
    this.client.on('qr', async (qr) => {
      console.log('QR Code received from WhatsApp');
      try {
        // Generate QR code as data URL
        this.qrCode = await qrcode.toDataURL(qr, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        console.log('QR code generated as data URL, length:', this.qrCode?.length);

        // Send to renderer - add a small delay to ensure renderer is ready
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          // Use a small delay to make sure the renderer's IPC listeners are set up
          setTimeout(() => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              console.log('Sending QR code to renderer...');
              this.mainWindow.webContents.send('whatsapp-qr', this.qrCode);
            }
          }, 200);
        } else {
          console.log('Main window not available for QR send');
        }
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    });

    // Ready event - WhatsApp is connected
    this.client.on('ready', async () => {
      console.log('WhatsApp client is ready!');
      this.isReady = true;
      this.isInitializing = false;
      this.qrCode = null;

      try {
        // Get connected phone number - with multiple retry attempts
        let phoneNumber = 'Connected';

        // Try multiple times to get the info
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));

          if (this.client && this.client.info) {
            console.log('Client info attempt', i + 1, ':', JSON.stringify(this.client.info?.wid || {}));

            if (this.client.info.wid) {
              // Try different ways to get the phone number
              phoneNumber = this.client.info.wid.user
                || this.client.info.wid._serialized?.split('@')[0]
                || this.client.info.me?.user
                || 'Connected';

              if (phoneNumber !== 'Connected') {
                console.log('Got phone number:', phoneNumber);
                break;
              }
            }
          }
        }

        this.phoneNumber = phoneNumber;
        console.log('Final connected phone number:', this.phoneNumber);

        // Send status to renderer
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('whatsapp-ready', {
            connected: true,
            phoneNumber: this.phoneNumber
          });
        }
      } catch (err) {
        console.error('Error getting WhatsApp info:', err);
        // Still mark as ready even if we can't get phone number
        this.phoneNumber = 'Connected';
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('whatsapp-ready', {
            connected: true,
            phoneNumber: 'Connected'
          });
        }
      }
    });

    // Authentication event
    this.client.on('authenticated', () => {
      console.log('WhatsApp authenticated');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('whatsapp-authenticated');
      }
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp auth failure:', msg);
      this.isReady = false;
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('whatsapp-auth-failure', msg);
      }
    });

    // Disconnected event
    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason);
      this.isReady = false;
      this.phoneNumber = null;
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('whatsapp-disconnected', reason);
      }
    });

    // Message acknowledgment
    this.client.on('message_ack', (msg, ack) => {
      // ack: 1 = sent, 2 = delivered, 3 = read
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('whatsapp-message-ack', {
          messageId: msg.id._serialized,
          ack
        });
      }
    });
  }

  /**
   * Start the WhatsApp client
   */
  async start() {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    // If already initializing or ready, don't start again
    if (this.isInitializing) {
      console.log('WhatsApp client is already initializing...');
      return { success: true, message: 'Already initializing' };
    }

    if (this.isReady) {
      console.log('WhatsApp client is already ready');
      return { success: true, message: 'Already connected' };
    }

    try {
      this.isInitializing = true;
      console.log('Starting WhatsApp client initialization...');

      // Initialize with a timeout
      const initPromise = this.client.initialize();

      await initPromise;

      console.log('WhatsApp client initialization completed');
      return { success: true };
    } catch (err) {
      console.error('Error starting WhatsApp client:', err);
      this.isInitializing = false;

      // Check if it's a context destroyed error - this usually means we need to retry
      if (err.message?.includes('context') || err.message?.includes('destroyed')) {
        return { success: false, error: 'WhatsApp is loading, please wait and try again', retryable: true };
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * Stop and logout from WhatsApp
   */
  async logout() {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      // First destroy the client to release file locks
      try {
        await this.client.destroy();
      } catch (destroyErr) {
        console.log('Error destroying client (expected):', destroyErr.message);
      }

      this.isReady = false;
      this.phoneNumber = null;
      this.qrCode = null;
      this.client = null;

      // Clean up session files after a delay to ensure file locks are released
      setTimeout(() => {
        try {
          if (this.sessionPath && fs.existsSync(this.sessionPath)) {
            fs.rmSync(this.sessionPath, { recursive: true, force: true });
            console.log('Session files cleaned up');
          }
        } catch (cleanupErr) {
          console.log('Could not clean session files:', cleanupErr.message);
        }
      }, 2000);

      return { success: true };
    } catch (err) {
      console.error('Error logging out:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Destroy client without logout (keeps session)
   */
  async destroy() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.error('Error destroying client:', err);
      }
      this.client = null;
      this.isReady = false;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      phoneNumber: this.phoneNumber,
      hasQR: !!this.qrCode,
      hasExistingSession: this.hasExistingSession
    };
  }

  /**
   * Check if a session exists (can be called before init)
   * @param {string} userId - User ID
   */
  static hasSession(userId) {
    const sessionDir = path.join(__dirname, '..', '.wwebjs_auth', `session-user-${userId}`);
    return fs.existsSync(sessionDir);
  }

  /**
   * Get current QR code (for late-joining renderers)
   */
  getCurrentQR() {
    return this.qrCode;
  }

  /**
   * Send a text message
   * @param {string} phoneNumber - Phone number with country code (e.g., 923001234567)
   * @param {string} message - Text message to send
   */
  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      return { success: false, error: 'WhatsApp not connected' };
    }

    try {
      // Format phone number (remove + and spaces)
      const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
      const chatId = `${formattedNumber}@c.us`;

      // Check if number exists on WhatsApp
      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        return { success: false, error: 'Number not registered on WhatsApp' };
      }

      // Send message
      const result = await this.client.sendMessage(chatId, message);

      return {
        success: true,
        messageId: result.id._serialized,
        timestamp: result.timestamp
      };
    } catch (err) {
      console.error('Error sending message:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a message with media (image/PDF)
   * @param {string} phoneNumber - Phone number with country code
   * @param {string} message - Caption/message text
   * @param {Buffer|string} media - File buffer or base64 string
   * @param {string} filename - Filename for the media
   * @param {string} mimetype - MIME type (e.g., 'application/pdf', 'image/png')
   */
  async sendMessageWithMedia(phoneNumber, message, media, filename, mimetype) {
    if (!this.isReady) {
      return { success: false, error: 'WhatsApp not connected' };
    }

    try {
      // Format phone number
      const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
      const chatId = `${formattedNumber}@c.us`;

      // Check if number exists on WhatsApp
      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        return { success: false, error: 'Number not registered on WhatsApp' };
      }

      // Create MessageMedia
      let messageMedia;
      if (Buffer.isBuffer(media)) {
        messageMedia = new MessageMedia(mimetype, media.toString('base64'), filename);
      } else {
        // Assume it's already base64
        messageMedia = new MessageMedia(mimetype, media, filename);
      }

      // Send media with caption
      const result = await this.client.sendMessage(chatId, messageMedia, {
        caption: message
      });

      return {
        success: true,
        messageId: result.id._serialized,
        timestamp: result.timestamp
      };
    } catch (err) {
      console.error('Error sending media message:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send invoice to customer
   * @param {object} params - Invoice parameters
   */
  async sendInvoice({ phoneNumber, message, pdfBuffer, invoiceNo }) {
    if (!pdfBuffer) {
      // Send just text message
      return await this.sendMessage(phoneNumber, message);
    }

    // Send with PDF attachment
    return await this.sendMessageWithMedia(
      phoneNumber,
      message,
      pdfBuffer,
      `Invoice-${invoiceNo}.pdf`,
      'application/pdf'
    );
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new WhatsAppService();
    }
    return instance;
  },
  WhatsAppService
};
