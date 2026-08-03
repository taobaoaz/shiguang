import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DailyBrief, FileDoc, FileGroupEntry, TaskItem, WorkStage } from '@/types';
import confetti from 'canvas-confetti';
import { emptyDailyBrief, parseShiguangState, SHIGUANG_STATE_SCHEMA, type ShiguangState } from '@/lib/shiguangState';

const LEGACY_STORAGE_KEY = 'shiguang.local.state.v1';
const PREFERENCES_KEY = 'shiguang.ui.preferences.v1';
const DEFAULT_WORKSPACE = '个人工作台';

type AccentColor = 'emerald' | 'cyan' | 'amber';
type GlassBlur = 'standard' | 'ultra' | 'max';

interface UiPreferences {
  accentColor: AccentColor;
  glassBlur: GlassBlur;
  enableConfetti: boolean;
}

interface AppContextType {
  tasks: TaskItem[];
  businessTasks: TaskItem[];
  selectedTask: TaskItem | null;
  setSelectedTask: (task: TaskItem | null) => void;
  addTask: (task: Partial<TaskItem>) => void;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  moveTask: (taskId: string, stage: WorkStage, note?: string) => void;
  completeTask: (taskId: string) => void;
  archiveTask: (taskId: string) => void;
  currentWorkspace: string;
  setCurrentWorkspace: (ws: string) => void;
  workspaces: string[];
  addWorkspace: (name: string) => void;
  files: FileDoc[];
  fileGroups: FileGroupEntry[];
  dailyBrief: DailyBrief;
  addFile: (file: Partial<FileDoc>) => void;
  updateFile: (fileId: string, updates: Partial<FileDoc>) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  glassBlur: GlassBlur;
  setGlassBlur: (blur: GlassBlur) => void;
  enableConfetti: boolean;
  setEnableConfetti: (val: boolean) => void;
  exportShiguangState: () => ShiguangState;
  importShiguangState: (value: unknown) => void;
  isNewTaskOpen: boolean;
  setIsNewTaskOpen: (val: boolean) => void;
  legacyLocalStatePresent: boolean;
}

const defaultState = (): ShiguangState => ({
  schema_version: SHIGUANG_STATE_SCHEMA,
  tasks: [],
  files: [],
  fileGroups: [],
  workspaces: [DEFAULT_WORKSPACE],
  currentWorkspace: DEFAULT_WORKSPACE,
  dailyBrief: emptyDailyBrief(),
});

const loadInitialState = (): { state: ShiguangState; legacy: boolean } => {
  if (typeof window === 'undefined') return { state: defaultState(), legacy: false };
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? { state: parseShiguangState(JSON.parse(raw)), legacy: true } : { state: defaultState(), legacy: false };
  } catch {
    return { state: defaultState(), legacy: false };
  }
};

const loadPreferences = (): UiPreferences => {
  const fallback: UiPreferences = { accentColor: 'emerald', glassBlur: 'ultra', enableConfetti: false };
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '{}') as Record<string, unknown>;
    return {
      accentColor: ['emerald', 'cyan', 'amber'].includes(String(parsed.accentColor)) ? parsed.accentColor as AccentColor : 'emerald',
      glassBlur: ['standard', 'ultra', 'max'].includes(String(parsed.glassBlur)) ? parsed.glassBlur as GlassBlur : 'ultra',
      enableConfetti: typeof parsed.enableConfetti === 'boolean' ? parsed.enableConfetti : false,
    };
  } catch {
    return fallback;
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const groupForStage: Record<WorkStage, FileGroupEntry['groupId']> = {
  RECEIVED: 'received',
  TRIAGED: 'triaged',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

const allowedTransitions: Record<WorkStage, WorkStage[]> = {
  RECEIVED: ['TRIAGED'],
  TRIAGED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['IN_PROGRESS', 'ARCHIVED'],
  ARCHIVED: ['TRIAGED'],
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(loadInitialState, []);
  const preferences = useMemo(loadPreferences, []);
  const [tasks, setTasks] = useState<TaskItem[]>(initial.state.tasks);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(initial.state.tasks[0] ?? null);
  const [files, setFiles] = useState<FileDoc[]>(initial.state.files);
  const [fileGroups, setFileGroups] = useState<FileGroupEntry[]>(initial.state.fileGroups);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief>(initial.state.dailyBrief);
  const [workspaces, setWorkspaces] = useState<string[]>(initial.state.workspaces);
  const [currentWorkspace, setCurrentWorkspace] = useState(initial.state.currentWorkspace);
  const [accentColor, setAccentColor] = useState<AccentColor>(preferences.accentColor);
  const [glassBlur, setGlassBlur] = useState<GlassBlur>(preferences.glassBlur);
  const [enableConfetti, setEnableConfetti] = useState(preferences.enableConfetti);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [legacyLocalStatePresent, setLegacyLocalStatePresent] = useState(initial.legacy);

  const businessTasks = tasks;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accentColor;
    root.dataset.blur = glassBlur;
    root.style.setProperty('--blur-liquid', glassBlur === 'standard' ? '24px' : glassBlur === 'ultra' ? '40px' : '56px');
    const accent = accentColor === 'cyan'
      ? ['#67e8f9', '#22d3ee', '#0891b2']
      : accentColor === 'amber'
        ? ['#fcd34d', '#f59e0b', '#d97706']
        : ['#6ee7b7', '#34d399', '#059669'];
    root.style.setProperty('--accent-soft', accent[0]);
    root.style.setProperty('--accent-main', accent[1]);
    root.style.setProperty('--accent-deep', accent[2]);
  }, [accentColor, glassBlur]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ accentColor, glassBlur, enableConfetti }));
    } catch {
      // UI 偏好不可用时仅影响本次会话，不建立替代业务缓存。
    }
  }, [accentColor, enableConfetti, glassBlur]);

  const exportShiguangState = useCallback((): ShiguangState => ({
    schema_version: SHIGUANG_STATE_SCHEMA,
    tasks,
    files,
    fileGroups,
    workspaces: workspaces.length > 0 ? workspaces : [DEFAULT_WORKSPACE],
    currentWorkspace: workspaces.includes(currentWorkspace) ? currentWorkspace : (workspaces[0] ?? DEFAULT_WORKSPACE),
    dailyBrief,
  }), [currentWorkspace, dailyBrief, fileGroups, files, tasks, workspaces]);

  const addTask = useCallback((taskPartial: Partial<TaskItem>) => {
    const timestamp = new Date().toISOString();
    const newTask: TaskItem = {
      id: taskPartial.id || `TASK-${Date.now()}`,
      title: taskPartial.title || '未命名事项',
      priority: taskPartial.priority || '中',
      stage: taskPartial.stage || 'RECEIVED',
      assignee: taskPartial.assignee || { name: '老大', avatar: 'LD', role: '负责人' },
      project: taskPartial.project || currentWorkspace,
      deadline: taskPartial.deadline || '待确认',
      description: taskPartial.description || '',
      tags: taskPartial.tags || ['类型:任务', '来源:手动录入'],
      aiSuggestions: taskPartial.aiSuggestions || [],
      completionProgress: taskPartial.completionProgress ?? 0,
      nextAction: taskPartial.nextAction || '待分类',
      attentionFlags: taskPartial.attentionFlags || [],
      sourceRefs: taskPartial.sourceRefs || [`source:manual:${Date.now()}`],
      evidenceRefs: taskPartial.evidenceRefs || [],
      fileRefs: taskPartial.fileRefs || [],
      createdAt: taskPartial.createdAt || timestamp,
      updatedAt: taskPartial.updatedAt || timestamp,
    };
    setTasks((prev) => [newTask, ...prev]);
    setSelectedTask(newTask);
  }, [currentWorkspace]);

  const updateTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    const timestamp = new Date().toISOString();
    setTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, ...updates, id: task.id, updatedAt: timestamp } : task));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, ...updates, id: prev.id, updatedAt: timestamp } : prev);
  }, []);

  const moveTask = useCallback((taskId: string, stage: WorkStage, note = '') => {
    const current = tasks.find((task) => task.id === taskId);
    if (!current || !allowedTransitions[current.stage].includes(stage)) return;
    const timestamp = new Date().toISOString();
    const updates: Partial<TaskItem> = {
      stage,
      updatedAt: timestamp,
      completionProgress: stage === 'COMPLETED' || stage === 'ARCHIVED' ? 100 : current.completionProgress,
      aiSuggestions: note ? [...(current.aiSuggestions ?? []), note] : current.aiSuggestions,
    };
    if (stage === 'COMPLETED') updates.completedAt = timestamp;
    if (current.stage === 'COMPLETED' && stage === 'IN_PROGRESS') updates.completedAt = undefined;
    if (stage === 'ARCHIVED') updates.archivedAt = timestamp;
    if (current.stage === 'ARCHIVED') updates.archivedAt = undefined;
    updateTask(taskId, updates);
    setFileGroups((prev) => prev.map((entry) => entry.workItemId === taskId ? { ...entry, groupId: groupForStage[stage], updatedAt: timestamp } : entry));
  }, [tasks, updateTask]);

  const completeTask = useCallback((taskId: string) => {
    moveTask(taskId, 'COMPLETED', '已由工作台记录完成，等待成果验收。');
    if (enableConfetti) confetti({ particleCount: 42, spread: 58, origin: { x: 0.82, y: 0.62 } });
  }, [enableConfetti, moveTask]);

  const archiveTask = useCallback((taskId: string) => moveTask(taskId, 'ARCHIVED', '已归档，COS 正式版本继续保留。'), [moveTask]);

  const addWorkspace = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setWorkspaces((prev) => prev.includes(clean) ? prev : [...prev, clean]);
    setCurrentWorkspace(clean);
  }, []);

  const addFile = useCallback((filePartial: Partial<FileDoc>) => {
    const next: FileDoc = {
      id: filePartial.id || `DOC-${Date.now()}`,
      title: filePartial.title || '未命名条目',
      category: filePartial.category || '工作资料',
      size: filePartial.size || '仅元数据',
      author: filePartial.author || '老大',
      updatedAt: filePartial.updatedAt || new Date().toISOString(),
      completion: filePartial.completion ?? 100,
      tags: filePartial.tags || [],
    };
    setFiles((prev) => [next, ...prev]);
  }, []);

  const updateFile = useCallback((fileId: string, updates: Partial<FileDoc>) => {
    setFiles((prev) => prev.map((file) => file.id === fileId ? { ...file, ...updates, id: file.id, updatedAt: new Date().toISOString() } : file));
  }, []);

  const importShiguangState = useCallback((value: unknown) => {
    const next = parseShiguangState(value);
    setTasks(next.tasks);
    setSelectedTask(next.tasks[0] ?? null);
    setFiles(next.files);
    setFileGroups(next.fileGroups);
    setDailyBrief(next.dailyBrief);
    setWorkspaces(next.workspaces);
    setCurrentWorkspace(next.currentWorkspace);
    if (typeof window !== 'undefined' && window.localStorage.getItem(LEGACY_STORAGE_KEY) !== null) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      setLegacyLocalStatePresent(false);
    }
  }, []);

  return (
    <AppContext.Provider value={{
      tasks, businessTasks, selectedTask, setSelectedTask, addTask, updateTask, moveTask, completeTask, archiveTask,
      currentWorkspace, setCurrentWorkspace, workspaces, addWorkspace,
      files, fileGroups, dailyBrief, addFile, updateFile,
      accentColor, setAccentColor, glassBlur, setGlassBlur, enableConfetti, setEnableConfetti,
      exportShiguangState, importShiguangState,
      isNewTaskOpen, setIsNewTaskOpen, legacyLocalStatePresent,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
