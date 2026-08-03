import assert from 'node:assert/strict';
import test from 'node:test';
import { pushReceiptPresentation, verifiedPullPresentation } from './syncOutcome.ts';

const VERSION_ID = `sha256:${'a'.repeat(64)}`;

test('accepted POST is presented only as a local pending queue receipt', () => {
  const result = pushReceiptPresentation('accepted', VERSION_ID);
  assert.equal(result.lastStatus, '已入本地待同步队列');
  assert.match(result.toast, /^已入本地待同步队列：sha256:[a-f]+…$/);
  assert.equal(JSON.stringify(result).includes('已同步'), false);
  assert.equal(JSON.stringify(result).includes('云端校验完成'), false);
});

test('committed POST still waits for a fresh cloud read before claiming verification', () => {
  const result = pushReceiptPresentation('committed', VERSION_ID);
  assert.equal(result.lastStatus, '已写入本地版本库，等待云端校验');
  assert.equal(JSON.stringify(result).includes('已同步'), false);
  assert.equal(JSON.stringify(result).includes('云端校验完成'), false);
});

test('only a fresh remote pull reports cloud verification complete', () => {
  const result = verifiedPullPresentation('2026/8/2 02:00:00');
  assert.equal(result.lastStatus, '云端校验完成 2026/8/2 02:00:00');
  assert.equal(result.toast, '已从 PAW 拉取，云端版本校验完成');
});
