export type NavTab = 
  | 'tasks' 
  | 'overview' 
  | 'files' 
  | 'schedule' 
  | 'collaboration' 
  | 'analytics' 
  | 'knowledge' 
  | 'settings';

export type Priority = '高' | '中' | '低' | '高优先级' | '紧急';
export type TaskStatus = '进行中' | '已完成' | '待处理' | '已延期';

export interface TaskItem {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  time: string; // e.g. "今天 10:00"
  phase: '需求评审' | '产品设计' | '开发实现' | '测试验证';
  assignee: {
    name: string;
    avatar: string;
    role: string;
  };
  project: string;
  deadline: string;
  description: string;
  tags: string[];
  aiSuggestions?: string[];
  completionProgress?: number; // 0-100%
}

export interface MetricCardData {
  title: string;
  count: number;
  unit: string;
  comparisonText: string;
  isIncrease: boolean;
  percentage: number;
  iconName: 'clipboard' | 'pulse' | 'check' | 'alert';
  variant: 'default' | 'overdue';
}

export interface CardDeckItem {
  id: string;
  title: string;
  quarter: string;
  completionRate: number; // e.g. 87
  type: string;
  colorTheme: 'emerald' | 'glass';
  details: string;
  author: string;
  updatedAt: string;
}

export interface TimelineRow {
  id: string;
  phase: string;
  taskTitle: string;
  startDate: string; // e.g. "5.18"
  endDate: string; // e.g. "5.24"
  startDay: number; // e.g. 18
  endDay: number; // e.g. 24
  status: TaskStatus;
  highlighted?: boolean;
}

export interface FileDoc {
  id: string;
  title: string;
  category: string;
  size: string;
  author: string;
  updatedAt: string;
  completion?: number;
  tags: string[];
}

// ── 更新检查 ──────────────────────────────────────────────
export interface UpdateAsset {
  name: string;
  download_url: string;
  size: number;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  releaseName?: string;
  releaseUrl?: string;
  publishedAt?: string;
  assets?: UpdateAsset[];
  error?: string;
}

export interface UpdateAvailableEvent {
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
}

declare global {
  interface Window {
    shiguang?: {
      platform: string;
      isElectron: boolean;
      checkForUpdates: () => Promise<UpdateCheckResult>;
      onUpdateAvailable: (callback: (data: UpdateAvailableEvent) => void) => void;
    };
  }
}
