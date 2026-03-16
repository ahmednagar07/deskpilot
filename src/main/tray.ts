import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { createDashboardWindow, getDashboardWindow } from './windows';

let tray: Tray | null = null;

export function createTray(): Tray {
  // Create a simple 16x16 icon programmatically (blue square with white "D")
  // In production, replace with a proper .ico/.png from resources/
  const iconPath = path.join(__dirname, '../../resources/tray-icon.png');
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback: create a tiny colored icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.isEmpty() ? createFallbackIcon() : icon);
  tray.setToolTip('DeskPilot — Desktop Manager');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        const win = getDashboardWindow();
        if (win) {
          win.show();
          win.focus();
        } else {
          createDashboardWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quick Scan Desktop',
      click: () => {
        // TODO: Trigger desktop scan
        const win = getDashboardWindow() ?? createDashboardWindow();
        win.show();
        win.focus();
      },
    },
    {
      label: 'Quick Scan Downloads',
      click: () => {
        // TODO: Trigger downloads scan
        const win = getDashboardWindow() ?? createDashboardWindow();
        win.show();
        win.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit DeskPilot',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    const win = getDashboardWindow();
    if (win) {
      win.show();
      win.focus();
    } else {
      createDashboardWindow();
    }
  });

  return tray;
}

function createFallbackIcon(): Electron.NativeImage {
  // 16x16 PNG: solid blue square
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = 59;     // R
    buffer[i * 4 + 1] = 130; // G
    buffer[i * 4 + 2] = 246; // B
    buffer[i * 4 + 3] = 255; // A
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

export function getTray(): Tray | null {
  return tray;
}
