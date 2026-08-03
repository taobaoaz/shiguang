import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import {
  AssetsPage, DashboardPage, InboxPage, KnowledgePage,
  ProjectsPage, ReportsPage, SettingsPage, WorkItemsPage,
} from '@/pages/WorkbenchPages';
import { NewTaskModal } from '@/components/modals/NewTaskModal';
import type { NavTab } from '@/types';
import { AppProvider, useApp } from '@/context/AppContext';
import { RouteTransition } from '@/components/ui/PageTransition';
import { ShiguangSyncProvider } from '@/context/ShiguangSyncContext';

const TAB_ORDER: NavTab[] = ['dashboard', 'inbox', 'work', 'projects', 'assets', 'knowledge', 'reports', 'settings'];

const PAGE_INFO: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: { title: '今日工作台', subtitle: '重要事项 · 快速处理 · 真实状态' },
  inbox: { title: '收件箱', subtitle: '统一接收 · 分类整理 · 转为行动' },
  work: { title: '工作事项', subtitle: '任务 · 服务请求 · 故障 · 变更 · 巡检' },
  projects: { title: '信息化项目', subtitle: '建设计划 · 任务进展 · 结果验收' },
  assets: { title: '设备资产', subtitle: '网络设备 · 服务器 · 终端与系统台账' },
  knowledge: { title: '资料知识', subtitle: '制度 · 方案 · 手册 · 复盘与经验' },
  reports: { title: '工作统计', subtitle: '只统计当前工作台中的真实记录' },
  settings: { title: '设置', subtitle: '外观 · COS 数据 · NodeGateway 同步' },
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('SHIGUANG_RENDER_FAILED', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="w-full h-screen liquid-shell text-white flex items-center justify-center p-6">
        <div className="liquid-glass max-w-md p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-300 mx-auto" />
          <h1 className="text-lg font-bold mt-3">页面加载失败</h1>
          <p className="text-[12px] text-white/50 mt-2">本地数据不会因此删除。请重新加载页面，若问题持续出现再检查控制台错误。</p>
          <button type="button" onClick={() => window.location.reload()} className="liquid-btn-primary h-10 px-5 rounded-full text-[12px] font-bold mt-5">重新加载</button>
        </div>
      </div>
    );
  }
}

function MainLayout() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const { isNewTaskOpen, setIsNewTaskOpen, addTask } = useApp();
  const prevTab = useRef<NavTab>(activeTab);
  const [direction, setDirection] = useState(1);
  const [updateBanner, setUpdateBanner] = useState<{ version: string; url: string; visible: boolean }>({ version: '', url: '', visible: false });

  useEffect(() => {
    if (!window.shiguang?.isElectron) return undefined;
    return window.shiguang.onUpdateAvailable((data) => setUpdateBanner({ version: data.latestVersion, url: data.releaseUrl, visible: true }));
  }, []);

  const handleTabChange = (tab: NavTab) => {
    const from = TAB_ORDER.indexOf(prevTab.current);
    const to = TAB_ORDER.indexOf(tab);
    setDirection(to >= from ? 1 : -1);
    prevTab.current = tab;
    setActiveTab(tab);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardPage onNavigate={handleTabChange} />;
      case 'inbox': return <InboxPage onNavigate={handleTabChange} />;
      case 'work': return <WorkItemsPage />;
      case 'projects': return <ProjectsPage />;
      case 'assets': return <AssetsPage />;
      case 'knowledge': return <KnowledgePage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage />;
    }
  };

  const pageInfo = PAGE_INFO[activeTab];
  return (
    <div className="w-full h-screen liquid-shell text-white overflow-hidden font-sans">
      <div className="app-frame relative z-10">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="main-stack min-h-0">
          <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} titleKey={activeTab} onNavigate={handleTabChange} />

          {updateBanner.visible && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-400/20">
              <div className="flex items-center gap-2 text-amber-200 text-[11px] min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="truncate">发现新版本 {updateBanner.version}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={updateBanner.url} target="_blank" rel="noopener noreferrer" className="h-7 px-3 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-100 text-[10px] font-semibold inline-flex items-center">查看版本</a>
                <button type="button" onClick={() => setUpdateBanner({ version: '', url: '', visible: false })} className="text-white/35 hover:text-white text-[10px]">忽略</button>
              </div>
            </div>
          )}

          <main className="flex-1 min-h-0 overflow-hidden relative">
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div className="absolute -top-20 left-1/3 w-72 h-72 bg-emerald-500/5 blur-[100px] rounded-full" />
            </div>
            <RouteTransition routeKey={activeTab} direction={direction} className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden">
              {renderPage()}
            </RouteTransition>
          </main>
        </div>
      </div>
      <NewTaskModal isOpen={isNewTaskOpen} onClose={() => setIsNewTaskOpen(false)} onAddTask={addTask} />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AppProvider>
          <ShiguangSyncProvider>
            <MainLayout />
          </ShiguangSyncProvider>
        </AppProvider>
      </MotionConfig>
    </AppErrorBoundary>
  );
}
