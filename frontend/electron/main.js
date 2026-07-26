const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let backendProcess;

function startBackendServer() {
  const backendPath = path.join(__dirname, '..', '..', 'backend', 'server.js');
  console.log('🚀 Electron: Starting Node.js Backend Server at:', backendPath);

  const env = Object.assign({}, process.env, {
    PORT: '4000',
    HOST: '0.0.0.0',
    USE_APPDATA: 'true',
    NODE_ENV: 'production'
  });

  backendProcess = fork(backendPath, [], {
    env,
    stdio: 'inherit'
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Electron Backend Process Error:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'KOS - Sistema de Atendimento Local',
    icon: path.join(__dirname, '..', 'public', 'pwa-192x192.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenu(null); // Remove default browser menu bar for sleek SaaS desktop look

  // Wait 1.5 seconds for backend server startup before loading URL
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:4000').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
  }, 1500);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    try { backendProcess.kill(); } catch (e) {}
  }
  if (process.platform !== 'darwin') app.quit();
});
