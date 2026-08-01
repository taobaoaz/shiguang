import type { FileDoc, TaskItem } from '@/types';

export const SHIGUANG_STATE_SCHEMA = 'paw.shiguang.state.v1' as const;

export interface ShiguangState {
  schema_version: typeof SHIGUANG_STATE_SCHEMA;
  tasks: TaskItem[];
  files: FileDoc[];
  workspaces: string[];
  currentWorkspace: string;
  settings: {
    accentColor: 'emerald' | 'cyan' | 'purple';
    glassBlur: 'standard' | 'ultra' | 'max';
    enableConfetti: boolean;
  };
}

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}_INVALID`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`${label}_FIELDS_INVALID`);
  }
  if (keys.some((key) => !hasOwn(value, key))) throw new Error(`${label}_FIELDS_INVALID`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 10000): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new Error(`${label}_INVALID`);
  return value;
}

function stringArray(value: unknown, label: string, maxItems = 128): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label}_INVALID`);
  return value.map((item) => text(item, label, 512));
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label}_INVALID`);
  return value as T;
}

function task(value: unknown): TaskItem {
  const allowed = [
    'id', 'title', 'priority', 'status', 'time', 'phase', 'assignee', 'project',
    'deadline', 'description', 'tags', 'aiSuggestions', 'completionProgress',
  ] as const;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('SHIGUANG_TASK_INVALID');
  const actual = Object.keys(value);
  const required = allowed.filter((key) => !['aiSuggestions', 'completionProgress'].includes(key));
  if (actual.some((key) => !allowed.includes(key as typeof allowed[number])) || required.some((key) => !hasOwn(value, key))) {
    throw new Error('SHIGUANG_TASK_FIELDS_INVALID');
  }
  const source = value as Record<string, unknown>;
  const assignee = record(source.assignee, ['name', 'avatar', 'role'], 'SHIGUANG_ASSIGNEE');
  const result: TaskItem = {
    id: text(source.id, 'SHIGUANG_TASK_ID', 256),
    title: text(source.title, 'SHIGUANG_TASK_TITLE', 1000),
    priority: enumValue(source.priority, ['高', '中', '低', '高优先级', '紧急'], 'SHIGUANG_TASK_PRIORITY'),
    status: enumValue(source.status, ['进行中', '已完成', '待处理', '已延期'], 'SHIGUANG_TASK_STATUS'),
    time: text(source.time, 'SHIGUANG_TASK_TIME', 128),
    phase: enumValue(source.phase, ['需求评审', '产品设计', '开发实现', '测试验证'], 'SHIGUANG_TASK_PHASE'),
    assignee: {
      name: text(assignee.name, 'SHIGUANG_ASSIGNEE_NAME', 256),
      avatar: text(assignee.avatar, 'SHIGUANG_ASSIGNEE_AVATAR', 128),
      role: text(assignee.role, 'SHIGUANG_ASSIGNEE_ROLE', 256),
    },
    project: text(source.project, 'SHIGUANG_TASK_PROJECT', 512),
    deadline: text(source.deadline, 'SHIGUANG_TASK_DEADLINE', 128),
    description: typeof source.description === 'string' && source.description.length <= 10000
      ? source.description
      : (() => { throw new Error('SHIGUANG_TASK_DESCRIPTION_INVALID'); })(),
    tags: stringArray(source.tags, 'SHIGUANG_TASK_TAGS'),
  };
  if (hasOwn(source, 'aiSuggestions')) result.aiSuggestions = stringArray(source.aiSuggestions, 'SHIGUANG_TASK_SUGGESTIONS');
  if (hasOwn(source, 'completionProgress')) {
    if (!Number.isFinite(source.completionProgress) || Number(source.completionProgress) < 0 || Number(source.completionProgress) > 100) {
      throw new Error('SHIGUANG_TASK_PROGRESS_INVALID');
    }
    result.completionProgress = Number(source.completionProgress);
  }
  return result;
}

function file(value: unknown): FileDoc {
  const allowed = ['id', 'title', 'category', 'size', 'author', 'updatedAt', 'completion', 'tags'] as const;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('SHIGUANG_FILE_INVALID');
  const actual = Object.keys(value);
  const required = allowed.filter((key) => key !== 'completion');
  if (actual.some((key) => !allowed.includes(key as typeof allowed[number])) || required.some((key) => !hasOwn(value, key))) {
    throw new Error('SHIGUANG_FILE_FIELDS_INVALID');
  }
  const source = value as Record<string, unknown>;
  const result: FileDoc = {
    id: text(source.id, 'SHIGUANG_FILE_ID', 256),
    title: text(source.title, 'SHIGUANG_FILE_TITLE', 1000),
    category: text(source.category, 'SHIGUANG_FILE_CATEGORY', 256),
    size: text(source.size, 'SHIGUANG_FILE_SIZE', 128),
    author: text(source.author, 'SHIGUANG_FILE_AUTHOR', 256),
    updatedAt: text(source.updatedAt, 'SHIGUANG_FILE_UPDATED_AT', 128),
    tags: stringArray(source.tags, 'SHIGUANG_FILE_TAGS'),
  };
  if (hasOwn(source, 'completion')) {
    if (!Number.isFinite(source.completion) || Number(source.completion) < 0 || Number(source.completion) > 100) {
      throw new Error('SHIGUANG_FILE_COMPLETION_INVALID');
    }
    result.completion = Number(source.completion);
  }
  return result;
}

export function parseShiguangState(value: unknown): ShiguangState {
  const source = record(
    value,
    ['schema_version', 'tasks', 'files', 'workspaces', 'currentWorkspace', 'settings'],
    'SHIGUANG_STATE',
  );
  if (source.schema_version !== SHIGUANG_STATE_SCHEMA) throw new Error('SHIGUANG_STATE_SCHEMA_INVALID');
  if (!Array.isArray(source.tasks) || source.tasks.length < 1 || source.tasks.length > 5000) throw new Error('SHIGUANG_TASKS_INVALID');
  if (!Array.isArray(source.files) || source.files.length > 10000) throw new Error('SHIGUANG_FILES_INVALID');
  const tasks = source.tasks.map(task);
  const files = source.files.map(file);
  if (new Set(tasks.map((item) => item.id)).size !== tasks.length) throw new Error('SHIGUANG_TASK_IDS_DUPLICATE');
  if (new Set(files.map((item) => item.id)).size !== files.length) throw new Error('SHIGUANG_FILE_IDS_DUPLICATE');
  const workspaces = stringArray(source.workspaces, 'SHIGUANG_WORKSPACES', 1000);
  if (workspaces.length < 1 || new Set(workspaces).size !== workspaces.length) throw new Error('SHIGUANG_WORKSPACES_INVALID');
  const currentWorkspace = text(source.currentWorkspace, 'SHIGUANG_CURRENT_WORKSPACE', 512);
  if (!workspaces.includes(currentWorkspace)) throw new Error('SHIGUANG_CURRENT_WORKSPACE_INVALID');
  const settings = record(source.settings, ['accentColor', 'glassBlur', 'enableConfetti'], 'SHIGUANG_SETTINGS');
  if (typeof settings.enableConfetti !== 'boolean') throw new Error('SHIGUANG_SETTINGS_INVALID');
  return {
    schema_version: SHIGUANG_STATE_SCHEMA,
    tasks,
    files,
    workspaces,
    currentWorkspace,
    settings: {
      accentColor: enumValue(settings.accentColor, ['emerald', 'cyan', 'purple'], 'SHIGUANG_ACCENT'),
      glassBlur: enumValue(settings.glassBlur, ['standard', 'ultra', 'max'], 'SHIGUANG_BLUR'),
      enableConfetti: settings.enableConfetti,
    },
  };
}
