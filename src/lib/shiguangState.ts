import type {
  AttentionFlag, DailyBrief, FileDoc, FileGroupEntry, FileResidency,
  Priority, TaskItem, WorkStage,
} from '@/types';

export const SHIGUANG_STATE_SCHEMA = 'paw.shiguang.state.v2' as const;
export const LEGACY_SHIGUANG_STATE_SCHEMA = 'paw.shiguang.state.v1' as const;

export interface ShiguangState {
  schema_version: typeof SHIGUANG_STATE_SCHEMA;
  tasks: TaskItem[];
  files: FileDoc[];
  fileGroups: FileGroupEntry[];
  workspaces: string[];
  currentWorkspace: string;
  dailyBrief: DailyBrief;
}

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}_INVALID`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) throw new Error(`${label}_FIELDS_INVALID`);
  if (keys.some((key) => !hasOwn(value, key))) throw new Error(`${label}_FIELDS_INVALID`);
  return value as Record<string, unknown>;
}

function flexibleRecord(value: unknown, allowed: readonly string[], required: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}_INVALID`);
  const actual = Object.keys(value);
  if (actual.some((key) => !allowed.includes(key)) || required.some((key) => !hasOwn(value, key))) throw new Error(`${label}_FIELDS_INVALID`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 10000, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length < 1) || value.length > max) throw new Error(`${label}_INVALID`);
  return value;
}

function stringArray(value: unknown, label: string, maxItems = 128): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label}_INVALID`);
  const values = value.map((item) => text(item, label, 512));
  if (new Set(values).size !== values.length) throw new Error(`${label}_DUPLICATE`);
  return values;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label}_INVALID`);
  return value as T;
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  return value === undefined ? undefined : text(value, label, max);
}

function task(value: unknown): TaskItem {
  const allowed = [
    'id', 'title', 'priority', 'stage', 'assignee', 'project', 'deadline', 'description', 'tags',
    'aiSuggestions', 'completionProgress', 'nextAction', 'attentionFlags', 'sourceRefs',
    'evidenceRefs', 'fileRefs', 'createdAt', 'updatedAt', 'completedAt', 'archivedAt',
  ] as const;
  const required = allowed.filter((key) => !['aiSuggestions', 'completionProgress', 'completedAt', 'archivedAt'].includes(key));
  const source = flexibleRecord(value, allowed, required, 'SHIGUANG_TASK');
  const assignee = record(source.assignee, ['name', 'avatar', 'role'], 'SHIGUANG_ASSIGNEE');
  const stage = enumValue<WorkStage>(source.stage, ['RECEIVED', 'TRIAGED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'], 'SHIGUANG_TASK_STAGE');
  const completedAt = optionalText(source.completedAt, 'SHIGUANG_TASK_COMPLETED_AT', 64);
  const archivedAt = optionalText(source.archivedAt, 'SHIGUANG_TASK_ARCHIVED_AT', 64);
  if ((stage === 'COMPLETED' || stage === 'ARCHIVED') && !completedAt) throw new Error('SHIGUANG_TASK_COMPLETED_AT_REQUIRED');
  if (stage === 'ARCHIVED' && !archivedAt) throw new Error('SHIGUANG_TASK_ARCHIVED_AT_REQUIRED');
  if (stage !== 'ARCHIVED' && archivedAt) throw new Error('SHIGUANG_TASK_ARCHIVED_AT_INVALID');
  const result: TaskItem = {
    id: text(source.id, 'SHIGUANG_TASK_ID', 256),
    title: text(source.title, 'SHIGUANG_TASK_TITLE', 1000),
    priority: enumValue<Priority>(source.priority, ['高', '中', '低', '高优先级', '紧急'], 'SHIGUANG_TASK_PRIORITY'),
    stage,
    assignee: {
      name: text(assignee.name, 'SHIGUANG_ASSIGNEE_NAME', 256),
      avatar: text(assignee.avatar, 'SHIGUANG_ASSIGNEE_AVATAR', 128),
      role: text(assignee.role, 'SHIGUANG_ASSIGNEE_ROLE', 256),
    },
    project: text(source.project, 'SHIGUANG_TASK_PROJECT', 512),
    deadline: text(source.deadline, 'SHIGUANG_TASK_DEADLINE', 128),
    description: text(source.description, 'SHIGUANG_TASK_DESCRIPTION', 10000, true),
    tags: stringArray(source.tags, 'SHIGUANG_TASK_TAGS'),
    nextAction: text(source.nextAction, 'SHIGUANG_TASK_NEXT_ACTION', 1000),
    attentionFlags: stringArray(source.attentionFlags, 'SHIGUANG_TASK_ATTENTION').map((flag) => enumValue<AttentionFlag>(flag, ['BLOCKED', 'WAITING', 'OVERDUE', 'CONFIRMATION_REQUIRED', 'IMPORTANT'], 'SHIGUANG_TASK_ATTENTION')),
    sourceRefs: stringArray(source.sourceRefs, 'SHIGUANG_TASK_SOURCE_REFS'),
    evidenceRefs: stringArray(source.evidenceRefs, 'SHIGUANG_TASK_EVIDENCE_REFS'),
    fileRefs: stringArray(source.fileRefs, 'SHIGUANG_TASK_FILE_REFS'),
    createdAt: text(source.createdAt, 'SHIGUANG_TASK_CREATED_AT', 64),
    updatedAt: text(source.updatedAt, 'SHIGUANG_TASK_UPDATED_AT', 64),
  };
  if (hasOwn(source, 'aiSuggestions')) result.aiSuggestions = stringArray(source.aiSuggestions, 'SHIGUANG_TASK_SUGGESTIONS');
  if (hasOwn(source, 'completionProgress')) {
    if (!Number.isFinite(source.completionProgress) || Number(source.completionProgress) < 0 || Number(source.completionProgress) > 100) throw new Error('SHIGUANG_TASK_PROGRESS_INVALID');
    result.completionProgress = Number(source.completionProgress);
  }
  if (completedAt) result.completedAt = completedAt;
  if (archivedAt) result.archivedAt = archivedAt;
  return result;
}

function file(value: unknown): FileDoc {
  const allowed = ['id', 'title', 'category', 'size', 'author', 'updatedAt', 'completion', 'tags'] as const;
  const source = flexibleRecord(value, allowed, allowed.filter((key) => key !== 'completion'), 'SHIGUANG_FILE');
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
    if (!Number.isFinite(source.completion) || Number(source.completion) < 0 || Number(source.completion) > 100) throw new Error('SHIGUANG_FILE_COMPLETION_INVALID');
    result.completion = Number(source.completion);
  }
  return result;
}

function fileGroup(value: unknown): FileGroupEntry {
  const source = flexibleRecord(
    value,
    ['fileId', 'groupId', 'workItemId', 'blobId', 'versionId', 'residency', 'updatedAt'],
    ['fileId', 'groupId', 'workItemId', 'residency', 'updatedAt'],
    'SHIGUANG_FILE_GROUP',
  );
  const result: FileGroupEntry = {
    fileId: text(source.fileId, 'SHIGUANG_FILE_GROUP_FILE_ID', 256),
    groupId: enumValue(source.groupId, ['received', 'triaged', 'in-progress', 'completed', 'archived'], 'SHIGUANG_FILE_GROUP_ID'),
    workItemId: text(source.workItemId, 'SHIGUANG_FILE_GROUP_WORK_ID', 256),
    residency: enumValue<FileResidency>(source.residency, ['metadata-only', 'managed-cache', 'pinned-offline', 'working-copy'], 'SHIGUANG_FILE_RESIDENCY'),
    updatedAt: text(source.updatedAt, 'SHIGUANG_FILE_GROUP_UPDATED_AT', 64),
  };
  if (hasOwn(source, 'blobId')) result.blobId = text(source.blobId, 'SHIGUANG_FILE_GROUP_BLOB_ID', 256);
  if (hasOwn(source, 'versionId')) result.versionId = text(source.versionId, 'SHIGUANG_FILE_GROUP_VERSION_ID', 256);
  return result;
}

export const emptyDailyBrief = (): DailyBrief => ({
  schemaVersion: 'paw.work-state.daily-brief.v1',
  date: new Date().toISOString().slice(0, 10),
  generatedAt: '待生成',
  sourceDigest: '待生成',
  summary: '',
  doneIds: [],
  todoIds: [],
  attentionIds: [],
  fileIds: [],
});

function dailyBrief(value: unknown): DailyBrief {
  const source = record(value, ['schemaVersion', 'date', 'generatedAt', 'sourceDigest', 'summary', 'doneIds', 'todoIds', 'attentionIds', 'fileIds'], 'SHIGUANG_DAILY_BRIEF');
  if (source.schemaVersion !== 'paw.work-state.daily-brief.v1') throw new Error('SHIGUANG_DAILY_BRIEF_SCHEMA_INVALID');
  return {
    schemaVersion: 'paw.work-state.daily-brief.v1',
    date: text(source.date, 'SHIGUANG_DAILY_BRIEF_DATE', 32),
    generatedAt: text(source.generatedAt, 'SHIGUANG_DAILY_BRIEF_GENERATED_AT', 64),
    sourceDigest: text(source.sourceDigest, 'SHIGUANG_DAILY_BRIEF_SOURCE_DIGEST', 80),
    summary: text(source.summary, 'SHIGUANG_DAILY_BRIEF_SUMMARY', 4000, true),
    doneIds: stringArray(source.doneIds, 'SHIGUANG_DAILY_BRIEF_DONE', 5000),
    todoIds: stringArray(source.todoIds, 'SHIGUANG_DAILY_BRIEF_TODO', 5000),
    attentionIds: stringArray(source.attentionIds, 'SHIGUANG_DAILY_BRIEF_ATTENTION', 5000),
    fileIds: stringArray(source.fileIds, 'SHIGUANG_DAILY_BRIEF_FILES', 10000),
  };
}

function legacyTimestamp(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return `${value.slice(0, 10)}T00:00:00Z`;
  return '1970-01-01T00:00:00Z';
}

function migrateLegacyTask(value: unknown): TaskItem | null {
  const source = flexibleRecord(
    value,
    ['id', 'title', 'priority', 'status', 'time', 'phase', 'assignee', 'project', 'deadline', 'description', 'tags', 'aiSuggestions', 'completionProgress'],
    ['id', 'title', 'priority', 'status', 'time', 'phase', 'assignee', 'project', 'deadline', 'description', 'tags'],
    'SHIGUANG_LEGACY_TASK',
  );
  const id = text(source.id, 'SHIGUANG_LEGACY_TASK_ID', 256);
  const tags = stringArray(source.tags, 'SHIGUANG_LEGACY_TASK_TAGS');
  if (id === 'SYSTEM-WORKBENCH-READY' || tags.includes('系统占位')) return null;
  const status = enumValue(source.status, ['进行中', '已完成', '待处理', '已延期'], 'SHIGUANG_LEGACY_STATUS');
  const stage: WorkStage = status === '已完成' ? 'COMPLETED' : status === '进行中' || status === '已延期' ? 'IN_PROGRESS' : 'RECEIVED';
  const timestamp = legacyTimestamp(source.time);
  const assignee = record(source.assignee, ['name', 'avatar', 'role'], 'SHIGUANG_LEGACY_ASSIGNEE');
  const migrated: TaskItem = {
    id,
    title: text(source.title, 'SHIGUANG_LEGACY_TITLE', 1000),
    priority: enumValue<Priority>(source.priority, ['高', '中', '低', '高优先级', '紧急'], 'SHIGUANG_LEGACY_PRIORITY'),
    stage,
    assignee: {
      name: text(assignee.name, 'SHIGUANG_LEGACY_ASSIGNEE_NAME', 256),
      avatar: text(assignee.avatar, 'SHIGUANG_LEGACY_ASSIGNEE_AVATAR', 128),
      role: text(assignee.role, 'SHIGUANG_LEGACY_ASSIGNEE_ROLE', 256),
    },
    project: text(source.project, 'SHIGUANG_LEGACY_PROJECT', 512),
    deadline: text(source.deadline, 'SHIGUANG_LEGACY_DEADLINE', 128),
    description: text(source.description, 'SHIGUANG_LEGACY_DESCRIPTION', 10000, true),
    tags,
    aiSuggestions: hasOwn(source, 'aiSuggestions') ? stringArray(source.aiSuggestions, 'SHIGUANG_LEGACY_SUGGESTIONS') : [],
    completionProgress: hasOwn(source, 'completionProgress') ? Number(source.completionProgress) : stage === 'COMPLETED' ? 100 : 0,
    nextAction: stage === 'RECEIVED' ? '待分类' : '继续处理',
    attentionFlags: status === '已延期' ? ['OVERDUE'] : [],
    sourceRefs: [`source:legacy:${id}`],
    evidenceRefs: [],
    fileRefs: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (stage === 'COMPLETED') migrated.completedAt = timestamp;
  return migrated;
}

function migrateLegacyState(value: unknown): ShiguangState {
  const source = record(value, ['schema_version', 'tasks', 'files', 'workspaces', 'currentWorkspace', 'settings'], 'SHIGUANG_LEGACY_STATE');
  if (source.schema_version !== LEGACY_SHIGUANG_STATE_SCHEMA) throw new Error('SHIGUANG_STATE_SCHEMA_INVALID');
  if (!Array.isArray(source.tasks) || !Array.isArray(source.files)) throw new Error('SHIGUANG_LEGACY_STATE_INVALID');
  const workspaces = stringArray(source.workspaces, 'SHIGUANG_LEGACY_WORKSPACES', 1000);
  const currentWorkspace = text(source.currentWorkspace, 'SHIGUANG_LEGACY_CURRENT_WORKSPACE', 512);
  if (!workspaces.includes(currentWorkspace)) throw new Error('SHIGUANG_LEGACY_CURRENT_WORKSPACE_INVALID');
  return {
    schema_version: SHIGUANG_STATE_SCHEMA,
    tasks: source.tasks.map(migrateLegacyTask).filter((item): item is TaskItem => item !== null),
    files: source.files.map(file),
    fileGroups: [],
    workspaces,
    currentWorkspace,
    dailyBrief: emptyDailyBrief(),
  };
}

export function parseShiguangState(value: unknown): ShiguangState {
  if (value && typeof value === 'object' && !Array.isArray(value) && (value as { schema_version?: unknown }).schema_version === LEGACY_SHIGUANG_STATE_SCHEMA) return migrateLegacyState(value);
  const source = record(value, ['schema_version', 'tasks', 'files', 'fileGroups', 'workspaces', 'currentWorkspace', 'dailyBrief'], 'SHIGUANG_STATE');
  if (source.schema_version !== SHIGUANG_STATE_SCHEMA) throw new Error('SHIGUANG_STATE_SCHEMA_INVALID');
  if (!Array.isArray(source.tasks) || source.tasks.length > 5000) throw new Error('SHIGUANG_TASKS_INVALID');
  if (!Array.isArray(source.files) || source.files.length > 10000) throw new Error('SHIGUANG_FILES_INVALID');
  if (!Array.isArray(source.fileGroups) || source.fileGroups.length > 10000) throw new Error('SHIGUANG_FILE_GROUPS_INVALID');
  const tasks = source.tasks.map(task);
  const files = source.files.map(file);
  const fileGroups = source.fileGroups.map(fileGroup);
  if (new Set(tasks.map((item) => item.id)).size !== tasks.length) throw new Error('SHIGUANG_TASK_IDS_DUPLICATE');
  if (new Set(files.map((item) => item.id)).size !== files.length) throw new Error('SHIGUANG_FILE_IDS_DUPLICATE');
  if (new Set(fileGroups.map((item) => item.fileId)).size !== fileGroups.length) throw new Error('SHIGUANG_FILE_GROUP_IDS_DUPLICATE');
  const workspaces = stringArray(source.workspaces, 'SHIGUANG_WORKSPACES', 1000);
  if (workspaces.length < 1 || new Set(workspaces).size !== workspaces.length) throw new Error('SHIGUANG_WORKSPACES_INVALID');
  const currentWorkspace = text(source.currentWorkspace, 'SHIGUANG_CURRENT_WORKSPACE', 512);
  if (!workspaces.includes(currentWorkspace)) throw new Error('SHIGUANG_CURRENT_WORKSPACE_INVALID');
  return { schema_version: SHIGUANG_STATE_SCHEMA, tasks, files, fileGroups, workspaces, currentWorkspace, dailyBrief: dailyBrief(source.dailyBrief) };
}
