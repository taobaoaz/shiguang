import React, { useState } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, UserPlus, CheckCircle2 } from 'lucide-react';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { motion } from 'framer-motion';

export interface AppNotification {
  id: number;
  title: string;
  time: string;
  type: 'success' | 'info' | 'warning';
  read: boolean;
}

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  initialUnread?: number;
  onUnreadChange?: (n: number) => void;
}

const seed: AppNotification[] = [];

const iconMap = {
  success: CheckCircle2,
  info: UserPlus,
  warning: AlertTriangle,
};

const colorMap = {
  success: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/25',
  info: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/25',
  warning: 'text-amber-300 bg-amber-500/15 border-amber-400/25',
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  open,
  onClose,
  onUnreadChange,
}) => {
  const [list, setList] = useState(seed);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unread = list.filter((n) => !n.read).length;
  const visible = filter === 'unread' ? list.filter((n) => !n.read) : list;

  const markAllRead = () => {
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadChange?.(0);
  };

  const markOne = (id: number) => {
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const next = list.map((n) => (n.id === id ? { ...n, read: true } : n)).filter((n) => !n.read).length;
    onUnreadChange?.(next);
  };

  const clearRead = () => {
    setList((prev) => prev.filter((n) => !n.read));
  };

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      title="消息通知"
      subtitle={`${unread} 条未读 · 共 ${list.length} 条`}
      icon={<Bell className="w-5 h-5" />}
      widthClass="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={clearRead}
            className="h-10 px-3 rounded-full liquid-btn-ghost text-[12px] text-white/55 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清除已读
          </button>
          <div className="flex items-center gap-2">
            <button onClick={markAllRead} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/70 flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              全部已读
            </button>
            <button onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold">
              关闭
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="liquid-pill p-1 inline-flex items-center gap-0.5">
          {([
            ['all', '全部'],
            ['unread', '未读'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                filter === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
          {visible.length === 0 && (
            <div className="py-12 text-center text-[12px] text-white/35">暂无通知</div>
          )}
          {visible.map((n, i) => {
            const Icon = iconMap[n.type];
            return (
              <motion.button
                key={n.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => markOne(n.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-colors flex gap-3 ${
                  n.read
                    ? 'bg-white/[0.02] border-white/[0.05] opacity-70'
                    : 'bg-white/[0.04] border-white/10 hover:border-emerald-400/25'
                }`}
              >
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colorMap[n.type]}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium text-white leading-snug">{n.title}</p>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">{n.time}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </LiquidModal>
  );
};
