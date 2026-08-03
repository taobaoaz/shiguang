import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskItem } from '../types/index.ts';
import {
  countByStage, dateToLocalIso, fileTagValue, getSource, getWorkItemType,
  isOverdue, visibleTasks, workStageGroup, workStageLabel,
} from './workbench.ts';

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'WORK-1',
  title: '核心交换机巡检',
  priority: '高',
  stage: 'RECEIVED',
  assignee: { name: '老大', avatar: '老大', role: '负责人' },
  project: '个人工作台',
  deadline: '2099-12-31',
  description: '',
  tags: ['类型:巡检', '来源:手动录入'],
  aiSuggestions: [],
  completionProgress: 0,
  nextAction: '待分类',
  attentionFlags: [],
  sourceRefs: ['source:manual:test'],
  evidenceRefs: [],
  fileRefs: [],
  createdAt: '2026-08-03T00:00:00Z',
  updatedAt: '2026-08-03T00:00:00Z',
  ...overrides,
});

test('five workflow stages map to fixed local file groups', () => {
  assert.equal(workStageLabel.RECEIVED, '收到工作');
  assert.equal(workStageGroup.RECEIVED, '01-收到工作');
  assert.equal(workStageGroup.ARCHIVED, '05-归档的');
  assert.deepEqual(countByStage([
    task(),
    task({ id: 'WORK-2', stage: 'IN_PROGRESS' }),
    task({ id: 'WORK-3', stage: 'ARCHIVED', completedAt: '2026-08-03T00:00:00Z', archivedAt: '2026-08-03T00:00:00Z' }),
  ]), { RECEIVED: 1, TRIAGED: 0, IN_PROGRESS: 1, COMPLETED: 0, ARCHIVED: 1 });
});

test('work item compatibility metadata maps to workbench semantics', () => {
  const item = task();
  assert.equal(getWorkItemType(item), '巡检');
  assert.equal(getSource(item), '手动录入');
  assert.deepEqual(visibleTasks([item]), [item]);
});

test('local calendar date and overdue checks do not depend on UTC day boundaries', () => {
  assert.equal(dateToLocalIso(new Date(2026, 7, 3, 0, 30)), '2026-08-03');
  assert.equal(isOverdue(task({ deadline: '2000-01-01' })), true);
  assert.equal(isOverdue(task({ deadline: '2000-01-01', stage: 'COMPLETED', completedAt: '2026-08-03T00:00:00Z' })), false);
  assert.equal(isOverdue(task({ deadline: '待确认' })), false);
});

test('asset tag values expose explicit pending state instead of inventing data', () => {
  assert.equal(fileTagValue(['IP:10.0.0.1'], 'IP'), '10.0.0.1');
  assert.equal(fileTagValue([], '位置'), '待确认');
});
