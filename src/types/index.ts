export type NavTab = 
  | 'dashboard'
  | 'inbox'
  | 'work'
  | 'projects'
  | 'assets'
  | 'knowledge'
  | 'reports'
  | 'settings';

export type WorkItemType = '任务' | '服务请求' | '故障' | '变更' | '巡检';

export type Priority = '高' | '中' | '低' | '高优先级' | '紧急';
export type WorkStage = 'RECEIVED' | 'TRIAGED' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type AttentionFlag = 'BLOCKED' | 'WAITING' | 'OVERDUE' | 'CONFIRMATION_REQUIRED' | 'IMPORTANT';

export interface TaskItem {
  id: string;
  title: string;
  priority: Priority;
  stage: WorkStage;
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
  nextAction: string;
  attentionFlags: AttentionFlag[];
  sourceRefs: string[];
  evidenceRefs: string[];
  fileRefs: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
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

export type FileResidency = 'metadata-only' | 'managed-cache' | 'pinned-offline' | 'working-copy';

export interface FileGroupEntry {
  fileId: string;
  groupId: 'received' | 'triaged' | 'in-progress' | 'completed' | 'archived';
  workItemId: string;
  blobId?: string;
  versionId?: string;
  residency: FileResidency;
  updatedAt: string;
}

export interface DailyBrief {
  schemaVersion: 'paw.work-state.daily-brief.v1';
  date: string;
  generatedAt: string;
  sourceDigest: string;
  summary: string;
  doneIds: string[];
  todoIds: string[];
  attentionIds: string[];
  fileIds: string[];
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
      onUpdateAvailable: (callback: (data: UpdateAvailableEvent) => void) => () => void;
      openWorkDisk: () => Promise<{ ok: boolean; path: string; error?: string }>;
    };
  }
}
