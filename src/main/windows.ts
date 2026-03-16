import { BrowserWindow, screen } from 'electron';
import path from 'path';

let dashboardWindow: BrowserWindow | null = null;
let searchWindow: BrowserWindow | null = null;

const isDev = !require('electron').app.isPackaged;

function getPreloadPath(): string {
  return path.join(__dirname, '../preload/index.js');
}

export function createDashboardWindow(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return dashboardWindow;
  }

  dashboardWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '../../resources/icon.ico'),
  });

  if (isDev) {
    dashboardWindow.loadURL('http://localhost:5173');
    dashboardWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    dashboardWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow?.show();
  });

  dashboardWindow.on('close', (e) => {
    // Hide instead of close — app stays in tray
    e.preventDefault();
    dashboardWindow?.hide();
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  return dashboardWindow;
}

export function getDashboardWindow(): BrowserWindow | null {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    return dashboardWindow;
  }
  return null;
}

export function createSearchWindow(): BrowserWindow {
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.show();
    searchWindow.focus();
    return searchWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  searchWindow = new BrowserWindow({
    width: 600,
    height: 80,
    x: Math.round((screenWidth - 600) / 2),
    y: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Search overlay will load a separate route
  if (isDev) {
    searchWindow.loadURL('http://localhost:5173/#/search-overlay');
  } else {
    searchWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/search-overlay',
    });
  }

  searchWindow.on('blur', () => {
    searchWindow?.hide();
  });

  searchWindow.on('closed', () => {
    searchWindow = null;
  });

  return searchWindow;
}

export function getSearchWindow(): BrowserWindow | null {
  if (searchWindow && !searchWindow.isDestroyed()) {
    return searchWindow;
  }
  return null;
}

export function resizeSearchWindow(resultCount: number): void {
  if (!searchWindow || searchWindow.isDestroyed()) return;
  const baseHeight = 80;
  const itemHeight = 48;
  const footerHeight = resultCount > 0 ? 36 : 0;
  const newHeight = Math.min(baseHeight + (resultCount * itemHeight) + footerHeight, 500);
  searchWindow.setSize(600, newHeight);
}

export function destroyAllWindows(): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.removeAllListeners('close');
    dashboardWindow.close();
  }
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.close();
  }
}
