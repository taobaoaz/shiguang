// 拾光 · Electron 主进程 (CommonJS)
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const https = require('https');

const isDev = process.argv.includes('--dev');
let mainWindow = null;

// ── 更新检查 ──────────────────────────────────────────────
const GITHUB_REPO = 'taobaoaz/shiguang';

function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'shiguang-app',
        'Accept': 'application/vnd.github+json',
      },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.message) return reject(new Error(json.message));
          resolve({
            tag_name: json.tag_name,
            name: json.name,
            html_url: json.html_url,
            published_at: json.published_at,
            body: json.body,
            assets: (json.assets || []).map(a => ({
              name: a.name,
              download_url: a.browser_download_url,
              size: a.size,
            })),
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

ipcMain.handle('check-for-updates', async () => {
  try {
    const current = app.getVersion();
    const release = await fetchLatestRelease();
    const latest = release.tag_name;
    const hasUpdate = compareVersions(latest, current) > 0;
    return {
      currentVersion: current,
      latestVersion: latest,
      hasUpdate,
      releaseName: release.name,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      assets: release.assets,
    };
  } catch (err) {
    return {
      currentVersion: app.getVersion(),
      error: err.message,
    };
  }
});

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
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  // 启动后自动检查更新（延迟 3 秒等待窗口就绪）
  setTimeout(async () => {
    try {
      const release = await fetchLatestRelease();
      const current = app.getVersion();
      if (compareVersions(release.tag_name, current) > 0 && mainWindow) {
        mainWindow.webContents.send('update-available', {
          currentVersion: current,
          latestVersion: release.tag_name,
          releaseName: release.name,
          releaseUrl: release.html_url,
        });
      }
    } catch (_) { /* 静默失败 */ }
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
