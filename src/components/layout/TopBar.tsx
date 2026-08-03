import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Boxes, FolderKanban, ListChecks, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { TitleTransition } from '@/components/ui/PageTransition';
import type { NavTab } from '@/types';

interface TopBarProps {
  title: string;
  subtitle: string;
  titleKey: string;
  onNavigate: (tab: NavTab) => void;
}

type SearchResult = {
  id: string;
  label: string;
  meta: string;
  target: NavTab;
  icon: React.ElementType;
  taskId?: string;
};

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, titleKey, onNavigate }) => {
  const { businessTasks, files, workspaces, setSelectedTask, setIsNewTaskOpen } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setIsNewTaskOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setIsNewTaskOpen]);

  const results = useMemo<SearchResult[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const taskResults = businessTasks
      .filter((task) => [task.title, task.id, task.project, task.description, ...task.tags].join(' ').toLowerCase().includes(needle))
      .map((task) => ({ id: `task-${task.id}`, label: task.title, meta: `工作事项 · ${task.project || '未分项目'}`, target: 'work' as NavTab, icon: ListChecks, taskId: task.id }));
    const fileResults = files
      .filter((file) => [file.title, file.category, file.author, ...file.tags].join(' ').toLowerCase().includes(needle))
      .map((file) => ({ id: `file-${file.id}`, label: file.title, meta: file.category, target: (file.category === '设备资产' ? 'assets' : 'knowledge') as NavTab, icon: file.category === '设备资产' ? Boxes : BookOpen }));
    const workspaceResults = workspaces
      .filter((workspace) => workspace.toLowerCase().includes(needle))
      .map((workspace) => ({ id: `workspace-${workspace}`, label: workspace, meta: '信息化项目', target: 'projects' as NavTab, icon: FolderKanban }));
    return [...taskResults, ...fileResults, ...workspaceResults].slice(0, 8);
  }, [businessTasks, files, query, workspaces]);

  const selectResult = (result: SearchResult) => {
    if (result.taskId) setSelectedTask(businessTasks.find((task) => task.id === result.taskId) ?? null);
    onNavigate(result.target);
    setQuery('');
  };

  return (
    <header className="w-full flex items-center justify-between gap-3 sm:gap-4 shrink-0 select-none px-0.5">
      <div className="min-w-0 shrink-0 max-w-[min(34%,340px)]">
        <TitleTransition titleKey={titleKey}>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight leading-none truncate">{title}</h1>
          <p className="text-[11px] text-white/35 font-medium mt-1 tracking-wide truncate">{subtitle}</p>
        </TitleTransition>
      </div>

      <div className="relative flex-1 max-w-[min(560px,46vw)] mx-auto min-w-0 hidden sm:block">
        <div className="liquid-pill flex items-center h-10 px-3.5 gap-2 focus-within:border-emerald-400/35">
          <Search className="w-3.5 h-3.5 text-white/35 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            aria-label="搜索整个工作台"
            placeholder="搜索事项、项目、资产和资料"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-[12px] text-white/90 placeholder:text-white/30 min-w-0"
          />
          {query ? (
            <button type="button" aria-label="清空搜索" onClick={() => setQuery('')} className="text-white/35 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          ) : (
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] text-white/35 font-mono shrink-0">Ctrl K</kbd>
          )}
        </div>

        <AnimatePresence>
          {query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              className="absolute top-full left-0 right-0 mt-2 p-2 liquid-glass z-50 max-h-72 overflow-y-auto space-y-1"
            >
              {results.length ? results.map((result) => {
                const Icon = result.icon;
                return (
                  <button key={result.id} type="button" onClick={() => selectResult(result)} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-white/[0.05] transition-colors">
                    <span className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-emerald-300 shrink-0"><Icon className="w-4 h-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-white truncate">{result.label}</span>
                      <span className="block text-[10px] text-white/40 mt-0.5 truncate">{result.meta}</span>
                    </span>
                  </button>
                );
              }) : <div className="px-3 py-5 text-center text-[11px] text-white/40">没有找到匹配内容</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => setIsNewTaskOpen(true)}
        className="liquid-btn-primary h-9 px-3.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
        title="新增工作事项，快捷键 N"
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden sm:inline">新增事项</span>
      </button>
    </header>
  );
};
