import assert from 'node:assert/strict';
import test from 'node:test';
import { SHIGUANG_INTEGRATIONS } from './integrations.ts';

test('AI and COS settings entries are NodeGateway-owned and expose no direct credentials', () => {
  assert.deepEqual(Object.keys(SHIGUANG_INTEGRATIONS), ['ai', 'cos']);
  for (const entry of Object.values(SHIGUANG_INTEGRATIONS)) {
    assert.equal(entry.configurationOwner, 'nodegateway');
    assert.equal(entry.credentialOwner, 'nodegateway');
    assert.equal(entry.directConnectionAllowed, false);
  }
  assert.equal(SHIGUANG_INTEGRATIONS.ai.lifecycleState, 'pending');
  assert.equal(SHIGUANG_INTEGRATIONS.cos.lifecycleState, 'active');
});

test('settings entries keep AI inference and COS persistence as separate capabilities', () => {
  assert.equal(SHIGUANG_INTEGRATIONS.ai.backendCapability, 'work-state-ai-provider');
  assert.equal(SHIGUANG_INTEGRATIONS.cos.backendCapability, 'shiguang-workspace-sync');
});
