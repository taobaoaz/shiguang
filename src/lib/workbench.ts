import type { TaskItem, WorkItemType } from '@/types';

export const SYSTEM_TASK_ID = 'SYSTEM-WORKBENCH-READY';

export const SYSTEM_TASK: TaskItem = {
  id: SYSTEM_TASK_ID,
  title: '工作台已就绪',
  priority: '低',
  status: '已完成',
  time: '系统',
  phase: '测试验证',
  assignee: { name: '拾光', avatar: 'SG', role: '系统' },
  project: '个人工作台',
  deadline: '待确认',
  description: '用于保持 PAW 状态合同有效，不计入任何业务统计。',
  tags: ['系统占位', '类型:任务'],
  aiSuggestions: [],
  completionProgress: 100,
};

export const isSystemTask = (task: TaskItem) => task.id === SYSTEM_TASK_ID || task.tags.includes('系统占位');

export const visibleTasks = (tasks: TaskItem[]) => tasks.filter((task) => !isSystemTask(task));

export const getTaggedValue = (tags: string[], prefix: string) =>
  tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1) ?? '';

export const getWorkItemType = (task: TaskItem): WorkItemType => {
  const value = getTaggedValue(task.tags, '类型');
  return ['任务', '服务请求', '故障', '变更', '巡检'].includes(value)
    ? value as WorkItemType
    : '任务';
};

export const getSource = (task: TaskItem) => getTaggedValue(task.tags, '来源') || '手动录入';

export const phaseLabel: Record<TaskItem['phase'], string> = {
  需求评审: '待处理',
  产品设计: '处理中',
  开发实现: '待验证',
  测试验证: '已关闭',
};

export const phaseForStatus = (status: TaskItem['status']): TaskItem['phase'] => {
  if (status === '已完成') return '测试验证';
  if (status === '进行中') return '产品设计';
  if (status === '已延期') return '开发实现';
  return '需求评审';
};

export const dateToLocalIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayIso = () => dateToLocalIso(new Date());

export const isOverdue = (task: TaskItem) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.deadline) || task.status === '已完成') return false;
  return task.deadline < todayIso();
};

export const fileTagValue = (tags: string[], prefix: string) => getTaggedValue(tags, prefix) || '待确认';
