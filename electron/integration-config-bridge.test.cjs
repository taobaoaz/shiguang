const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  publicResult,
  validateAiInput,
  validateCosInput,
} = require('./integration-config-bridge.cjs');

test('AI setup accepts only a fixed HTTPS chat completions endpoint and bounded model', () => {
  assert.deepEqual(validateAiInput({
    endpoint: 'https://api.example.com/v1/chat/completions',
    model: 'work-state-model',
  }), {
    endpoint: 'https://api.example.com/v1/chat/completions',
    model: 'work-state-model',
  });
  for (const endpoint of [
    'http://api.example.com/v1/chat/completions',
    'https://api.example.com/v1/models',
    'https://user:secret@api.example.com/v1/chat/completions',
    'https://api.example.com:8443/v1/chat/completions',
  ]) assert.throws(() => validateAiInput({ endpoint, model: 'model' }));
  assert.throws(() => validateAiInput({ endpoint: 'https://api.example.com/v1/chat/completions', model: 'bad model' }));
  assert.throws(() => validateAiInput({ endpoint: 'https://api.example.com/v1/chat/completions', model: 'model', apiKey: 'forbidden' }));
});

test('COS setup accepts only bucket and region while credentials stay out of renderer IPC', () => {
  assert.deepEqual(validateCosInput({ bucket: 'paw-bucket-1234567890', region: 'ap-beijing' }), {
    bucket: 'paw-bucket-1234567890',
    region: 'ap-beijing',
  });
  assert.throws(() => validateCosInput({ bucket: 'paw-bucket', region: 'ap-beijing' }));
  assert.throws(() => validateCosInput({ bucket: 'paw-bucket-1234567890', region: 'https://cos.example' }));
  assert.throws(() => validateCosInput({ bucket: 'paw-bucket-1234567890', region: 'ap-beijing', secretKey: 'forbidden' }));
});

test('configurator output is reduced to public status metadata', () => {
  const result = publicResult({
    schema_version: 'shiguang.integration-config-result.v1',
    ok: true,
    code: 'INTEGRATION_STATUS_READY',
    runtime: { task_installed: true, task_state: 'Running', executable: 'forbidden' },
    ai: { configured: true, endpoint_host: 'api.example.com', model: 'model', protected_api_key_base64: 'forbidden' },
    cos: { configured: true, bucket: 'bucket-1234567890', region: 'ap-beijing', secret_key: 'forbidden' },
  });
  assert.deepEqual(result, {
    schemaVersion: 'shiguang.integration-config-result.v1',
    ok: true,
    code: 'INTEGRATION_STATUS_READY',
    runtime: { taskInstalled: true, taskState: 'Running' },
    ai: { configured: true, endpointHost: 'api.example.com', model: 'model' },
    cos: { configured: true, bucket: 'bucket-1234567890', region: 'ap-beijing' },
  });
  assert.equal(JSON.stringify(result).includes('forbidden'), false);
});

test('DPAPI helper copies the BSTR byte length exactly', () => {
  const script = fs.readFileSync(path.join(__dirname, 'integration-configurator.ps1'), 'utf8');
  assert.match(script, /ReadInt32\(\$pointer, -4\)/);
  assert.match(script, /New-Object byte\[\] \$byteCount/);
  assert.doesNotMatch(script, /\$byteCount \* 2|\$charCount \* 2/);
});

test('secure writer replaces an existing config without the unsupported null backup path', () => {
  const script = fs.readFileSync(path.join(__dirname, 'integration-configurator.ps1'), 'utf8');
  assert.match(script, /Move-Item -LiteralPath \$temporary -Destination \$Path -Force/);
  assert.doesNotMatch(script, /\[IO\.File\]::Replace\([^\r\n]+\$null\)/);
});

test('credential input uses an isolated masked Windows dialog and stable stage errors', () => {
  const script = fs.readFileSync(path.join(__dirname, 'integration-configurator.ps1'), 'utf8');
  assert.match(script, /UseSystemPasswordChar = \$true/);
  assert.match(script, /Request-SecretCredential/);
  assert.doesNotMatch(script, /Get-Credential/);
  assert.match(script, /INTEGRATION_CREDENTIAL_PROMPT_FAILED/);
  assert.match(script, /INTEGRATION_CONFIG_WRITE_FAILED/);
});
