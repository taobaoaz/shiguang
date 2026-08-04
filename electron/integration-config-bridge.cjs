const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MAX_OUTPUT_BYTES = 64 * 1024;
const CONFIG_TIMEOUT_MS = 5 * 60 * 1000;
const STATUS_TIMEOUT_MS = 15 * 1000;
const POWERSHELL_PATH = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe',
);
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SAFE_BUCKET = /^[a-z0-9][a-z0-9-]{0,49}-[0-9]{5,20}$/;
const SAFE_REGION = /^[a-z]{2,12}-[a-z0-9-]{2,40}$/;
const SAFE_HOST = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

class IntegrationConfigError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IntegrationConfigError';
    this.code = code;
  }
}

function exactRecord(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IntegrationConfigError('INTEGRATION_INPUT_INVALID');
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key)) || allowed.some((key) => !keys.includes(key))) {
    throw new IntegrationConfigError('INTEGRATION_INPUT_INVALID');
  }
  return value;
}

function validateAiInput(value) {
  const source = exactRecord(value, ['endpoint', 'model']);
  if (typeof source.endpoint !== 'string' || source.endpoint.length > 2048 || typeof source.model !== 'string' || !SAFE_MODEL.test(source.model)) {
    throw new IntegrationConfigError('AI_CONFIGURATION_INVALID');
  }
  let endpoint;
  try { endpoint = new URL(source.endpoint); } catch { throw new IntegrationConfigError('AI_ENDPOINT_INVALID'); }
  if (
    endpoint.protocol !== 'https:' || endpoint.pathname !== '/v1/chat/completions'
    || endpoint.search || endpoint.hash || endpoint.username || endpoint.password
    || !endpoint.hostname || !SAFE_HOST.test(endpoint.hostname) || endpoint.port
  ) throw new IntegrationConfigError('AI_ENDPOINT_INVALID');
  return { endpoint: endpoint.toString(), model: source.model };
}

function validateCosInput(value) {
  const source = exactRecord(value, ['bucket', 'region']);
  if (typeof source.bucket !== 'string' || !SAFE_BUCKET.test(source.bucket) || typeof source.region !== 'string' || !SAFE_REGION.test(source.region)) {
    throw new IntegrationConfigError('COS_CONFIGURATION_INVALID');
  }
  return { bucket: source.bucket, region: source.region };
}

function resolveScriptPath({ isDev, resourcesPath, dirname = __dirname }) {
  const candidate = isDev
    ? path.join(dirname, 'integration-configurator.ps1')
    : path.join(resourcesPath, 'app.asar.unpacked', 'electron', 'integration-configurator.ps1');
  if (!fs.existsSync(candidate)) throw new IntegrationConfigError('INTEGRATION_CONFIGURATOR_MISSING');
  return candidate;
}

function publicResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema_version !== 'shiguang.integration-config-result.v1') {
    throw new IntegrationConfigError('INTEGRATION_CONFIGURATOR_RESPONSE_INVALID');
  }
  const result = {
    schemaVersion: 'shiguang.integration-config-result.v1',
    ok: value.ok === true,
    code: typeof value.code === 'string' ? value.code.slice(0, 128) : 'INTEGRATION_CONFIGURATOR_FAILED',
  };
  if (value.kind === 'ai' || value.kind === 'cos' || value.kind === 'runtime') result.kind = value.kind;
  if (value.runtime && typeof value.runtime === 'object') {
    result.runtime = {
      taskInstalled: value.runtime.task_installed === true,
      taskState: typeof value.runtime.task_state === 'string' ? value.runtime.task_state.slice(0, 64) : '未安装',
    };
  }
  if (value.ai && typeof value.ai === 'object') {
    result.ai = {
      configured: value.ai.configured === true,
      endpointHost: typeof value.ai.endpoint_host === 'string' ? value.ai.endpoint_host.slice(0, 253) : null,
      model: typeof value.ai.model === 'string' ? value.ai.model.slice(0, 128) : null,
    };
  }
  if (value.cos && typeof value.cos === 'object') {
    result.cos = {
      configured: value.cos.configured === true,
      bucket: typeof value.cos.bucket === 'string' ? value.cos.bucket.slice(0, 80) : null,
      region: typeof value.cos.region === 'string' ? value.cos.region.slice(0, 64) : null,
    };
  }
  return result;
}

function runConfigurator(action, input, options = {}) {
  const allowed = new Set(['status', 'configure-ai', 'configure-cos', 'test-ai', 'start-runtime']);
  if (!allowed.has(action)) return Promise.reject(new IntegrationConfigError('INTEGRATION_ACTION_INVALID'));
  const scriptPath = resolveScriptPath(options);
  const payload = Buffer.from(JSON.stringify(input || {}), 'utf8').toString('base64url');
  const timeoutMs = action === 'status' ? STATUS_TIMEOUT_MS : CONFIG_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    let settled = false;
    let outputSize = 0;
    const stdout = [];
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(value);
    };
    const child = (options.spawnImpl || spawn)(POWERSHELL_PATH, [
      '-NoLogo', '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, '-Action', action, '-InputBase64Url', payload,
    ], {
      cwd: path.dirname(scriptPath),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: {
        SystemRoot: process.env.SystemRoot,
        USERPROFILE: process.env.USERPROFILE,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        TEMP: process.env.TEMP,
      },
    });
    const timer = setTimeout(() => {
      child.kill();
      finish(new IntegrationConfigError('INTEGRATION_CONFIGURATOR_TIMEOUT'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      const bytes = Buffer.from(chunk);
      outputSize += bytes.length;
      if (outputSize > MAX_OUTPUT_BYTES) {
        child.kill();
        clearTimeout(timer);
        finish(new IntegrationConfigError('INTEGRATION_CONFIGURATOR_RESPONSE_TOO_LARGE'));
        return;
      }
      stdout.push(bytes);
    });
    child.on('error', () => {
      clearTimeout(timer);
      finish(new IntegrationConfigError('INTEGRATION_CONFIGURATOR_START_FAILED'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      try {
        const parsed = JSON.parse(Buffer.concat(stdout).toString('utf8'));
        const result = publicResult(parsed);
        if (code !== 0 || !result.ok) finish(new IntegrationConfigError(result.code));
        else finish(null, result);
      } catch (error) {
        finish(error instanceof IntegrationConfigError ? error : new IntegrationConfigError('INTEGRATION_CONFIGURATOR_RESPONSE_INVALID'));
      }
    });
  });
}

function createIntegrationConfigBridge(options) {
  return Object.freeze({
    status: () => runConfigurator('status', {}, options),
    configure: (input) => {
      const source = exactRecord(input, ['kind', 'config']);
      if (source.kind === 'ai') return runConfigurator('configure-ai', validateAiInput(source.config), options);
      if (source.kind === 'cos') return runConfigurator('configure-cos', validateCosInput(source.config), options);
      throw new IntegrationConfigError('INTEGRATION_KIND_INVALID');
    },
    test: (input) => {
      const source = exactRecord(input, ['kind']);
      if (source.kind !== 'ai') throw new IntegrationConfigError('INTEGRATION_KIND_INVALID');
      return runConfigurator('test-ai', {}, options);
    },
    startRuntime: () => runConfigurator('start-runtime', {}, options),
  });
}

function createSafeIntegrationIpcHandler(operation, authorizeEvent = () => true) {
  return async (event, input) => {
    try {
      if (!authorizeEvent(event)) throw new IntegrationConfigError('IPC_CALLER_UNTRUSTED');
      return { ok: true, value: await operation(input) };
    } catch (error) {
      const code = error instanceof IntegrationConfigError ? error.code : 'INTEGRATION_INTERNAL_ERROR';
      return { ok: false, error: { code, message: code } };
    }
  };
}

module.exports = {
  IntegrationConfigError,
  createIntegrationConfigBridge,
  createSafeIntegrationIpcHandler,
  publicResult,
  resolveScriptPath,
  validateAiInput,
  validateCosInput,
};
