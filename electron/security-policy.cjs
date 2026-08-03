const SAFE_HASH = /^#[A-Za-z0-9/_?=&.%:-]{0,512}$/;
const GATEWAY_OVERRIDE_KEYS = Object.freeze([
  'SHIGUANG_NODEGATEWAY_BASE_URL',
  'SHIGUANG_NODE_ID',
  'SHIGUANG_AGENT_INSTANCE_ID',
  'SHIGUANG_WORKSPACE_ID',
  'SHIGUANG_VIEW_ID',
  'SHIGUANG_NODEGATEWAY_TIMEOUT_MS',
]);

function buildGatewayEnvironment({ isDev, env, token }) {
  const source = env && typeof env === 'object' ? env : {};
  if (!isDev && GATEWAY_OVERRIDE_KEYS.some((key) => source[key] !== undefined && source[key] !== '')) {
    const error = new Error('PRODUCTION_GATEWAY_OVERRIDE_FORBIDDEN');
    error.code = 'PRODUCTION_GATEWAY_OVERRIDE_FORBIDDEN';
    throw error;
  }
  if (!isDev) {
    return Object.freeze({
      SHIGUANG_NODEGATEWAY_BASE_URL: 'http://127.0.0.1:8765',
      SHIGUANG_NODEGATEWAY_TOKEN: token,
      SHIGUANG_NODE_ID: 'home-pc-01',
      SHIGUANG_AGENT_INSTANCE_ID: 'home-pc-01/shiguang/main',
      SHIGUANG_WORKSPACE_ID: 'personal-workbench',
      SHIGUANG_VIEW_ID: 'shared-three-side',
      SHIGUANG_NODEGATEWAY_TIMEOUT_MS: '5000',
    });
  }
  return Object.freeze({
    SHIGUANG_NODEGATEWAY_BASE_URL: source.SHIGUANG_NODEGATEWAY_BASE_URL || 'http://127.0.0.1:8765',
    SHIGUANG_NODEGATEWAY_TOKEN: token,
    SHIGUANG_NODE_ID: source.SHIGUANG_NODE_ID,
    SHIGUANG_AGENT_INSTANCE_ID: source.SHIGUANG_AGENT_INSTANCE_ID,
    SHIGUANG_WORKSPACE_ID: source.SHIGUANG_WORKSPACE_ID,
    SHIGUANG_VIEW_ID: source.SHIGUANG_VIEW_ID,
    SHIGUANG_NODEGATEWAY_TIMEOUT_MS: source.SHIGUANG_NODEGATEWAY_TIMEOUT_MS,
  });
}

function isAllowedRendererUrl(url, policy) {
  if (typeof url !== 'string' || !policy || typeof policy !== 'object') return false;
  const expected = policy.isDev ? policy.devUrl : policy.prodFileUrl;
  if (typeof expected !== 'string') return false;
  let parsed;
  let expectedUrl;
  try {
    parsed = new URL(url);
    expectedUrl = new URL(expected);
  } catch {
    return false;
  }
  const hash = parsed.hash;
  parsed.hash = '';
  expectedUrl.hash = '';
  return parsed.toString() === expectedUrl.toString() && (hash === '' || SAFE_HASH.test(hash));
}

function isTrustedIpcEvent(event, mainWindow, policy) {
  if (!event || !mainWindow || typeof mainWindow.isDestroyed !== 'function' || mainWindow.isDestroyed()) return false;
  const webContents = mainWindow.webContents;
  if (!webContents || typeof webContents.isDestroyed !== 'function' || webContents.isDestroyed()) return false;
  if (event.sender !== webContents || event.senderFrame !== webContents.mainFrame) return false;
  return isAllowedRendererUrl(event.senderFrame && event.senderFrame.url, policy);
}

module.exports = { buildGatewayEnvironment, isAllowedRendererUrl, isTrustedIpcEvent };
