const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const {
  AUDIENCE,
  CODEX_OPS_ROOT,
  CONTRACT,
  HELPER_ARGV,
  PURPOSE,
  PYTHON_EXE,
  REQUEST_SCHEMA,
  RESPONSE_SCHEMA,
  invokeTokenHelper,
  loadClientToken,
} = require('./client-token-bridge.cjs');

const TOKEN = 'A'.repeat(43);

function decodeFrame(bytes) {
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.readUInt32BE(0), bytes.length - 4);
  return JSON.parse(bytes.subarray(4).toString('utf8'));
}

function encodeFrame(value, { canonical = true } = {}) {
  const body = Buffer.from(JSON.stringify(
    canonical
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
      : value,
  ));
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(body.length);
  return Buffer.concat([prefix, body]);
}

function respondingSpawn(responder, capture = {}) {
  return (command, argv, options) => {
    Object.assign(capture, { command, argv, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { capture.killed = true; };
    child.stdin = {
      end(requestBytes) {
        capture.requestBytes = requestBytes;
        const request = decodeFrame(requestBytes);
        process.nextTick(() => responder({ child, request, capture }));
      },
    };
    return child;
  };
}

function validResponse(request) {
  return {
    schema_version: RESPONSE_SCHEMA,
    contract: CONTRACT,
    audience: AUDIENCE,
    nonce: request.nonce,
    token: TOKEN,
  };
}

test('helper invocation uses the fixed executable, argv, cwd, framed JCS request, and a secret-minimized environment', async () => {
  const capture = {};
  const token = await invokeTokenHelper({
    sourceEnv: {
      SystemRoot: String.raw`C:\Windows`,
      USERPROFILE: String.raw`C:\Users\19031`,
      PATH: String.raw`C:\Windows\System32`,
      SHIGUANG_NODEGATEWAY_TOKEN: 'must-not-be-forwarded',
      PAW_PLAN_DIGEST: 'must-not-be-forwarded',
      PAW_SENSITIVE_VALUE: 'must-not-be-forwarded',
    },
    spawnImpl: respondingSpawn(({ child, request }) => {
      child.stdout.end(encodeFrame(validResponse(request)));
      child.emit('close', 0, null);
    }, capture),
  });

  assert.equal(token, TOKEN);
  assert.equal(capture.command, PYTHON_EXE);
  assert.deepEqual(capture.argv, HELPER_ARGV);
  assert.equal(capture.options.cwd, CODEX_OPS_ROOT);
  assert.equal(capture.options.shell, false);
  assert.equal(capture.options.windowsHide, true);
  assert.deepEqual(capture.options.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(capture.options.env.SHIGUANG_NODEGATEWAY_TOKEN, undefined);
  assert.equal(capture.options.env.PAW_PLAN_DIGEST, undefined);
  assert.equal(capture.options.env.PAW_SENSITIVE_VALUE, undefined);
  assert.equal(capture.options.env.PYTHONPATH, String.raw`D:\我的个人工作台\02-进行中项目\codex-ops\src`);

  const request = decodeFrame(capture.requestBytes);
  assert.deepEqual(Object.keys(request).sort(), ['audience', 'contract', 'nonce', 'purpose', 'schema_version']);
  assert.equal(request.schema_version, REQUEST_SCHEMA);
  assert.equal(request.contract, CONTRACT);
  assert.equal(request.audience, AUDIENCE);
  assert.equal(request.purpose, PURPOSE);
  assert.match(request.nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  const requestBody = capture.requestBytes.subarray(4).toString('utf8');
  assert.equal(requestBody, JSON.stringify(Object.fromEntries(Object.entries(request).sort(([a], [b]) => a.localeCompare(b)))));
});

test('production rejects an environment token while development may opt in without spawning', async () => {
  let spawned = false;
  const spawnImpl = () => { spawned = true; };
  await assert.rejects(
    () => loadClientToken({ isDev: false, env: { SHIGUANG_NODEGATEWAY_TOKEN: TOKEN }, spawnImpl }),
    (error) => error.code === 'TOKEN_ENV_FORBIDDEN' && !String(error).includes(TOKEN),
  );
  assert.equal(spawned, false);
  assert.equal(await loadClientToken({ isDev: true, env: { SHIGUANG_NODEGATEWAY_TOKEN: TOKEN }, spawnImpl }), TOKEN);
  assert.equal(spawned, false);
});

test('response fails closed on schema, nonce, token, canonicalization, framing, and helper failure', async (t) => {
  const cases = [
    ['unknown field', (request) => ({ ...validResponse(request), extra: true }), 'TOKEN_RESPONSE_INVALID', true],
    ['nonce mismatch', (request) => ({ ...validResponse(request), nonce: '018f47a2-0000-7000-8000-000000000000' }), 'TOKEN_NONCE_MISMATCH', true],
    ['invalid token', (request) => ({ ...validResponse(request), token: `bad token ${TOKEN}` }), 'TOKEN_VALUE_INVALID', true],
    ['noncanonical JSON', (request) => validResponse(request), 'TOKEN_RESPONSE_NOT_CANONICAL', false],
  ];
  for (const [name, responseFactory, code, canonical] of cases) {
    await t.test(name, async () => {
      const spawnImpl = respondingSpawn(({ child, request }) => {
        child.stdout.end(encodeFrame(responseFactory(request), { canonical }));
        child.emit('close', 0, null);
      });
      await assert.rejects(() => invokeTokenHelper({ spawnImpl }), (error) => error.code === code && !String(error).includes(TOKEN));
    });
  }

  await t.test('trailing bytes', async () => {
    const spawnImpl = respondingSpawn(({ child, request }) => {
      child.stdout.end(Buffer.concat([encodeFrame(validResponse(request)), Buffer.from([0])]));
      child.emit('close', 0, null);
    });
    await assert.rejects(() => invokeTokenHelper({ spawnImpl }), (error) => error.code === 'TOKEN_FRAME_INVALID');
  });

  await t.test('nonzero exit', async () => {
    const spawnImpl = respondingSpawn(({ child }) => child.emit('close', 2, null));
    await assert.rejects(() => invokeTokenHelper({ spawnImpl }), (error) => error.code === 'TOKEN_HELPER_FAILED');
  });
});

test('timeout kills the helper and exposes only a stable non-secret code', async () => {
  const capture = {};
  const spawnImpl = respondingSpawn(() => {}, capture);
  await assert.rejects(
    () => invokeTokenHelper({ spawnImpl, timeoutMs: 100 }),
    (error) => error.code === 'TOKEN_HELPER_TIMEOUT' && error.message === 'TOKEN_HELPER_TIMEOUT',
  );
  assert.equal(capture.killed, true);
});
