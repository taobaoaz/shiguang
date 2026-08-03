const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const fs = require('node:fs');

const {
  ENDPOINTS,
  createNodeGatewayClient,
  createSafeIpcHandler,
  uuid7,
  validateConfig,
  validateContentInput,
  validatePushVersionInput,
} = require('./nodegateway-client.cjs');
const { buildGatewayEnvironment, isAllowedRendererUrl, isTrustedIpcEvent } = require('./security-policy.cjs');

const TOKEN = 'x'.repeat(48);
const ENV = {
  SHIGUANG_NODEGATEWAY_BASE_URL: 'http://127.0.0.1:8765',
  SHIGUANG_NODEGATEWAY_TOKEN: TOKEN,
  SHIGUANG_NODE_ID: 'home-pc-01',
  SHIGUANG_AGENT_INSTANCE_ID: 'home-pc-01/shiguang/main',
  SHIGUANG_WORKSPACE_ID: 'personal-workbench',
  SHIGUANG_VIEW_ID: 'shared-three-side',
};
const README = '# PAW 全局 Agent 初始化 README\n每次启动必须完整读取。\n';
const README_DIGEST = `sha256:${crypto.createHash('sha256').update(Buffer.from(README)).digest('hex')}`;
const VERSION = `sha256:${'b'.repeat(64)}`;

test('production gateway configuration is fixed and rejects every endpoint or identity override', () => {
  const fixed = buildGatewayEnvironment({ isDev: false, env: {}, token: TOKEN });
  assert.deepEqual(fixed, {
    SHIGUANG_NODEGATEWAY_BASE_URL: 'http://127.0.0.1:8765',
    SHIGUANG_NODEGATEWAY_TOKEN: TOKEN,
    SHIGUANG_NODE_ID: 'home-pc-01',
    SHIGUANG_AGENT_INSTANCE_ID: 'home-pc-01/shiguang/main',
    SHIGUANG_WORKSPACE_ID: 'personal-workbench',
    SHIGUANG_VIEW_ID: 'shared-three-side',
    SHIGUANG_NODEGATEWAY_TIMEOUT_MS: '5000',
  });
  for (const key of [
    'SHIGUANG_NODEGATEWAY_BASE_URL', 'SHIGUANG_NODE_ID',
    'SHIGUANG_AGENT_INSTANCE_ID', 'SHIGUANG_WORKSPACE_ID',
    'SHIGUANG_VIEW_ID', 'SHIGUANG_NODEGATEWAY_TIMEOUT_MS',
  ]) {
    assert.throws(
      () => buildGatewayEnvironment({ isDev: false, env: { [key]: 'polluted' }, token: TOKEN }),
      (error) => error.code === 'PRODUCTION_GATEWAY_OVERRIDE_FORBIDDEN',
    );
  }
});

function jsonResponse(value, status = 200) {
  const body = JSON.stringify(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(body)),
    }),
    async text() { return body; },
  };
}

function bootstrap() {
  return {
    schema_version: 'paw.global-readme-bootstrap.v1',
    challenge_id: uuid7(),
    gateway_boot_generation: 3,
    global_readme_sha256: README_DIGEST,
    size: Buffer.byteLength(README),
    content: README,
    issued_at: '2026-08-02T00:00:00Z',
    expires_at: '2026-08-02T00:05:00Z',
    direct_cos_access: false,
  };
}

function receipt(challenge, requestBody) {
  return {
    agent_instance_id: 'home-pc-01/shiguang/main',
    agent_boot_id: requestBody.agent_boot_id,
    global_readme_sha256: challenge.global_readme_sha256,
    gateway_boot_generation: 3,
    receipt_digest: `sha256:${'c'.repeat(64)}`,
    replayed: false,
  };
}

function snapshot(files = []) {
  return {
    schema_version: 'paw.shiguang.workspace-snapshot.v1',
    workspace_id: 'personal-workbench',
    view_id: 'shared-three-side',
    generation: 4,
    manifest_digest: `sha256:${'d'.repeat(64)}`,
    files,
  };
}

function versionReceipt(fileId = 'shiguang-state') {
  return {
    workspace_id: 'personal-workbench',
    file_id: fileId,
    version_id: VERSION,
    event_id: 'event:shiguang:1',
    event_hash: `sha256:${'e'.repeat(64)}`,
    status: 'committed',
    replayed: false,
  };
}

function validState() {
  return {
    schema_version: 'paw.shiguang.state.v1',
    tasks: [{
      id: 'TASK-1', title: '保底任务', priority: '中', status: '待处理', time: '今天', phase: '需求评审',
      assignee: { name: '拾光', avatar: 'SG', role: '助理' }, project: 'A', deadline: '待确认',
      description: '', tags: [],
    }],
    files: [],
    workspaces: ['A'],
    currentWorkspace: 'A',
    settings: { accentColor: 'emerald', glassBlur: 'ultra', enableConfetti: true },
  };
}

function withBootstrap(handler) {
  let challenge;
  return async (url, options) => {
    const path = new URL(url).pathname;
    if (path === ENDPOINTS.bootstrap) {
      challenge = bootstrap();
      assert.equal(options.headers['X-Agent-Boot-Id'], undefined);
      return jsonResponse(challenge);
    }
    if (path === ENDPOINTS.bootstrapAck) {
      assert.ok(challenge);
      assert.equal(options.headers['X-Agent-Boot-Id'], undefined);
      const body = JSON.parse(options.body);
      assert.equal(body.challenge_id, challenge.challenge_id);
      assert.match(body.agent_boot_id, /^[0-9a-f-]{36}$/);
      return jsonResponse(receipt(challenge, body));
    }
    assert.match(options.headers['X-Agent-Boot-Id'], /^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    return handler(url, options);
  };
}

test('configuration accepts only exact loopback and forbids injected boot id', () => {
  assert.equal(validateConfig(ENV).configured, true);
  for (const base of ['http://192.168.1.20:8765', 'http://localhost:8765', 'http://127.0.0.1:8765/path']) {
    assert.throws(() => validateConfig({ ...ENV, SHIGUANG_NODEGATEWAY_BASE_URL: base }), /NODEGATEWAY_BASE_URL_NOT_LOOPBACK/);
  }
  assert.throws(() => validateConfig({ ...ENV, SHIGUANG_AGENT_BOOT_ID: uuid7() }), /NODEGATEWAY_BOOT_ID_ENV_FORBIDDEN/);
  assert.equal(validateConfig(ENV).agentInstanceId, 'home-pc-01/shiguang/main');
});

test('client uses only the six contracted Shiguang HTTP routes', () => {
  assert.equal(ENDPOINTS.bootstrap, '/v1/shiguang/bootstrap');
  assert.equal(ENDPOINTS.bootstrapAck, '/v1/shiguang/bootstrap/ack');
  assert.equal(ENDPOINTS.snapshot('personal-workbench'), '/v1/shiguang/workspaces/personal-workbench/snapshot');
  assert.equal(ENDPOINTS.content('personal-workbench', VERSION), `/v1/shiguang/workspaces/personal-workbench/content/${encodeURIComponent(VERSION)}`);
  assert.equal(ENDPOINTS.versions('personal-workbench'), '/v1/shiguang/workspaces/personal-workbench/versions');
  assert.equal(ENDPOINTS.deletionProposals('personal-workbench'), '/v1/shiguang/workspaces/personal-workbench/deletion-proposals');
});

test('unconfigured client fails closed without exposing configuration', async () => {
  const client = createNodeGatewayClient({});
  assert.deepEqual(await client.status(), {
    schemaVersion: 'shiguang.gateway.status.v1',
    configured: false,
    connected: false,
    code: 'NODEGATEWAY_NOT_CONFIGURED',
  });
  const result = await createSafeIpcHandler(client.pullSnapshot)(null, undefined);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('bootstrap fully verifies README then binds a generated boot id to business requests', async () => {
  const calls = [];
  const client = createNodeGatewayClient(ENV, withBootstrap(async (url) => {
    calls.push(url);
    return jsonResponse(snapshot());
  }));
  const status = await client.status();
  assert.equal(status.connected, true);
  assert.equal(status.agentInstanceId, 'home-pc-01/shiguang/main');
  assert.equal(status.globalReadmeSha256, README_DIGEST);
  assert.equal(status.token, undefined);
  await client.pullSnapshot();
  assert.equal(calls[0], 'http://127.0.0.1:8765/v1/shiguang/workspaces/personal-workbench/snapshot?view_id=shared-three-side');
});

test('status performs a protected read probe every time instead of trusting cached bootstrap', async () => {
  let probes = 0;
  const client = createNodeGatewayClient(ENV, withBootstrap(async () => {
    probes += 1;
    return jsonResponse(snapshot());
  }));
  assert.equal((await client.status()).connected, true);
  assert.equal((await client.status()).connected, true);
  assert.equal(probes, 2);
});

test('read retries once after 428 with a new bootstrap while write never blind-replays', async () => {
  let readBootstraps = 0;
  let readProbes = 0;
  let currentChallenge;
  const readClient = createNodeGatewayClient(ENV, async (url, options) => {
    const path = new URL(url).pathname;
    if (path === ENDPOINTS.bootstrap) {
      readBootstraps += 1;
      currentChallenge = bootstrap();
      return jsonResponse(currentChallenge);
    }
    if (path === ENDPOINTS.bootstrapAck) return jsonResponse(receipt(currentChallenge, JSON.parse(options.body)));
    readProbes += 1;
    return readProbes === 1 ? jsonResponse({ error: { code: 'GLOBAL_README_SESSION_INVALID' } }, 428) : jsonResponse(snapshot());
  });
  assert.equal((await readClient.pullSnapshot()).generation, 4);
  assert.equal(readBootstraps, 2);
  assert.equal(readProbes, 2);

  const inputBytes = Buffer.from('payload', 'utf8');
  const input = {
    workspace_id: 'personal-workbench', view_id: 'shared-three-side', file_id: 'document-1',
    parent_version_ids: [], event_type: 'CREATE', classification: 'L2',
    content_base64url: inputBytes.toString('base64url'),
    content_sha256: `sha256:${crypto.createHash('sha256').update(inputBytes).digest('hex')}`,
    idempotency_key: uuid7(),
  };
  let writeAttempts = 0;
  let writeBootstraps = 0;
  const writeClient = createNodeGatewayClient(ENV, withBootstrap(async (url) => {
    if (new URL(url).pathname === ENDPOINTS.bootstrap) writeBootstraps += 1;
    writeAttempts += 1;
    return jsonResponse({ error: { code: 'GLOBAL_README_SESSION_INVALID' } }, 428);
  }));
  const result = await createSafeIpcHandler((value) => writeClient.pushVersion(value))(null, input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'NODEGATEWAY_SESSION_REFRESH_REQUIRED');
  assert.equal(writeAttempts, 1);
  assert.equal(writeBootstraps, 0);
});

test('bootstrap rejects README size or digest mismatch and never opens a session', async () => {
  const bad = bootstrap();
  bad.size += 1;
  let calls = 0;
  const client = createNodeGatewayClient(ENV, async () => {
    calls += 1;
    return jsonResponse(bad);
  });
  const status = await client.status();
  assert.equal(status.connected, false);
  assert.equal(status.code, 'NODEGATEWAY_BOOTSTRAP_MISMATCH');
  assert.equal(calls, 1);
});

test('snapshot and request schemas reject unknown fields', async () => {
  const client = createNodeGatewayClient(ENV, withBootstrap(async () => jsonResponse({ ...snapshot(), cos_key: 'forbidden' })));
  await assert.rejects(() => client.pullSnapshot(), /GATEWAY_SCHEMA_UNKNOWN_FIELD/);
  assert.throws(() => validateContentInput({
    workspace_id: 'personal-workbench', view_id: 'shared-three-side', version_id: VERSION, bucket: 'forbidden',
  }), /GATEWAY_SCHEMA_UNKNOWN_FIELD/);
});

test('version submission is canonical base64url, hash-bound, and contract exact', async () => {
  const bytes = Buffer.from('payload', 'utf8');
  const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  const input = {
    workspace_id: 'personal-workbench',
    view_id: 'shared-three-side',
    file_id: 'document-1',
    parent_version_ids: [],
    event_type: 'CREATE',
    classification: 'L2',
    content_base64url: bytes.toString('base64url'),
    content_sha256: digest,
    idempotency_key: uuid7(),
  };
  assert.equal(validatePushVersionInput(input).content_sha256, digest);
  assert.throws(() => validatePushVersionInput({ ...input, content_base64url: bytes.toString('base64') }), /GATEWAY_CONTENT_ENCODING_INVALID/);
  assert.throws(() => validatePushVersionInput({ ...input, content_sha256: README_DIGEST }), /GATEWAY_CONTENT_HASH_MISMATCH/);

  const client = createNodeGatewayClient(ENV, withBootstrap(async (url, options) => {
    assert.equal(new URL(url).pathname, '/v1/shiguang/workspaces/personal-workbench/versions');
    const sent = JSON.parse(options.body);
    assert.equal(sent.workspace_id, undefined);
    assert.deepEqual(sent, {
      view_id: input.view_id,
      file_id: input.file_id,
      parent_version_ids: [],
      event_type: 'CREATE',
      classification: 'L2',
      content_base64url: input.content_base64url,
      content_sha256: input.content_sha256,
      idempotency_key: input.idempotency_key,
    });
    return jsonResponse(versionReceipt(input.file_id), 201);
  }));
  assert.equal((await client.pushVersion(input)).status, 'committed');
});

test('state pull imports one verified head and reports conflict without overwrite', async () => {
  const state = validState();
  const bytes = Buffer.from(JSON.stringify(state), 'utf8');
  const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  const client = createNodeGatewayClient(ENV, withBootstrap(async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/snapshot')) return jsonResponse(snapshot([{
      file_id: 'shiguang-state', head_version_ids: [VERSION], classification: 'L2', status: 'active',
    }]));
    return jsonResponse({
      schema_version: 'paw.shiguang.workspace-content.v1',
      workspace_id: 'personal-workbench', view_id: 'shared-three-side', file_id: 'shiguang-state',
      version_id: VERSION, classification: 'L2', media_type: 'application/json',
      content_base64url: bytes.toString('base64url'), content_sha256: digest,
    });
  }));
  const result = await client.pullState();
  assert.equal(result.status, 'remote-loaded');
  assert.equal(result.state.schema_version, 'paw.shiguang.state.v1');

  const conflict = createNodeGatewayClient(ENV, withBootstrap(async () => jsonResponse(snapshot([{
    file_id: 'shiguang-state', head_version_ids: [VERSION, `sha256:${'f'.repeat(64)}`], classification: 'L2', status: 'conflict',
  }]))));
  assert.deepEqual(await conflict.pullState(), {
    schemaVersion: 'shiguang.state-pull-result.v1', status: 'conflict', headCount: 2,
  });
});

test('state push creates a version only from zero or one head and never auto-deletes', async () => {
  const state = validState();
  let sent;
  const client = createNodeGatewayClient(ENV, withBootstrap(async (url, options) => {
    if (new URL(url).pathname.endsWith('/snapshot')) return jsonResponse(snapshot());
    sent = JSON.parse(options.body);
    return jsonResponse(versionReceipt(), 201);
  }));
  assert.equal((await client.pushState({ state })).status, 'committed');
  assert.equal(sent.event_type, 'CREATE');
  assert.deepEqual(sent.parent_version_ids, []);
  assert.equal(sent.classification, 'L2');
  assert.equal(sent.file_id, 'shiguang-state');
  await assert.rejects(() => client.pushState({ state: { ...state, tasks: [] } }), /SHIGUANG_STATE_INVALID/);
});

test('navigation and IPC trust are locked to the exact main renderer page', async () => {
  const policy = {
    isDev: false,
    devUrl: 'http://127.0.0.1:3000/',
    prodFileUrl: 'file:///C:/app/dist/index.html',
  };
  assert.equal(isAllowedRendererUrl('file:///C:/app/dist/index.html', policy), true);
  assert.equal(isAllowedRendererUrl('file:///C:/app/dist/index.html#settings', policy), true);
  assert.equal(isAllowedRendererUrl('file:///C:/other/index.html', policy), false);
  assert.equal(isAllowedRendererUrl('file:///C:/app/dist/other.html', policy), false);
  assert.equal(isAllowedRendererUrl('https://example.com/', policy), false);
  const mainFrame = { url: 'file:///C:/app/dist/index.html' };
  const webContents = { mainFrame, isDestroyed: () => false };
  const mainWindow = { webContents, isDestroyed: () => false };
  assert.equal(isTrustedIpcEvent({ sender: webContents, senderFrame: mainFrame }, mainWindow, policy), true);
  assert.equal(isTrustedIpcEvent({ sender: webContents, senderFrame: { url: mainFrame.url } }, mainWindow, policy), false);
  let invoked = false;
  const blocked = await createSafeIpcHandler(async () => { invoked = true; }, () => false)({}, {});
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, 'IPC_CALLER_UNTRUSTED');
  assert.equal(invoked, false);
});

test('preload preserves update checks while exposing only three fixed gateway operations', () => {
  const source = fs.readFileSync(require.resolve('./preload.cjs'), 'utf8');
  assert.match(source, /exposeInMainWorld\('shiguang'/);
  assert.match(source, /checkForUpdates:/);
  assert.match(source, /onUpdateAvailable:/);
  assert.match(source, /status:/);
  assert.match(source, /pullState:/);
  assert.match(source, /pushState:/);
  assert.equal(source.includes("exposeInMainWorld('wenxibuddy'"), false);
  for (const forbidden of ['pullSnapshot:', 'pullContent:', 'pushVersion:', 'proposeDeletion:']) {
    assert.equal(source.includes(forbidden), false);
  }
});

test('production startup stays usable offline when the token helper is unavailable', () => {
  const source = fs.readFileSync(require.resolve('./main.cjs'), 'utf8');
  assert.match(source, /gatewayClient = createNodeGatewayClient\(\{\}\)/);
  assert.match(source, /Shiguang NodeGateway unavailable/);
  assert.equal(source.includes('app.exit(1)'), false);
});
