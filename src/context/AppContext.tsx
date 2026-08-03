import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FileDoc, TaskItem } from '@/types';
import confetti from 'canvas-confetti';
import { parseShiguangState, SHIGUANG_STATE_SCHEMA, type ShiguangState } from '@/lib/shiguangState';
import { SYSTEM_TASK, isSystemTask } from '@/lib/workbench';

const STORAGE_KEY = 'shiguang.local.state.v1';
const DEFAULT_WORKSPACE = '个人工作台';

interface AppContextType {
  tasks: TaskItem[];
  businessTasks: TaskItem[];
  selectedTask: TaskItem | null;
  setSelectedTask: (task: TaskItem | null) => void;
  addTask: (task: Partial<TaskItem>) => void;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  currentWorkspace: string;
  setCurrentWorkspace: (ws: string) => void;
  workspaces: string[];
  addWorkspace: (name: string) => void;
  files: FileDoc[];
  addFile: (file: Partial<FileDoc>) => void;
  updateFile: (fileId: string, updates: Partial<FileDoc>) => void;
  deleteFile: (fileId: string) => void;
  accentColor: 'emerald' | 'cyan' | 'purple';
  setAccentColor: (color: 'emerald' | 'cyan' | 'purple') => void;
  glassBlur: 'standard' | 'ultra' | 'max';
  setGlassBlur: (blur: 'standard' | 'ultra' | 'max') => void;
  enableConfetti: boolean;
  setEnableConfetti: (val: boolean) => void;
  exportShiguangState: () => ShiguangState;
  importShiguangState: (value: unknown) => void;
  isNewTaskOpen: boolean;
  setIsNewTaskOpen: (val: boolean) => void;
}

const defaultState = (): ShiguangState => ({
  schema_version: SHIGUANG_STATE_SCHEMA,
  tasks: [SYSTEM_TASK],
  files: [],
  workspaces: [DEFAULT_WORKSPACE],
  currentWorkspace: DEFAULT_WORKSPACE,
  settings: { accentColor: 'emerald', glassBlur: 'ultra', enableConfetti: false },
});

const loadLocalState = (): ShiguangState => {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseShiguangState(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(loadLocalState, []);
  const [tasks, setTasks] = useState<TaskItem[]>(initial.tasks);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(initial.tasks.find((task) => !isSystemTask(task)) ?? null);
  const [files, setFiles] = useState<FileDoc[]>(initial.files);
  const [workspaces, setWorkspaces] = useState<string[]>(initial.workspaces);
  const [currentWorkspace, setCurrentWorkspace] = useState(initial.currentWorkspace);
  const [accentColor, setAccentColor] = useState(initial.settings.accentColor);
  const [glassBlur, setGlassBlur] = useState(initial.settings.glassBlur);
  const [enableConfetti, setEnableConfetti] = useState(initial.settings.enableConfetti);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  const businessTasks = useMemo(() => tasks.filter((task) => !isSystemTask(task)), [tasks]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accentColor;
    root.dataset.blur = glassBlur;
    root.style.setProperty('--blur-liquid', glassBlur === 'standard' ? '24px' : glassBlur === 'ultra' ? '40px' : '56px');
  }, [accentColor, glassBlur]);

  const exportShiguangState = useCallback((): ShiguangState => ({
    schema_version: SHIGUANG_STATE_SCHEMA,
    tasks: tasks.length > 0 ? tasks : [SYSTEM_TASK],
    files,
    workspaces: workspaces.length > 0 ? workspaces : [DEFAULT_WORKSPACE],
    currentWorkspace: workspaces.includes(currentWorkspace) ? currentWorkspace : (workspaces[0] ?? DEFAULT_WORKSPACE),
    settings: { accentColor, glassBlur, enableConfetti },
  }), [accentColor, currentWorkspace, enableConfetti, files, glassBlur, tasks, workspaces]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportShiguangState()));
    } catch {
      // 浏览器存储不可用时仍保留当前会话，设置页会明确显示本地模式。
    }
  }, [exportShiguangState]);

  const addTask = useCallback((taskPartial: Partial<TaskItem>) => {
    const newTask: TaskItem = {
      id: taskPartial.id || `TASK-${Date.now()}`,
      title: taskPartial.title || '未命名事项',
      priority: taskPartial.priority || '中',
      status: taskPartial.status || '待处理',
      time: taskPartial.time || new Date().toISOString().slice(0, 10),
      phase: taskPartial.phase || '需求评审',
      assignee: taskPartial.assignee || { name: '老大', avatar: 'LD', role: '负责人' },
      project: taskPartial.project || currentWorkspace,
      deadline: taskPartial.deadline || '待确认',
      description: taskPartial.description || '',
      tags: taskPartial.tags || ['类型:任务', '来源:手动录入'],
      aiSuggestions: taskPartial.aiSuggestions || [],
      completionProgress: taskPartial.completionProgress ?? 0,
    };
    setTasks((prev) => [newTask, ...prev.filter((task) => !isSystemTask(task))]);
    setSelectedTask(newTask);
    if (enableConfetti) confetti({ particleCount: 45, spread: 60, origin: { y: 0.65 } });
  }, [currentWorkspace, enableConfetti]);

  const updateTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    setTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, ...updates } : task));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, ...updates } : prev);
  }, []);

  const completeTask = useCallback((taskId: string) => {
    updateTask(taskId, { status: '已完成', phase: '测试验证', completionProgress: 100 });
    if (enableConfetti) confetti({ particleCount: 60, spread: 70, origin: { x: 0.82, y: 0.62 } });
  }, [enableConfetti, updateTask]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const remaining = prev.filter((task) => task.id !== taskId && !isSystemTask(task));
      return remaining.length > 0 ? remaining : [SYSTEM_TASK];
    });
    setSelectedTask((prev) => prev?.id === taskId ? null : prev);
  }, []);

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
      size: filePartial.size || '本地条目',
      author: filePartial.author || '老大',
      updatedAt: filePartial.updatedAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
      completion: filePartial.completion ?? 100,
      tags: filePartial.tags || [],
    };
    setFiles((prev) => [next, ...prev]);
  }, []);

  const updateFile = useCallback((fileId: string, updates: Partial<FileDoc>) => {
    setFiles((prev) => prev.map((file) => file.id === fileId ? { ...file, ...updates, updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') } : file));
  }, []);

  const deleteFile = useCallback((fileId: string) => setFiles((prev) => prev.filter((file) => file.id !== fileId)), []);

  const importShiguangState = useCallback((value: unknown) => {
    const next = parseShiguangState(value);
    setTasks(next.tasks);
    setSelectedTask(next.tasks.find((task) => !isSystemTask(task)) ?? null);
    setFiles(next.files);
    setWorkspaces(next.workspaces);
    setCurrentWorkspace(next.currentWorkspace);
    setAccentColor(next.settings.accentColor);
    setGlassBlur(next.settings.glassBlur);
    setEnableConfetti(next.settings.enableConfetti);
  }, []);

  return (
    <AppContext.Provider value={{
      tasks, businessTasks, selectedTask, setSelectedTask, addTask, updateTask, completeTask, deleteTask,
      currentWorkspace, setCurrentWorkspace, workspaces, addWorkspace,
      files, addFile, updateFile, deleteFile,
      accentColor, setAccentColor, glassBlur, setGlassBlur, enableConfetti, setEnableConfetti,
      exportShiguangState, importShiguangState,
      isNewTaskOpen, setIsNewTaskOpen,
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
