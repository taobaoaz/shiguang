import React from 'react';
import { motion } from 'framer-motion';
import {
  Boxes, ChevronRight, CircleGauge, FolderKanban, HardDrive, Inbox,
  ListChecks, RefreshCw, Settings, ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { NavTab } from '@/types';
import { useShiguangSync } from '@/context/ShiguangSyncContext';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '今日工作台', icon: CircleGauge },
  { id: 'inbox', label: '收件箱', icon: Inbox },
  { id: 'work', label: '工作事项', icon: ListChecks },
  { id: 'projects', label: '信息化项目', icon: FolderKanban },
  { id: 'assets', label: '设备资产', icon: Boxes },
  { id: 'knowledge', label: '文件盘', icon: HardDrive },
  { id: 'reports', label: '工作统计', icon: ShieldCheck },
  { id: 'settings', label: '设置', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { connected, phase, dirty, busy, headCount, refresh } = useShiguangSync();
  const statusText = connected
    ? dirty ? '本地有待同步变更' : `已连接 · ${headCount} 条`
    : '本地模式';

  return (
    <aside className="liquid-glass sidebar-shell h-full w-full min-w-0 min-h-0 flex flex-col p-3.5 select-none overflow-hidden">
      <div className="sidebar-brand flex items-center gap-2.5 px-1.5 pt-1 pb-5">
        <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 flex items-center justify-center font-extrabold text-[#04120c] text-[13px] shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-white/40 shrink-0">
          SG
        </div>
        <div className="sidebar-brand-copy min-w-0">
          <div className="text-[15px] font-bold text-white tracking-wide">拾光</div>
          <div className="text-[10px] text-white/35 mt-0.5 truncate">网络与信息化工作台</div>
        </div>
      </div>

      <nav aria-label="主导航" className="space-y-1 min-h-0 overflow-y-auto pr-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={() => onTabChange(item.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-300 relative group',
                isActive ? 'text-white' : 'text-white/45 hover:text-white/80',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-liquid"
                  className="absolute inset-0 rounded-2xl liquid-glass-active"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {!isActive && <span className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.04]" />}
              <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                <Icon className={clsx('w-[15px] h-[15px] shrink-0', isActive ? 'text-emerald-300' : 'text-white/40 group-hover:text-white/70')} strokeWidth={1.75} />
                <span className="sidebar-label truncate">{item.label}</span>
              </span>
              {isActive && <ChevronRight className="sidebar-meta relative z-10 w-3.5 h-3.5 text-emerald-300/80 shrink-0" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer mt-auto pt-3 border-t border-white/[0.06] space-y-2.5">
        <div className="sidebar-sync liquid-pill px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]' : 'bg-amber-400')} />
              <div className="sidebar-meta min-w-0">
                <div className="text-[11px] font-semibold text-white/75 truncate">NodeGateway</div>
                <div className="text-[9px] text-white/35 truncate">{phase === 'conflict' ? '存在同步冲突' : statusText}</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="刷新同步状态"
              title="刷新同步状态"
              onClick={() => void refresh()}
              disabled={busy}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-40 shrink-0"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', busy && 'animate-spin')} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onTabChange('settings')}
          className="w-full liquid-pill flex items-center gap-2.5 px-2.5 py-2 hover:border-white/20 transition-colors"
          title="个人设置"
        >
          <div className="w-8 h-8 rounded-full liquid-icon-well flex items-center justify-center text-[10px] font-bold text-white/90 shrink-0">老大</div>
          <div className="sidebar-meta min-w-0 text-left">
            <div className="text-[11px] font-semibold text-white truncate">个人工作台</div>
            <div className="text-[9px] text-white/35 truncate">全厂网络与信息化</div>
          </div>
        </button>
      </div>
    </aside>
  );
};
