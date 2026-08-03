import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskItem } from '../types/index.ts';
import {
  SYSTEM_TASK, dateToLocalIso, fileTagValue, getSource, getWorkItemType,
  isOverdue, isSystemTask, phaseForStatus, visibleTasks,
} from './workbench.ts';

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'WORK-1',
  title: '核心交换机巡检',
  priority: '高',
  status: '待处理',
  time: '2026-08-03',
  phase: '需求评审',
  assignee: { name: '老大', avatar: '老大', role: '负责人' },
  project: '个人工作台',
  deadline: '2099-12-31',
  description: '',
  tags: ['类型:巡检', '来源:手动录入'],
  aiSuggestions: [],
  completionProgress: 0,
  ...overrides,
});

test('system sentinel keeps the gateway contract valid but stays out of business views', () => {
  assert.equal(isSystemTask(SYSTEM_TASK), true);
  assert.deepEqual(visibleTasks([SYSTEM_TASK, task()]).map((item) => item.id), ['WORK-1']);
});

test('work item compatibility metadata maps to workbench semantics', () => {
  const item = task();
  assert.equal(getWorkItemType(item), '巡检');
  assert.equal(getSource(item), '手动录入');
  assert.equal(phaseForStatus('进行中'), '产品设计');
  assert.equal(phaseForStatus('已完成'), '测试验证');
});

test('local calendar date and overdue checks do not depend on UTC day boundaries', () => {
  assert.equal(dateToLocalIso(new Date(2026, 7, 3, 0, 30)), '2026-08-03');
  assert.equal(isOverdue(task({ deadline: '2000-01-01' })), true);
  assert.equal(isOverdue(task({ deadline: '2000-01-01', status: '已完成' })), false);
  assert.equal(isOverdue(task({ deadline: '待确认' })), false);
});

test('asset tag values expose explicit pending state instead of inventing data', () => {
  assert.equal(fileTagValue(['IP:10.0.0.1'], 'IP'), '10.0.0.1');
  assert.equal(fileTagValue([], '位置'), '待确认');
});
