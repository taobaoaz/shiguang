import type { AttentionFlag, TaskItem, WorkItemType, WorkStage } from '@/types';

export const visibleTasks = (tasks: TaskItem[]) => tasks;

export const getTaggedValue = (tags: string[], prefix: string) =>
  tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1) ?? '';

export const getWorkItemType = (task: TaskItem): WorkItemType => {
  const value = getTaggedValue(task.tags, '类型');
  return ['任务', '服务请求', '故障', '变更', '巡检'].includes(value) ? value as WorkItemType : '任务';
};

export const getSource = (task: TaskItem) => getTaggedValue(task.tags, '来源') || '手动录入';

export const workStageLabel: Record<WorkStage, string> = {
  RECEIVED: '收到工作',
  TRIAGED: '分类工作',
  IN_PROGRESS: '正在干的',
  COMPLETED: '干完的',
  ARCHIVED: '归档的',
};

export const workStageGroup: Record<WorkStage, string> = {
  RECEIVED: '01-收到工作',
  TRIAGED: '02-分类工作',
  IN_PROGRESS: '03-正在干的',
  COMPLETED: '04-干完的',
  ARCHIVED: '05-归档的',
};

export const stageOrder: WorkStage[] = ['RECEIVED', 'TRIAGED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

export const attentionLabel: Record<AttentionFlag, string> = {
  BLOCKED: '阻塞',
  WAITING: '等待',
  OVERDUE: '逾期',
  CONFIRMATION_REQUIRED: '需要确认',
  IMPORTANT: '重点关注',
};

export const dateToLocalIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayIso = () => dateToLocalIso(new Date());

export const isOverdue = (task: TaskItem) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.deadline) || ['COMPLETED', 'ARCHIVED'].includes(task.stage)) return false;
  return task.deadline < todayIso();
};

export const fileTagValue = (tags: string[], prefix: string) => getTaggedValue(tags, prefix) || '待确认';

export const countByStage = (tasks: TaskItem[]) => Object.fromEntries(
  stageOrder.map((stage) => [stage, tasks.filter((task) => task.stage === stage).length]),
) as Record<WorkStage, number>;
