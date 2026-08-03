import assert from 'node:assert/strict';
import test from 'node:test';
import { ShiguangSyncController } from './shiguangSync.ts';
import { SHIGUANG_STATE_SCHEMA, type ShiguangState } from './shiguangState.ts';

const state = (workspace = '家庭工作台'): ShiguangState => ({
  schema_version: SHIGUANG_STATE_SCHEMA,
  tasks: [],
  files: [],
  fileGroups: [],
  workspaces: [workspace],
  currentWorkspace: workspace,
  dailyBrief: {
    schemaVersion: 'paw.work-state.daily-brief.v1',
    date: '2026-08-03',
    generatedAt: '待生成',
    sourceDigest: '待生成',
    summary: '',
    doneIds: [],
    todoIds: [],
    attentionIds: [],
    fileIds: [],
  },
});

const status = () => ({
  ok: true as const,
  value: {
    schemaVersion: 'shiguang.gateway.status.v1' as const,
    configured: true,
    connected: true,
    code: 'NODEGATEWAY_CONNECTED',
  },
});

test('application start connects and pulls the remote state once', async () => {
  let pulls = 0;
  let pushes = 0;
  let imported: unknown;
  const remote = state();
  const gateway = {
    status: async () => status(),
    pullState: async () => {
      pulls += 1;
      return { ok: true as const, value: {
        schemaVersion: 'shiguang.state-pull-result.v1' as const,
        status: 'remote-loaded' as const,
        headCount: 1 as const,
        versionId: `sha256:${'a'.repeat(64)}`,
        contentSha256: `sha256:${'b'.repeat(64)}`,
        state: remote,
      } };
    },
    pushState: async () => {
      pushes += 1;
      throw new Error('unexpected automatic push');
    },
  };
  const controller = new ShiguangSyncController(
    gateway,
    (value) => { imported = value; },
    () => remote,
  );

  await controller.start();
  controller.stop();
  assert.equal(pulls, 1);
  assert.equal(pushes, 0);
  assert.equal(imported, remote);
  assert.equal(controller.getSnapshot().phase, 'connected');
});

test('local changes only mark dirty and never upload until explicit submit', async () => {
  let pushes = 0;
  let current = state();
  const gateway = {
    status: async () => status(),
    pullState: async () => ({ ok: true as const, value: {
      schemaVersion: 'shiguang.state-pull-result.v1' as const,
      status: 'local-only' as const,
      headCount: 0 as const,
    } }),
    pushState: async () => {
      pushes += 1;
      return { ok: true as const, value: {
        workspace_id: 'personal-workbench',
        file_id: 'shiguang-state' as const,
        version_id: `sha256:${'c'.repeat(64)}`,
        event_id: 'event-1',
        event_hash: `sha256:${'d'.repeat(64)}`,
        status: 'accepted' as const,
        replayed: false,
      } };
    },
  };
  const controller = new ShiguangSyncController(gateway, () => undefined, () => current);

  await controller.start();
  current = state('家庭工作台-已修改');
  controller.markLocalState(current);
  await controller.refreshStatus();
  assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(pushes, 0);

  await controller.submitNow();
  controller.stop();
  assert.equal(pushes, 1);
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().submitStatus, 'accepted');
});

test('multiple remote heads enter conflict mode and block submit', async () => {
  let pushes = 0;
  const local = state();
  const gateway = {
    status: async () => status(),
    pullState: async () => ({ ok: true as const, value: {
      schemaVersion: 'shiguang.state-pull-result.v1' as const,
      status: 'conflict' as const,
      headCount: 2,
    } }),
    pushState: async () => {
      pushes += 1;
      throw new Error('unexpected push');
    },
  };
  const controller = new ShiguangSyncController(gateway, () => undefined, () => local);

  await controller.start();
  await controller.refreshStatus();
  await assert.rejects(controller.submitNow(), /SHIGUANG_STATE_CONFLICT/);
  controller.stop();
  assert.equal(controller.getSnapshot().phase, 'conflict');
  assert.equal(pushes, 0);
});
