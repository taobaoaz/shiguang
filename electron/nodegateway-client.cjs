const crypto = require('crypto');

const CLIENT_PROTOCOL = 'paw.shiguang.nodegateway-client.v1';
const STATE_SCHEMA = 'paw.shiguang.state.v1';
const STATE_FILE_ID = 'shiguang-state';
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_CONTENT_BYTES = 512 * 1024;
const ENDPOINTS = Object.freeze({
  bootstrap: '/v1/shiguang/bootstrap',
  bootstrapAck: '/v1/shiguang/bootstrap/ack',
  snapshot: (workspaceId) => `/v1/shiguang/workspaces/${encodeURIComponent(workspaceId)}/snapshot`,
  content: (workspaceId, versionId) => `/v1/shiguang/workspaces/${encodeURIComponent(workspaceId)}/content/${encodeURIComponent(versionId)}`,
  versions: (workspaceId) => `/v1/shiguang/workspaces/${encodeURIComponent(workspaceId)}/versions`,
  deletionProposals: (workspaceId) => `/v1/shiguang/workspaces/${encodeURIComponent(workspaceId)}/deletion-proposals`,
});

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const WORKSPACE_ID = /^[a-z][a-z0-9-]{1,62}$/;
const LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const NODE_ID = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const AGENT_INSTANCE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]\/shiguang\/main$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const VIEW_IDS = new Set(['shared-three-side', 'home-cone', 'office-cone', 'cone-private']);
const EVENT_TYPES = new Set(['CREATE', 'MODIFY', 'RENAME', 'MERGE', 'RESTORE']);
const CLASSIFICATIONS = new Set(['L0', 'L1', 'L2']);

class ShiguangGatewayError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ShiguangGatewayError';
    this.code = code;
  }
}

function fail(code) {
  throw new ShiguangGatewayError(code);
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactRecord(value, allowed, required = allowed) {
  if (!isRecord(value)) fail('GATEWAY_SCHEMA_INVALID');
  const keys = Object.keys(value);
  if (keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) {
    fail('GATEWAY_SCHEMA_DANGEROUS_FIELD');
  }
  if (keys.some((key) => !allowed.includes(key))) fail('GATEWAY_SCHEMA_UNKNOWN_FIELD');
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    fail('GATEWAY_SCHEMA_MISSING_FIELD');
  }
  return value;
}

function stringField(value, pattern, maxLength = 4096) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    fail('GATEWAY_SCHEMA_INVALID');
  }
  if (pattern && !pattern.test(value)) fail('GATEWAY_SCHEMA_INVALID');
  return value;
}

function integerField(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('GATEWAY_SCHEMA_INVALID');
  return value;
}

function booleanField(value) {
  if (typeof value !== 'boolean') fail('GATEWAY_SCHEMA_INVALID');
  return value;
}

function enumField(value, allowed) {
  if (!allowed.has(value)) fail('GATEWAY_SCHEMA_INVALID');
  return value;
}

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function uuid7(now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xffffffffffff) fail('NODEGATEWAY_CLOCK_INVALID');
  const value = crypto.randomBytes(16);
  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    value[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  value[6] = (value[6] & 0x0f) | 0x70;
  value[8] = (value[8] & 0x3f) | 0x80;
  const hex = value.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalBase64Url(value) {
  if (typeof value !== 'string' || value.length > 700000 || !/^[A-Za-z0-9_-]*$/.test(value)) {
    fail('GATEWAY_CONTENT_ENCODING_INVALID');
  }
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length > MAX_CONTENT_BYTES || bytes.toString('base64url') !== value) {
    fail('GATEWAY_CONTENT_ENCODING_INVALID');
  }
  return bytes;
}

function canonicalJson(value) {
  const visit = (item, depth) => {
    if (depth > 24) fail('SHIGUANG_STATE_INVALID');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) fail('SHIGUANG_STATE_INVALID');
      return item;
    }
    if (Array.isArray(item)) {
      if (item.length > 10000) fail('SHIGUANG_STATE_INVALID');
      return item.map((entry) => visit(entry, depth + 1));
    }
    if (!isRecord(item)) fail('SHIGUANG_STATE_INVALID');
    const keys = Object.keys(item).sort();
    if (keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) {
      fail('SHIGUANG_STATE_INVALID');
    }
    const result = {};
    for (const key of keys) result[key] = visit(item[key], depth + 1);
    return result;
  };
  const text = JSON.stringify(visit(value, 0));
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > MAX_CONTENT_BYTES) fail('SHIGUANG_STATE_TOO_LARGE');
  return bytes;
}

function boundedText(value, maxLength, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && value.length < 1) || value.length > maxLength) {
    fail('SHIGUANG_STATE_INVALID');
  }
  return value;
}

function stateStringArray(value, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) fail('SHIGUANG_STATE_INVALID');
  return value.map((item) => boundedText(item, 512));
}

function validateStatePayload(value) {
  const state = exactRecord(value, ['schema_version', 'tasks', 'files', 'workspaces', 'currentWorkspace', 'settings']);
  if (state.schema_version !== STATE_SCHEMA) fail('SHIGUANG_STATE_SCHEMA_INVALID');
  if (!Array.isArray(state.tasks) || state.tasks.length < 1 || state.tasks.length > 5000) fail('SHIGUANG_STATE_INVALID');
  const taskIds = new Set();
  for (const task of state.tasks) {
    const allowed = [
      'id', 'title', 'priority', 'status', 'time', 'phase', 'assignee', 'project',
      'deadline', 'description', 'tags', 'aiSuggestions', 'completionProgress',
    ];
    const required = allowed.filter((key) => !['aiSuggestions', 'completionProgress'].includes(key));
    exactRecord(task, allowed, required);
    boundedText(task.id, 256);
    if (taskIds.has(task.id)) fail('SHIGUANG_STATE_INVALID');
    taskIds.add(task.id);
    boundedText(task.title, 1000);
    enumField(task.priority, new Set(['高', '中', '低', '高优先级', '紧急']));
    enumField(task.status, new Set(['进行中', '已完成', '待处理', '已延期']));
    boundedText(task.time, 128);
    enumField(task.phase, new Set(['需求评审', '产品设计', '开发实现', '测试验证']));
    exactRecord(task.assignee, ['name', 'avatar', 'role']);
    boundedText(task.assignee.name, 256);
    boundedText(task.assignee.avatar, 128);
    boundedText(task.assignee.role, 256);
    boundedText(task.project, 512);
    boundedText(task.deadline, 128);
    boundedText(task.description, 10000, true);
    stateStringArray(task.tags, 128);
    if (Object.prototype.hasOwnProperty.call(task, 'aiSuggestions')) stateStringArray(task.aiSuggestions, 128);
    if (Object.prototype.hasOwnProperty.call(task, 'completionProgress')) {
      if (!Number.isFinite(task.completionProgress) || task.completionProgress < 0 || task.completionProgress > 100) {
        fail('SHIGUANG_STATE_INVALID');
      }
    }
  }
  if (!Array.isArray(state.files) || state.files.length > 10000) fail('SHIGUANG_STATE_INVALID');
  const fileIds = new Set();
  for (const file of state.files) {
    const allowed = ['id', 'title', 'category', 'size', 'author', 'updatedAt', 'completion', 'tags'];
    exactRecord(file, allowed, allowed.filter((key) => key !== 'completion'));
    boundedText(file.id, 256);
    if (fileIds.has(file.id)) fail('SHIGUANG_STATE_INVALID');
    fileIds.add(file.id);
    boundedText(file.title, 1000);
    boundedText(file.category, 256);
    boundedText(file.size, 128);
    boundedText(file.author, 256);
    boundedText(file.updatedAt, 128);
    stateStringArray(file.tags, 128);
    if (Object.prototype.hasOwnProperty.call(file, 'completion')) {
      if (!Number.isFinite(file.completion) || file.completion < 0 || file.completion > 100) fail('SHIGUANG_STATE_INVALID');
    }
  }
  const workspaces = stateStringArray(state.workspaces, 1000);
  if (workspaces.length < 1 || new Set(workspaces).size !== workspaces.length) fail('SHIGUANG_STATE_INVALID');
  boundedText(state.currentWorkspace, 512);
  if (!workspaces.includes(state.currentWorkspace)) fail('SHIGUANG_STATE_INVALID');
  exactRecord(state.settings, ['accentColor', 'glassBlur', 'enableConfetti']);
  enumField(state.settings.accentColor, new Set(['emerald', 'cyan', 'purple']));
  enumField(state.settings.glassBlur, new Set(['standard', 'ultra', 'max']));
  booleanField(state.settings.enableConfetti);
  return state;
}

function validateConfig(env) {
  if (env.SHIGUANG_AGENT_BOOT_ID !== undefined && env.SHIGUANG_AGENT_BOOT_ID !== '') {
    fail('NODEGATEWAY_BOOT_ID_ENV_FORBIDDEN');
  }
  const base = env.SHIGUANG_NODEGATEWAY_BASE_URL;
  const token = env.SHIGUANG_NODEGATEWAY_TOKEN;
  const present = [base, token].filter((value) => value !== undefined && value !== '').length;
  if (present === 0) return { configured: false, code: 'NODEGATEWAY_NOT_CONFIGURED' };
  if (present !== 2) fail('NODEGATEWAY_CONFIG_INCOMPLETE');

  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    fail('NODEGATEWAY_BASE_URL_INVALID');
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (
    parsed.protocol !== 'http:'
    || !['127.0.0.1', '::1'].includes(hostname)
    || !parsed.port
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) fail('NODEGATEWAY_BASE_URL_NOT_LOOPBACK');

  stringField(token, /^[\x21-\x7e]+$/, 4096);
  if (token.length < 32) fail('NODEGATEWAY_TOKEN_INVALID');
  const nodeId = env.SHIGUANG_NODE_ID || 'home-pc-01';
  const agentInstanceId = env.SHIGUANG_AGENT_INSTANCE_ID || `${nodeId}/shiguang/main`;
  stringField(nodeId, NODE_ID, 64);
  stringField(agentInstanceId, AGENT_INSTANCE, 192);
  if (agentInstanceId !== `${nodeId}/shiguang/main`) fail('NODEGATEWAY_AGENT_INSTANCE_MISMATCH');
  const workspaceId = env.SHIGUANG_WORKSPACE_ID || 'personal-workbench';
  const viewId = env.SHIGUANG_VIEW_ID || 'shared-three-side';
  stringField(workspaceId, WORKSPACE_ID, 63);
  enumField(viewId, VIEW_IDS);
  const timeoutMs = env.SHIGUANG_NODEGATEWAY_TIMEOUT_MS === undefined
    ? 5000
    : Number(env.SHIGUANG_NODEGATEWAY_TIMEOUT_MS);
  integerField(timeoutMs, 500, 30000);
  return { configured: true, baseUrl: parsed.origin, token, nodeId, agentInstanceId, workspaceId, viewId, timeoutMs };
}

function validateBootstrap(value) {
  exactRecord(value, [
    'schema_version', 'challenge_id', 'gateway_boot_generation',
    'global_readme_sha256', 'size', 'content', 'issued_at', 'expires_at',
    'direct_cos_access',
  ]);
  if (value.schema_version !== 'paw.global-readme-bootstrap.v1' || value.direct_cos_access !== false) {
    fail('NODEGATEWAY_BOOTSTRAP_MISMATCH');
  }
  stringField(value.challenge_id, UUID_V7, 36);
  integerField(value.gateway_boot_generation);
  stringField(value.global_readme_sha256, SHA256, 71);
  integerField(value.size, 1, 1024 * 1024);
  stringField(value.content, null, 1024 * 1024);
  stringField(value.issued_at, RFC3339, 40);
  stringField(value.expires_at, RFC3339, 40);
  const bytes = Buffer.from(value.content, 'utf8');
  if (
    bytes.length !== value.size
    || sha256(bytes) !== value.global_readme_sha256
    || !value.content.startsWith('# PAW 全局 Agent 初始化 README')
    || Date.parse(value.expires_at) <= Date.parse(value.issued_at)
  ) fail('NODEGATEWAY_BOOTSTRAP_MISMATCH');
  return value;
}

function validateBootstrapReceipt(value, config, bootId, bootstrap) {
  exactRecord(value, [
    'agent_instance_id', 'agent_boot_id', 'global_readme_sha256',
    'gateway_boot_generation', 'receipt_digest', 'replayed',
  ]);
  if (
    value.agent_instance_id !== config.agentInstanceId
    || value.agent_boot_id !== bootId
    || value.global_readme_sha256 !== bootstrap.global_readme_sha256
    || value.gateway_boot_generation !== bootstrap.gateway_boot_generation
  ) fail('NODEGATEWAY_BOOTSTRAP_RECEIPT_MISMATCH');
  stringField(value.receipt_digest, SHA256, 71);
  booleanField(value.replayed);
  return value;
}

function validateSnapshotInput(value, config) {
  if (value === undefined) return { workspace_id: config.workspaceId, view_id: config.viewId };
  exactRecord(value, ['workspace_id', 'view_id']);
  stringField(value.workspace_id, WORKSPACE_ID, 63);
  enumField(value.view_id, VIEW_IDS);
  return value;
}

function validateSnapshot(value, request) {
  exactRecord(value, ['schema_version', 'workspace_id', 'view_id', 'generation', 'manifest_digest', 'files']);
  if (
    value.schema_version !== 'paw.shiguang.workspace-snapshot.v1'
    || value.workspace_id !== request.workspace_id
    || value.view_id !== request.view_id
  ) fail('NODEGATEWAY_SNAPSHOT_MISMATCH');
  integerField(value.generation);
  stringField(value.manifest_digest, SHA256, 71);
  if (!Array.isArray(value.files) || value.files.length > 10000) fail('GATEWAY_SCHEMA_INVALID');
  const seen = new Set();
  for (const file of value.files) {
    exactRecord(file, ['file_id', 'head_version_ids', 'classification', 'status']);
    stringField(file.file_id, LOGICAL_ID, 256);
    if (seen.has(file.file_id)) fail('NODEGATEWAY_SNAPSHOT_MISMATCH');
    seen.add(file.file_id);
    if (!Array.isArray(file.head_version_ids) || file.head_version_ids.length > 16) fail('GATEWAY_SCHEMA_INVALID');
    if (new Set(file.head_version_ids).size !== file.head_version_ids.length) fail('GATEWAY_SCHEMA_INVALID');
    for (const head of file.head_version_ids) stringField(head, SHA256, 71);
    enumField(file.classification, CLASSIFICATIONS);
    enumField(file.status, new Set(['active', 'conflict', 'deletion-proposed']));
  }
  return value;
}

function validateContentInput(value) {
  exactRecord(value, ['workspace_id', 'view_id', 'version_id']);
  stringField(value.workspace_id, WORKSPACE_ID, 63);
  enumField(value.view_id, VIEW_IDS);
  stringField(value.version_id, SHA256, 71);
  return value;
}

function validateContent(value, request) {
  exactRecord(value, [
    'schema_version', 'workspace_id', 'view_id', 'file_id', 'version_id',
    'classification', 'media_type', 'content_base64url', 'content_sha256',
  ]);
  if (
    value.schema_version !== 'paw.shiguang.workspace-content.v1'
    || value.workspace_id !== request.workspace_id
    || value.view_id !== request.view_id
    || value.version_id !== request.version_id
  ) fail('NODEGATEWAY_CONTENT_MISMATCH');
  stringField(value.file_id, LOGICAL_ID, 256);
  enumField(value.classification, CLASSIFICATIONS);
  stringField(value.media_type, null, 128);
  stringField(value.content_sha256, SHA256, 71);
  const bytes = canonicalBase64Url(value.content_base64url);
  if (sha256(bytes) !== value.content_sha256) fail('NODEGATEWAY_CONTENT_HASH_MISMATCH');
  return { ...value, contentBytes: bytes };
}

function validatePushVersionInput(value) {
  exactRecord(value, [
    'workspace_id', 'view_id', 'file_id', 'parent_version_ids', 'event_type',
    'classification', 'content_base64url', 'content_sha256', 'idempotency_key',
  ]);
  stringField(value.workspace_id, WORKSPACE_ID, 63);
  enumField(value.view_id, VIEW_IDS);
  stringField(value.file_id, LOGICAL_ID, 256);
  if (!Array.isArray(value.parent_version_ids) || value.parent_version_ids.length > 16) fail('GATEWAY_SCHEMA_INVALID');
  if (new Set(value.parent_version_ids).size !== value.parent_version_ids.length) fail('GATEWAY_SCHEMA_INVALID');
  for (const parent of value.parent_version_ids) stringField(parent, SHA256, 71);
  enumField(value.event_type, EVENT_TYPES);
  enumField(value.classification, CLASSIFICATIONS);
  stringField(value.content_sha256, SHA256, 71);
  stringField(value.idempotency_key, LOGICAL_ID, 256);
  const bytes = canonicalBase64Url(value.content_base64url);
  if (sha256(bytes) !== value.content_sha256) fail('GATEWAY_CONTENT_HASH_MISMATCH');
  if (value.event_type === 'CREATE' && value.parent_version_ids.length !== 0) fail('GATEWAY_SCHEMA_INVALID');
  if (value.event_type !== 'CREATE' && value.parent_version_ids.length === 0) fail('GATEWAY_SCHEMA_INVALID');
  return value;
}

function validateVersionReceipt(value, request) {
  exactRecord(value, ['workspace_id', 'file_id', 'version_id', 'event_id', 'event_hash', 'status', 'replayed']);
  if (value.workspace_id !== request.workspace_id || value.file_id !== request.file_id) {
    fail('NODEGATEWAY_PUSH_RECEIPT_MISMATCH');
  }
  stringField(value.version_id, SHA256, 71);
  stringField(value.event_id, LOGICAL_ID, 256);
  stringField(value.event_hash, SHA256, 71);
  enumField(value.status, new Set(['accepted', 'committed']));
  booleanField(value.replayed);
  return value;
}

function validateDeletionInput(value) {
  exactRecord(value, ['workspace_id', 'view_id', 'file_id', 'version_id', 'reason', 'idempotency_key']);
  stringField(value.workspace_id, WORKSPACE_ID, 63);
  enumField(value.view_id, VIEW_IDS);
  stringField(value.file_id, LOGICAL_ID, 256);
  stringField(value.version_id, SHA256, 71);
  stringField(value.reason, null, 512);
  stringField(value.idempotency_key, LOGICAL_ID, 256);
  return value;
}

function validateDeletionReceipt(value, request) {
  exactRecord(value, ['proposal_id', 'workspace_id', 'file_id', 'version_id', 'status', 'replayed']);
  if (
    value.workspace_id !== request.workspace_id
    || value.file_id !== request.file_id
    || value.version_id !== request.version_id
    || value.status !== 'pending'
  ) fail('NODEGATEWAY_DELETION_RECEIPT_MISMATCH');
  stringField(value.proposal_id, LOGICAL_ID, 256);
  booleanField(value.replayed);
  return value;
}

function createNodeGatewayClient(env = process.env, fetchImpl = globalThis.fetch) {
  let config;
  try {
    config = validateConfig(env);
  } catch (error) {
    config = { configured: false, code: publicError(error).code };
  }
  let session = null;
  let bootstrapInFlight = null;

  async function request(path, { method = 'GET', body, validator, includeBoot = true } = {}) {
    if (!config.configured) fail(config.code || 'NODEGATEWAY_NOT_CONFIGURED');
    if (typeof fetchImpl !== 'function') fail('NODEGATEWAY_FETCH_UNAVAILABLE');
    if (includeBoot && !session) fail('GLOBAL_README_REQUIRED');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.token}`,
          'X-Shiguang-Protocol-Version': CLIENT_PROTOCOL,
          ...(includeBoot ? { 'X-Agent-Boot-Id': session.bootId } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === 'AbortError') fail('NODEGATEWAY_TIMEOUT');
      fail('NODEGATEWAY_UNREACHABLE');
    } finally {
      clearTimeout(timeout);
    }
    if (!response || typeof response.status !== 'number') fail('NODEGATEWAY_RESPONSE_INVALID');
    if (!response.ok) fail(`NODEGATEWAY_HTTP_${response.status}`);
    const contentType = response.headers && response.headers.get ? response.headers.get('content-type') || '' : '';
    if (!/^application\/json(?:;|$)/i.test(contentType)) fail('NODEGATEWAY_CONTENT_TYPE_INVALID');
    const declared = response.headers && response.headers.get ? Number(response.headers.get('content-length')) : NaN;
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) fail('NODEGATEWAY_RESPONSE_TOO_LARGE');
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) fail('NODEGATEWAY_RESPONSE_TOO_LARGE');
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      fail('NODEGATEWAY_JSON_INVALID');
    }
    return validator(value);
  }

  async function ensureBootstrap() {
    if (!config.configured) fail(config.code || 'NODEGATEWAY_NOT_CONFIGURED');
    if (session) return session;
    if (bootstrapInFlight) return bootstrapInFlight;
    bootstrapInFlight = (async () => {
      const bootstrap = await request(ENDPOINTS.bootstrap, {
        includeBoot: false,
        validator: validateBootstrap,
      });
      const bootId = uuid7();
      const receipt = await request(ENDPOINTS.bootstrapAck, {
        method: 'POST',
        includeBoot: false,
        body: {
          challenge_id: bootstrap.challenge_id,
          agent_boot_id: bootId,
          global_readme_sha256: bootstrap.global_readme_sha256,
          read_at: new Date().toISOString(),
        },
        validator: (value) => validateBootstrapReceipt(value, config, bootId, bootstrap),
      });
      session = Object.freeze({
        bootId,
        gatewayBootGeneration: receipt.gateway_boot_generation,
        globalReadmeSha256: receipt.global_readme_sha256,
        receiptDigest: receipt.receipt_digest,
      });
      return session;
    })();
    try {
      return await bootstrapInFlight;
    } finally {
      bootstrapInFlight = null;
    }
  }

  function isExpiredSession(error) {
    return error instanceof ShiguangGatewayError && error.code === 'NODEGATEWAY_HTTP_428';
  }

  async function withFreshRead(operation) {
    await ensureBootstrap();
    try {
      return await operation();
    } catch (error) {
      if (!isExpiredSession(error)) throw error;
      session = null;
      await ensureBootstrap();
      try {
        return await operation();
      } catch (retryError) {
        if (isExpiredSession(retryError)) session = null;
        throw retryError;
      }
    }
  }

  async function writeWithoutReplay(operation) {
    await ensureBootstrap();
    try {
      return await operation();
    } catch (error) {
      if (isExpiredSession(error)) {
        session = null;
        fail('NODEGATEWAY_SESSION_REFRESH_REQUIRED');
      }
      throw error;
    }
  }

  async function pullSnapshot(input) {
    const validated = validateSnapshotInput(input, config);
    const query = new URLSearchParams({ view_id: validated.view_id }).toString();
    return withFreshRead(() => request(`${ENDPOINTS.snapshot(validated.workspace_id)}?${query}`, {
      validator: (value) => validateSnapshot(value, validated),
    }));
  }

  async function pullContent(input) {
    const validated = validateContentInput(input);
    const query = new URLSearchParams({ view_id: validated.view_id }).toString();
    const content = await withFreshRead(() => request(`${ENDPOINTS.content(validated.workspace_id, validated.version_id)}?${query}`, {
      validator: (value) => validateContent(value, validated),
    }));
    const { contentBytes, ...safe } = content;
    return safe;
  }

  async function pushVersion(input) {
    const validated = validatePushVersionInput(input);
    const { workspace_id: workspaceId, ...body } = validated;
    return writeWithoutReplay(() => request(ENDPOINTS.versions(workspaceId), {
      method: 'POST',
      body,
      validator: (value) => validateVersionReceipt(value, validated),
    }));
  }

  async function proposeDeletion(input) {
    const validated = validateDeletionInput(input);
    const { workspace_id: workspaceId, ...body } = validated;
    return writeWithoutReplay(() => request(ENDPOINTS.deletionProposals(workspaceId), {
      method: 'POST',
      body,
      validator: (value) => validateDeletionReceipt(value, validated),
    }));
  }

  async function pullState() {
    const scope = { workspace_id: config.workspaceId, view_id: config.viewId };
    const snapshot = await pullSnapshot(scope);
    const stateFiles = snapshot.files.filter((file) => file.file_id === STATE_FILE_ID);
    if (stateFiles.length === 0) {
      return { schemaVersion: 'shiguang.state-pull-result.v1', status: 'local-only', headCount: 0 };
    }
    if (stateFiles.length !== 1) fail('SHIGUANG_STATE_DUPLICATE_FILE');
    const stateFile = stateFiles[0];
    if (stateFile.status !== 'active' || stateFile.head_version_ids.length > 1) {
      return {
        schemaVersion: 'shiguang.state-pull-result.v1',
        status: 'conflict',
        headCount: stateFile.head_version_ids.length,
      };
    }
    if (stateFile.head_version_ids.length === 0) {
      return { schemaVersion: 'shiguang.state-pull-result.v1', status: 'local-only', headCount: 0 };
    }
    const requestInput = { ...scope, version_id: stateFile.head_version_ids[0] };
    const content = await withFreshRead(() => request(
      `${ENDPOINTS.content(scope.workspace_id, requestInput.version_id)}?${new URLSearchParams({ view_id: scope.view_id })}`,
      { validator: (value) => validateContent(value, requestInput) },
    ));
    if (content.file_id !== STATE_FILE_ID || content.classification !== 'L2' || content.media_type !== 'application/json') {
      fail('SHIGUANG_STATE_CONTENT_MISMATCH');
    }
    let state;
    try {
      state = JSON.parse(content.contentBytes.toString('utf8'));
    } catch {
      fail('SHIGUANG_STATE_JSON_INVALID');
    }
    validateStatePayload(state);
    return {
      schemaVersion: 'shiguang.state-pull-result.v1',
      status: 'remote-loaded',
      headCount: 1,
      versionId: content.version_id,
      contentSha256: content.content_sha256,
      state,
    };
  }

  async function pushState(input) {
    exactRecord(input, ['state']);
    const state = validateStatePayload(input.state);
    const scope = { workspace_id: config.workspaceId, view_id: config.viewId };
    const snapshot = await pullSnapshot(scope);
    const stateFiles = snapshot.files.filter((file) => file.file_id === STATE_FILE_ID);
    if (stateFiles.length > 1) fail('SHIGUANG_STATE_DUPLICATE_FILE');
    const stateFile = stateFiles[0];
    if (stateFile && (stateFile.status !== 'active' || stateFile.head_version_ids.length > 1)) {
      fail('SHIGUANG_STATE_CONFLICT');
    }
    const parents = stateFile ? stateFile.head_version_ids : [];
    const bytes = canonicalJson(state);
    return pushVersion({
      ...scope,
      file_id: STATE_FILE_ID,
      parent_version_ids: parents,
      event_type: parents.length === 0 ? 'CREATE' : 'MODIFY',
      classification: 'L2',
      content_base64url: bytes.toString('base64url'),
      content_sha256: sha256(bytes),
      idempotency_key: uuid7(),
    });
  }

  return Object.freeze({
    async status() {
      if (!config.configured) {
        return { schemaVersion: 'shiguang.gateway.status.v1', configured: false, connected: false, code: config.code || 'NODEGATEWAY_NOT_CONFIGURED' };
      }
      try {
        await pullSnapshot();
        const initialized = session;
        if (!initialized) fail('GLOBAL_README_REQUIRED');
        return {
          schemaVersion: 'shiguang.gateway.status.v1',
          configured: true,
          connected: true,
          code: 'NODEGATEWAY_READY',
          nodeId: config.nodeId,
          agentInstanceId: config.agentInstanceId,
          gatewayBootGeneration: initialized.gatewayBootGeneration,
          globalReadmeSha256: initialized.globalReadmeSha256,
          receiptDigest: initialized.receiptDigest,
        };
      } catch (error) {
        return { schemaVersion: 'shiguang.gateway.status.v1', configured: true, connected: false, code: publicError(error).code };
      }
    },
    pullSnapshot,
    pullContent,
    pushVersion,
    proposeDeletion,
    pullState,
    pushState,
  });
}

function publicError(error) {
  const code = error instanceof ShiguangGatewayError ? error.code : 'NODEGATEWAY_INTERNAL_ERROR';
  return Object.freeze({ code, message: code });
}

function createSafeIpcHandler(operation, authorizeEvent = () => true) {
  return async (event, input) => {
    try {
      if (!authorizeEvent(event)) fail('IPC_CALLER_UNTRUSTED');
      return { ok: true, value: await operation(input) };
    } catch (error) {
      return { ok: false, error: publicError(error) };
    }
  };
}

module.exports = {
  CLIENT_PROTOCOL,
  ENDPOINTS,
  STATE_FILE_ID,
  ShiguangGatewayError,
  createNodeGatewayClient,
  createSafeIpcHandler,
  publicError,
  uuid7,
  validateConfig,
  validateContentInput,
  validatePushVersionInput,
};
