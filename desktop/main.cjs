const { app, BrowserWindow, protocol, net, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'hls', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const appURL = 'hls://studio/app.html';
let mainWindow;
let windowReady = false;
const installerMarkers = new Set();

function acknowledgeInstallerLaunch(argv) {
  const marker = argv.find(argument => argument.startsWith('--hls-installer-ready='));
  if (marker) installerMarkers.add(marker.slice('--hls-installer-ready='.length));
  if (!windowReady || !mainWindow || mainWindow.isDestroyed()) return;
  for (const filename of installerMarkers) {
    try { fs.writeFileSync(filename, 'ready'); } catch { /* Setup has a bounded fallback. */ }
  }
  installerMarkers.clear();
}
acknowledgeInstallerLaunch(process.argv);

function openExternal(url) {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol)) void shell.openExternal(url);
  } catch { /* Ignore malformed links. */ }
}

function createWindow() {
  windowReady = false;
  mainWindow = new BrowserWindow({
    title: 'Hoop League Studio', width: 1440, height: 960,
    minWidth: 900, minHeight: 640, backgroundColor: '#071a2b',
    icon: path.join(__dirname, '..', 'assets', 'images', 'icons', 'favicon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false }
  });
  mainWindow.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      title: 'Unsaved changes',
      message: 'Discard unsaved changes?',
      detail: 'Save or export your league first if you want to keep your latest edits.',
      buttons: ['Keep editing', 'Discard changes'],
      defaultId: 0,
      cancelId: 0
    });
    // Electron cancels the unload unless this event is prevented.
    if (choice === 1) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    if (target.protocol !== 'hls:' || target.hostname !== 'studio') {
      event.preventDefault();
      openExternal(url);
    }
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
  ]));
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.show();
    windowReady = true;
    acknowledgeInstallerLaunch([]);
  });
  void mainWindow.loadURL(appURL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    acknowledgeInstallerLaunch(argv);
  });
  app.whenReady().then(() => {
    const root = app.getAppPath();
    protocol.handle('hls', request => {
      const url = new URL(request.url);
      if (url.hostname !== 'studio') return new Response('Not found', { status: 404 });
      const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      const relative = path.relative(root, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(filename).href);
    });
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
