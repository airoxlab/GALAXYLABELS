const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let whatsappService = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  // Load the Next.js app
  if (isDev) {
    // In development, load from the Next.js dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the built Next.js app
    mainWindow.loadURL('http://localhost:3000');
  }

  // Remove menu bar (optional - comment out if you want the menu)
  mainWindow.setMenuBarVisibility(false);

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC handlers for WhatsApp
function setupWhatsAppIPC() {
  // Check if session exists (before init)
  ipcMain.handle('whatsapp-check-session', async (event, userId) => {
    try {
      const { WhatsAppService } = require('./whatsapp-service');
      const hasSession = WhatsAppService.hasSession(userId);
      return { success: true, hasSession };
    } catch (err) {
      console.error('Error checking session:', err);
      return { success: false, hasSession: false };
    }
  });

  // Initialize WhatsApp service
  ipcMain.handle('whatsapp-init', async (event, userId) => {
    try {
      const { getInstance } = require('./whatsapp-service');
      whatsappService = getInstance();
      await whatsappService.initialize(mainWindow, userId);
      return { success: true, hasExistingSession: whatsappService.hasExistingSession };
    } catch (err) {
      console.error('Error initializing WhatsApp:', err);
      return { success: false, error: err.message };
    }
  });

  // Start WhatsApp (shows QR)
  ipcMain.handle('whatsapp-start', async () => {
    if (!whatsappService) {
      return { success: false, error: 'Service not initialized' };
    }
    return await whatsappService.start();
  });

  // Get current QR code if available
  ipcMain.handle('whatsapp-get-qr', async () => {
    if (!whatsappService) {
      return { success: false, qrCode: null };
    }
    const qrCode = whatsappService.getCurrentQR();
    return { success: !!qrCode, qrCode };
  });

  // Get WhatsApp status
  ipcMain.handle('whatsapp-status', async () => {
    if (!whatsappService) {
      return { isReady: false, phoneNumber: null, hasQR: false };
    }
    return whatsappService.getStatus();
  });

  // Logout from WhatsApp
  ipcMain.handle('whatsapp-logout', async () => {
    if (!whatsappService) {
      return { success: false, error: 'Service not initialized' };
    }
    return await whatsappService.logout();
  });

  // Send text message
  ipcMain.handle('whatsapp-send-message', async (event, { phoneNumber, message }) => {
    if (!whatsappService) {
      return { success: false, error: 'Service not initialized' };
    }
    return await whatsappService.sendMessage(phoneNumber, message);
  });

  // Send message with media (PDF/Image)
  ipcMain.handle('whatsapp-send-invoice', async (event, { phoneNumber, message, pdfBase64, invoiceNo }) => {
    if (!whatsappService) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      let pdfBuffer = null;
      if (pdfBase64) {
        pdfBuffer = Buffer.from(pdfBase64, 'base64');
      }

      return await whatsappService.sendInvoice({
        phoneNumber,
        message,
        pdfBuffer,
        invoiceNo
      });
    } catch (err) {
      console.error('Error sending invoice:', err);
      return { success: false, error: err.message };
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  setupWhatsAppIPC();

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked and no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', async () => {
  if (whatsappService) {
    await whatsappService.destroy();
  }
});
