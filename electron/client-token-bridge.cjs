const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { uuid7 } = require('./nodegateway-client.cjs');

const CODEX_OPS_ROOT = String.raw`D:\我的个人工作台\02-进行中项目\codex-ops`;
const CODEX_OPS_SRC = path.win32.join(CODEX_OPS_ROOT, 'src');
const PYTHON_EXE = path.win32.join(CODEX_OPS_ROOT, '.venv', 'Scripts', 'python.exe');
const HELPER_ARGV = Object.freeze([
  '-m',
  'cone_hub.home_shiguang_runtime',
  'client-token-stdio',
]);
const CONTRACT = 'paw.shiguang.client-token-stdio.v1';
const REQUEST_SCHEMA = 'paw.shiguang.client-token-request.v1';
const RESPONSE_SCHEMA = 'paw.shiguang.client-token-response.v1';
const AUDIENCE = 'home-pc-01/shiguang/main';
const PURPOSE = 'nodegateway-loopback-bearer';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_FRAME_BYTES = 8192;
const DEFAULT_TIMEOUT_MS = 3000;

class ClientTokenBridgeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ClientTokenBridgeError';
    this.code = code;
  }
}

function fail(code) {
  throw new ClientTokenBridgeError(code);
}

function exactRecord(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('TOKEN_RESPONSE_INVALID');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('TOKEN_RESPONSE_INVALID');
  const keys = Object.keys(value);
  if (keys.length !== fields.length || fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))) {
    fail('TOKEN_RESPONSE_INVALID');
  }
  if (keys.some((key) => !fields.includes(key) || ['__proto__', 'prototype', 'constructor'].includes(key))) {
    fail('TOKEN_RESPONSE_INVALID');
  }
  return value;
}

function jcsBytes(value) {
  const ordered = {};
  for (const key of Object.keys(value).sort()) ordered[key] = value[key];
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

function frame(value) {
  const body = jcsBytes(value);
  const prefix = Buffer.allocUnsafe(4);
  prefix.writeUInt32BE(body.length, 0);
  return Buffer.concat([prefix, body]);
}

function childEnvironment(source) {
  const result = { PYTHONPATH: CODEX_OPS_SRC };
  for (const name of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'USERNAME', 'PATH', 'TEMP', 'TMP']) {
    if (typeof source[name] === 'string' && source[name] !== '') result[name] = source[name];
  }
  return result;
}

function validateToken(value) {
  if (typeof value !== 'string' || !TOKEN.test(value)) fail('TOKEN_VALUE_INVALID');
  return value;
}

function validateResponse(bytes, nonce) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 5) fail('TOKEN_FRAME_INVALID');
  const size = bytes.readUInt32BE(0);
  if (size < 1 || size > MAX_FRAME_BYTES || bytes.length !== size + 4) fail('TOKEN_FRAME_INVALID');
  const body = bytes.subarray(4);
  let value;
  try {
    value = JSON.parse(body.toString('utf8'));
  } catch {
    fail('TOKEN_RESPONSE_INVALID');
  }
  exactRecord(value, ['schema_version', 'contract', 'audience', 'nonce', 'token']);
  if (!body.equals(jcsBytes(value))) fail('TOKEN_RESPONSE_NOT_CANONICAL');
  if (
    value.schema_version !== RESPONSE_SCHEMA
    || value.contract !== CONTRACT
    || value.audience !== AUDIENCE
    || typeof value.nonce !== 'string'
    || !UUID_V7.test(value.nonce)
  ) fail('TOKEN_RESPONSE_INVALID');
  const expected = Buffer.from(nonce, 'ascii');
  const actual = Buffer.from(value.nonce, 'ascii');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) fail('TOKEN_NONCE_MISMATCH');
  return validateToken(value.token);
}

function invokeTokenHelper({
  spawnImpl = spawn,
  sourceEnv = process.env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  nonceFactory = uuid7,
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) fail('TOKEN_TIMEOUT_INVALID');
  const nonce = nonceFactory();
  if (typeof nonce !== 'string' || !UUID_V7.test(nonce)) fail('TOKEN_NONCE_INVALID');
  const request = frame({
    schema_version: REQUEST_SCHEMA,
    contract: CONTRACT,
    audience: AUDIENCE,
    purpose: PURPOSE,
    nonce,
  });

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(PYTHON_EXE, HELPER_ARGV, {
        cwd: CODEX_OPS_ROOT,
        env: childEnvironment(sourceEnv),
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      reject(new ClientTokenBridgeError('TOKEN_HELPER_START_FAILED'));
      return;
    }

    let settled = false;
    let output = Buffer.alloc(0);
    const finish = (error, token) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(token);
    };
    const closeFailed = (code) => {
      try { child.kill(); } catch { /* already closed */ }
      finish(new ClientTokenBridgeError(code));
    };
    const timer = setTimeout(() => closeFailed('TOKEN_HELPER_TIMEOUT'), timeoutMs);

    child.on('error', () => finish(new ClientTokenBridgeError('TOKEN_HELPER_START_FAILED')));
    child.stdout.on('data', (chunk) => {
      if (settled) return;
      output = Buffer.concat([output, Buffer.from(chunk)]);
      if (output.length > MAX_FRAME_BYTES + 4) closeFailed('TOKEN_FRAME_INVALID');
    });
    child.stderr.on('data', () => { /* Drain and intentionally discard helper diagnostics. */ });
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code !== 0 || signal) {
        finish(new ClientTokenBridgeError('TOKEN_HELPER_FAILED'));
        return;
      }
      try {
        finish(null, validateResponse(output, nonce));
      } catch (error) {
        finish(error instanceof ClientTokenBridgeError ? error : new ClientTokenBridgeError('TOKEN_RESPONSE_INVALID'));
      }
    });

    try {
      child.stdin.end(request);
    } catch {
      closeFailed('TOKEN_HELPER_PIPE_FAILED');
    }
  });
}

async function loadClientToken({ isDev = false, env = process.env, ...options } = {}) {
  const environmentToken = env.SHIGUANG_NODEGATEWAY_TOKEN;
  if (environmentToken !== undefined && environmentToken !== '') {
    if (!isDev) fail('TOKEN_ENV_FORBIDDEN');
    return validateToken(environmentToken);
  }
  return invokeTokenHelper({ sourceEnv: env, ...options });
}

module.exports = {
  AUDIENCE,
  ClientTokenBridgeError,
  CODEX_OPS_ROOT,
  CONTRACT,
  HELPER_ARGV,
  PURPOSE,
  PYTHON_EXE,
  REQUEST_SCHEMA,
  RESPONSE_SCHEMA,
  invokeTokenHelper,
  loadClientToken,
  validateResponse,
};
