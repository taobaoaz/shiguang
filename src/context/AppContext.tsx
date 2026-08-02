import React, { createContext, useContext, useState } from 'react';
import { TaskItem, FileDoc, CardDeckItem, Priority, TaskStatus } from '@/types';
import confetti from 'canvas-confetti';

interface AppContextType {
  // Tasks state
  tasks: TaskItem[];
  selectedTask: TaskItem | null;
  setSelectedTask: (task: TaskItem | null) => void;
  addTask: (task: Partial<TaskItem>) => void;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;

  // Workspace
  currentWorkspace: string;
  setCurrentWorkspace: (ws: string) => void;
  workspaces: string[];
  addWorkspace: (name: string) => void;

  // Documents
  files: FileDoc[];
  addFile: (file: Partial<FileDoc>) => void;

  // Settings / Theme
  accentColor: 'emerald' | 'cyan' | 'purple';
  setAccentColor: (color: 'emerald' | 'cyan' | 'purple') => void;
  glassBlur: 'standard' | 'ultra' | 'max';
  setGlassBlur: (blur: 'standard' | 'ultra' | 'max') => void;
  enableConfetti: boolean;
  setEnableConfetti: (val: boolean) => void;

  // Modals state
  isNewTaskOpen: boolean;
  setIsNewTaskOpen: (val: boolean) => void;
  editingTask: TaskItem | null;
  setEditingTask: (task: TaskItem | null) => void;
  selectedDoc: CardDeckItem | null;
  setSelectedDoc: (doc: CardDeckItem | null) => void;
}

const initialTasks: TaskItem[] = [];

const initialFiles: FileDoc[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [files, setFiles] = useState<FileDoc[]>(initialFiles);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('');

  // Themes
  const [accentColor, setAccentColor] = useState<'emerald' | 'cyan' | 'purple'>('emerald');
  const [glassBlur, setGlassBlur] = useState<'standard' | 'ultra' | 'max'>('ultra');
  const [enableConfetti, setEnableConfetti] = useState(true);

  // Modals
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<CardDeckItem | null>(null);

  const addTask = (taskPartial: Partial<TaskItem>) => {
    const newTask: TaskItem = {
      id: taskPartial.id || `TASK-${Date.now()}`,
      title: taskPartial.title || '新建任务',
      priority: taskPartial.priority || '中',
      status: taskPartial.status || '进行中',
      time: taskPartial.time || new Date().toLocaleDateString('zh-CN'),
      phase: taskPartial.phase || '需求评审',
      assignee: taskPartial.assignee || { name: '', avatar: '', role: '' },
      project: taskPartial.project || currentWorkspace,
      deadline: taskPartial.deadline || '',
      description: taskPartial.description || '',
      tags: taskPartial.tags || [],
      aiSuggestions: taskPartial.aiSuggestions || [],
    };

    setTasks((prev) => [newTask, ...prev]);
    setSelectedTask(newTask);

    if (enableConfetti) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  };

  const updateTask = (taskId: string, updates: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : prev);
    }
  };

  const completeTask = (taskId: string) => {
    updateTask(taskId, { status: '已完成' });
    if (enableConfetti) {
      confetti({ particleCount: 70, spread: 70, origin: { x: 0.85, y: 0.6 } });
    }
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      const remaining = tasks.filter((t) => t.id !== taskId);
      if (remaining.length > 0) setSelectedTask(remaining[0]);
      else setSelectedTask(null);
    }
  };

  const addWorkspace = (name: string) => {
    if (!name.trim()) return;
    setWorkspaces((prev) => [...prev, name]);
    setCurrentWorkspace(name);
  };

  const addFile = (filePartial: Partial<FileDoc>) => {
    const newDoc: FileDoc = {
      id: `doc-${Date.now()}`,
      title: filePartial.title || '未命名文档',
      category: filePartial.category || '通用文档',
      size: filePartial.size || '0 MB',
      author: filePartial.author || '',
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      completion: 100,
      tags: filePartial.tags || [],
    };
    setFiles((prev) => [newDoc, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        tasks,
        selectedTask,
        setSelectedTask,
        addTask,
        updateTask,
        completeTask,
        deleteTask,
        currentWorkspace,
        setCurrentWorkspace,
        workspaces,
        addWorkspace,
        files,
        addFile,
        accentColor,
        setAccentColor,
        glassBlur,
        setGlassBlur,
        enableConfetti,
        setEnableConfetti,
        isNewTaskOpen,
        setIsNewTaskOpen,
        editingTask,
        setEditingTask,
        selectedDoc,
        setSelectedDoc,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
