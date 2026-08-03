import assert from 'node:assert/strict';
import test from 'node:test';
import { parseShiguangState, SHIGUANG_STATE_SCHEMA } from './shiguangState.ts';

test('legacy v1 state migrates to five-stage v2 without the system sentinel', () => {
  const migrated = parseShiguangState({
    schema_version: 'paw.shiguang.state.v1',
    tasks: [
      {
        id: 'SYSTEM-WORKBENCH-READY', title: '占位', priority: '低', status: '已完成', time: '系统', phase: '测试验证',
        assignee: { name: '拾光', avatar: 'SG', role: '系统' }, project: '个人工作台', deadline: '待确认', description: '', tags: ['系统占位'],
      },
      {
        id: 'WORK-1', title: '处理网络告警', priority: '高', status: '已延期', time: '2026-08-03', phase: '开发实现',
        assignee: { name: '老大', avatar: 'LD', role: '负责人' }, project: '网络', deadline: '2026-08-03', description: '', tags: ['类型:故障'],
      },
    ],
    files: [],
    workspaces: ['个人工作台'],
    currentWorkspace: '个人工作台',
    settings: { accentColor: 'purple', glassBlur: 'ultra', enableConfetti: true },
  });
  assert.equal(migrated.schema_version, SHIGUANG_STATE_SCHEMA);
  assert.equal(migrated.tasks.length, 1);
  assert.equal(migrated.tasks[0].stage, 'IN_PROGRESS');
  assert.deepEqual(migrated.tasks[0].attentionFlags, ['OVERDUE']);
  assert.deepEqual(migrated.fileGroups, []);
});

test('v2 rejects archived work without completion and archive timestamps', () => {
  assert.throws(() => parseShiguangState({
    schema_version: SHIGUANG_STATE_SCHEMA,
    tasks: [{
      id: 'WORK-1', title: '归档项', priority: '中', stage: 'ARCHIVED',
      assignee: { name: '老大', avatar: 'LD', role: '负责人' }, project: '网络', deadline: '待确认', description: '', tags: [],
      nextAction: '无', attentionFlags: [], sourceRefs: [], evidenceRefs: [], fileRefs: [],
      createdAt: '2026-08-03T00:00:00Z', updatedAt: '2026-08-03T00:00:00Z',
    }],
    files: [], fileGroups: [], workspaces: ['个人工作台'], currentWorkspace: '个人工作台',
    dailyBrief: { schemaVersion: 'paw.work-state.daily-brief.v1', date: '2026-08-03', generatedAt: '待生成', sourceDigest: '待生成', summary: '', doneIds: [], todoIds: [], attentionIds: [], fileIds: [] },
  }), /COMPLETED_AT_REQUIRED/);
});

const linkedState = () => ({
  schema_version: SHIGUANG_STATE_SCHEMA,
  tasks: [{
    id: 'WORK-2', title: '整理交换机配置', priority: '中', stage: 'TRIAGED',
    assignee: { name: '老大', avatar: 'LD', role: '负责人' }, project: '网络', deadline: '待确认', description: '', tags: [],
    nextAction: '核对配置', attentionFlags: [], sourceRefs: [], evidenceRefs: [], fileRefs: ['FILE-1'],
    createdAt: '2026-08-03T00:00:00Z', updatedAt: '2026-08-03T00:00:00Z',
  }],
  files: [{ id: 'FILE-1', title: '交换机配置', category: '工作资料', size: '仅元数据', author: '老大', updatedAt: '2026-08-03T00:00:00Z', tags: [] }],
  fileGroups: [{ fileId: 'FILE-1', groupId: 'triaged', workItemId: 'WORK-2', residency: 'metadata-only', updatedAt: '2026-08-03T00:00:00Z' }],
  workspaces: ['个人工作台'], currentWorkspace: '个人工作台',
  dailyBrief: { schemaVersion: 'paw.work-state.daily-brief.v1', date: '2026-08-03', generatedAt: '待生成', sourceDigest: '待生成', summary: '', doneIds: [], todoIds: [], attentionIds: [], fileIds: ['FILE-1'] },
});

test('v2 accepts a task with one corresponding file and matching stage group', () => {
  const parsed = parseShiguangState(linkedState());
  assert.equal(parsed.tasks[0].fileRefs[0], 'FILE-1');
  assert.equal(parsed.fileGroups[0].workItemId, 'WORK-2');
});

test('v2 rejects an unknown task file reference', () => {
  const value = linkedState();
  value.tasks[0].fileRefs = ['FILE-MISSING'];
  assert.throws(() => parseShiguangState(value), /TASK_FILE_REF_UNKNOWN/);
});

test('v2 rejects a file group that does not match its task stage', () => {
  const value = linkedState();
  value.fileGroups[0].groupId = 'completed';
  assert.throws(() => parseShiguangState(value), /FILE_GROUP_STAGE_MISMATCH/);
});

