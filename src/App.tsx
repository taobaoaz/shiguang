import React, { useRef, useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { TaskManagementPage } from '@/pages/TaskManagementPage';
import { ProjectOverviewPage } from '@/pages/ProjectOverviewPage';
import { FileDocumentsPage } from '@/pages/FileDocumentsPage';
import { ScheduleManagementPage } from '@/pages/ScheduleManagementPage';
import { TeamCollaborationPage } from '@/pages/TeamCollaborationPage';
import { AIAnalyticsPage } from '@/pages/AIAnalyticsPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { SettingsCenterPage } from '@/pages/SettingsCenterPage';
import { NewTaskModal } from '@/components/modals/NewTaskModal';
import { EditTaskModal } from '@/components/modals/EditTaskModal';
import { NavTab } from '@/types';
import { AppProvider, useApp } from '@/context/AppContext';
import { RouteTransition } from '@/components/ui/PageTransition';
import { ShiguangSyncProvider } from '@/context/ShiguangSyncContext';

const TAB_ORDER: NavTab[] = [
  'tasks',
  'overview',
  'files',
  'schedule',
  'collaboration',
  'analytics',
  'knowledge',
  'settings',
];

function MainLayout() {
  const [activeTab, setActiveTab] = useState<NavTab>('tasks');
  const { isNewTaskOpen, setIsNewTaskOpen, addTask } = useApp();
  const prevTab = useRef<NavTab>(activeTab);
  const [direction, setDirection] = useState(1);
  const [updateBanner, setUpdateBanner] = useState<{ version: string; url: string; visible: boolean }>({
    version: '', url: '', visible: false,
  });

  useEffect(() => {
    if (window.shiguang?.isElectron) {
      return window.shiguang.onUpdateAvailable((data) => {
        setUpdateBanner({ version: data.latestVersion, url: data.releaseUrl, visible: true });
      });
    }
    return undefined;
  }, []);

  const handleTabChange = (tab: NavTab) => {
    const from = TAB_ORDER.indexOf(prevTab.current);
    const to = TAB_ORDER.indexOf(tab);
    setDirection(to >= from ? 1 : -1);
    prevTab.current = tab;
    setActiveTab(tab);
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'tasks':
        return <TaskManagementPage />;
      case 'overview':
        return <ProjectOverviewPage />;
      case 'files':
        return <FileDocumentsPage />;
      case 'schedule':
        return <ScheduleManagementPage />;
      case 'collaboration':
        return <TeamCollaborationPage />;
      case 'analytics':
        return <AIAnalyticsPage />;
      case 'knowledge':
        return <KnowledgeBasePage />;
      case 'settings':
        return <SettingsCenterPage />;
      default:
        return <TaskManagementPage />;
    }
  };

  const getPageTitle = (tab: NavTab) => {
    switch (tab) {
      case 'tasks':
        return { title: '生产任务', subtitle: '日常工作 · 追踪与执行' };
      case 'overview':
        return { title: '产线总览', subtitle: '一/二/三/四号线 · 运行状态' };
      case 'files':
        return { title: '化验报告', subtitle: '化验数据 · 归档与追溯' };
      case 'schedule':
        return { title: '量仓管理', subtitle: '原料库存 · 成品出入库' };
      case 'collaboration':
        return { title: '设备台账', subtitle: '重点产线 · 设备档案' };
      case 'analytics':
        return { title: '生产指标', subtitle: '单耗 · 质量 · 关键KPI' };
      case 'knowledge':
        return { title: '转产记录', subtitle: '工艺调整 · 参数追溯' };
      case 'settings':
        return { title: '设置中心', subtitle: '主题 · AI · 偏好' };
    }
  };

  const pageInfo = getPageTitle(activeTab);

  return (
    <div className="w-full h-screen liquid-shell text-white overflow-hidden font-sans">
      <div className="app-frame relative z-10">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="main-stack min-h-0">
          <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} titleKey={activeTab} />

          {updateBanner.visible && (
            <div className="flex items-center justify-between px-4 py-2 mx-4 mt-2 rounded-xl bg-amber-500/10 border border-amber-400/20">
              <div className="flex items-center gap-2 text-amber-300 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                发现新版本 {updateBanner.version}，建议立即更新
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={updateBanner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 px-3 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[11px] font-semibold hover:bg-amber-500/30 transition-colors"
                >
                  去下载
                </a>
                <button
                  onClick={() => setUpdateBanner({ version: '', url: '', visible: false })}
                  className="text-white/30 hover:text-white/60 text-[11px]"
                >
                  忽略
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 min-h-0 overflow-hidden relative">
            {/* 页面切换遮罩光效 */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div className="absolute -top-20 left-1/3 w-72 h-72 bg-emerald-500/5 blur-[100px] rounded-full" />
            </div>

            <RouteTransition
              routeKey={activeTab}
              direction={direction}
              className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden"
            >
              {renderActivePage()}
            </RouteTransition>
          </main>
        </div>
      </div>

      <NewTaskModal isOpen={isNewTaskOpen} onClose={() => setIsNewTaskOpen(false)} onAddTask={addTask} />
      <EditTaskModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ShiguangSyncProvider>
        <MainLayout />
      </ShiguangSyncProvider>
    </AppProvider>
  );
}
