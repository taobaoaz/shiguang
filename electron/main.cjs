// 拾光 · Electron 主进程 (CommonJS)
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const https = require('https');
const { pathToFileURL } = require('url');
const {
  createNodeGatewayClient,
  createSafeIpcHandler,
} = require('./nodegateway-client.cjs');
const { loadClientToken } = require('./client-token-bridge.cjs');
const { createIntegrationConfigBridge, createSafeIntegrationIpcHandler } = require('./integration-config-bridge.cjs');
const { buildGatewayEnvironment, isAllowedRendererUrl, isTrustedIpcEvent } = require('./security-policy.cjs');

app.commandLine.appendSwitch('disable-http-cache');

const isDev = process.argv.includes('--dev');
const devUrl = 'http://127.0.0.1:3000';
const prodIndexPath = path.resolve(__dirname, '../dist/index.html');
const rendererPolicy = Object.freeze({
  isDev,
  devUrl: `${devUrl}/`,
  prodFileUrl: pathToFileURL(prodIndexPath).toString(),
});
const GITHUB_REPO = 'taobaoaz/shiguang';
const UPDATE_TIMEOUT_MS = 5000;
const MAX_UPDATE_RESPONSE_BYTES = 1024 * 1024;
const RUNTIME_PARTITION = 'shiguang-runtime';
const WORK_DISK_PATH = 'D:\\拾光工作盘';
let gatewayClient = createNodeGatewayClient({});
let mainWindow = null;
const integrationBridge = createIntegrationConfigBridge({
  isDev,
  resourcesPath: process.resourcesPath,
});

function compareVersions(a, b) {
  const parse = (value) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) throw new Error('UPDATE_VERSION_INVALID');
    return match.slice(1).map(Number);
  };
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

function isAllowedReleaseUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && parsed.hostname === 'github.com'
      && parsed.pathname.startsWith(`/${GITHUB_REPO}/releases/`)
      && parsed.username === ''
      && parsed.password === '';
  } catch {
    return false;
  }
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    const request = https.get({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'shiguang-app',
        Accept: 'application/vnd.github+json',
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        finish(new Error('UPDATE_HTTP_FAILED'));
        return;
      }
      let size = 0;
      const chunks = [];
      response.on('data', (chunk) => {
        if (settled) return;
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_UPDATE_RESPONSE_BYTES) {
          request.destroy();
          finish(new Error('UPDATE_RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(bytes);
      });
      response.on('end', () => {
        if (settled) return;
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (
            !json
            || typeof json !== 'object'
            || typeof json.tag_name !== 'string'
            || typeof json.name !== 'string'
            || typeof json.html_url !== 'string'
            || typeof json.published_at !== 'string'
            || !Array.isArray(json.assets)
            || !isAllowedReleaseUrl(json.html_url)
          ) throw new Error('UPDATE_RESPONSE_INVALID');
          compareVersions(json.tag_name, app.getVersion());
          const assets = json.assets.map((asset) => {
            if (
              !asset
              || typeof asset.name !== 'string'
              || typeof asset.browser_download_url !== 'string'
              || !Number.isSafeInteger(asset.size)
              || asset.size < 0
              || !isAllowedReleaseUrl(asset.browser_download_url)
            ) throw new Error('UPDATE_RESPONSE_INVALID');
            return {
              name: asset.name,
              download_url: asset.browser_download_url,
              size: asset.size,
            };
          });
          finish(null, {
            tag_name: json.tag_name,
            name: json.name,
            html_url: json.html_url,
            published_at: json.published_at,
            assets,
          });
        } catch (error) {
          finish(error instanceof Error ? error : new Error('UPDATE_RESPONSE_INVALID'));
        }
      });
      response.on('error', () => finish(new Error('UPDATE_NETWORK_FAILED')));
    });
    request.setTimeout(UPDATE_TIMEOUT_MS, () => {
      request.destroy();
      finish(new Error('UPDATE_TIMEOUT'));
    });
    request.on('error', () => finish(new Error('UPDATE_NETWORK_FAILED')));
  });
}

async function checkForUpdates() {
  try {
    const current = app.getVersion();
    const release = await fetchLatestRelease();
    return {
      currentVersion: current,
      latestVersion: release.tag_name,
      hasUpdate: compareVersions(release.tag_name, current) > 0,
      releaseName: release.name,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      assets: release.assets,
    };
  } catch (error) {
    return {
      currentVersion: app.getVersion(),
      error: error instanceof Error ? error.message : 'UPDATE_CHECK_FAILED',
    };
  }
}

async function initializeGatewayClient() {
  try {
    const token = await loadClientToken({ isDev, env: process.env });
    gatewayClient = createNodeGatewayClient(buildGatewayEnvironment({ isDev, env: process.env, token }));
  } catch (error) {
    const code = error && typeof error.code === 'string' ? error.code : 'TOKEN_BRIDGE_FAILED';
    console.warn(`Shiguang NodeGateway unavailable: ${code}`);
    gatewayClient = createNodeGatewayClient({});
  }
}

function registerIpc() {
  const trusted = (event) => isTrustedIpcEvent(event, mainWindow, rendererPolicy);
  const handlers = {
    'shiguang:gateway:status': createSafeIpcHandler(() => gatewayClient.status(), trusted),
    'shiguang:gateway:pull-state': createSafeIpcHandler(() => gatewayClient.pullState(), trusted),
    'shiguang:gateway:push-state': createSafeIpcHandler((input) => gatewayClient.pushState(input), trusted),
    'shiguang:integrations:status': createSafeIntegrationIpcHandler(() => integrationBridge.status(), trusted),
    'shiguang:integrations:configure': createSafeIntegrationIpcHandler((input) => integrationBridge.configure(input), trusted),
    'shiguang:integrations:test': createSafeIntegrationIpcHandler((input) => integrationBridge.test(input), trusted),
    'shiguang:integrations:start-runtime': createSafeIntegrationIpcHandler(() => integrationBridge.startRuntime(), trusted),
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  }
  ipcMain.removeHandler('check-for-updates');
  ipcMain.handle('check-for-updates', async (event) => {
    if (!trusted(event)) return { currentVersion: app.getVersion(), error: 'UPDATE_IPC_DENIED' };
    return checkForUpdates();
  });
  ipcMain.removeHandler('open-work-disk');
  ipcMain.handle('open-work-disk', async (event) => {
    if (!trusted(event)) return { ok: false, path: WORK_DISK_PATH, error: 'WORK_DISK_IPC_DENIED' };
    const error = await shell.openPath(WORK_DISK_PATH);
    return error ? { ok: false, path: WORK_DISK_PATH, error: 'WORK_DISK_OPEN_FAILED' } : { ok: true, path: WORK_DISK_PATH };
  });
}

function isAllowedAppNavigation(url) {
  return isAllowedRendererUrl(url, rendererPolicy);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: '拾光',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
      partition: RUNTIME_PARTITION,
    },
  });

  if (isDev) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(prodIndexPath);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppNavigation(url)) event.preventDefault();
  });
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedAppNavigation(url)) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedReleaseUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await initializeGatewayClient();
  const runtimeSession = session.fromPartition(RUNTIME_PARTITION);
  await runtimeSession.clearCache();
  runtimeSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  runtimeSession.setPermissionCheckHandler(() => false);
  registerIpc();
  createWindow();
  setTimeout(async () => {
    const result = await checkForUpdates();
    if (result.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        releaseName: result.releaseName,
        releaseUrl: result.releaseUrl,
      });
    }
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
