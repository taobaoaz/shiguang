import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Archive, ArrowRight, BookOpen, Box, CheckCircle2,
  CircleDot, Clock3, Database, FileText, FolderKanban, Gauge, HardDrive,
  Inbox, LayoutDashboard, ListChecks, Network, Plus, Search, Server, Settings2,
  ShieldCheck, Tag, Wrench, XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';
import { useShiguangSync } from '@/context/ShiguangSyncContext';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import type { FileDoc, NavTab, TaskItem, WorkItemType } from '@/types';
import { fileTagValue, getSource, getWorkItemType, isOverdue, phaseLabel, todayIso } from '@/lib/workbench';

type Navigate = (tab: NavTab) => void;

const Panel: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
  <section className={clsx('liquid-glass p-4 sm:p-5 min-w-0', className)}>{children}</section>
);

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; meta?: string; action?: React.ReactNode }> = ({ icon: Icon, title, meta, action }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="liquid-icon-well w-8 h-8 rounded-xl flex items-center justify-center text-emerald-300 shrink-0"><Icon className="w-4 h-4" /></span>
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-white truncate">{title}</h2>
        {meta && <p className="text-[10px] text-white/45 mt-0.5 truncate">{meta}</p>}
      </div>
    </div>
    {action}
  </div>
);

const EmptyState: React.FC<{ icon: React.ElementType; title: string; text: string; action?: React.ReactNode }> = ({ icon: Icon, title, text, action }) => (
  <div className="min-h-44 flex flex-col items-center justify-center text-center px-6 py-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.015]">
    <span className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/40 mb-3"><Icon className="w-5 h-5" /></span>
    <h3 className="text-[13px] font-semibold text-white/85">{title}</h3>
    <p className="text-[11px] text-white/45 mt-1 max-w-sm leading-5">{text}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const SmallButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className, children, ...props }) => (
  <button {...props} className={clsx(primary ? 'liquid-btn-primary text-[#04120c]' : 'liquid-btn-ghost text-white/70', 'h-9 px-3 rounded-xl text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed', className)}>{children}</button>
);

const priorityTone: Record<string, string> = {
  紧急: 'text-rose-200 bg-rose-400/10 border-rose-400/20',
  高优先级: 'text-rose-200 bg-rose-400/10 border-rose-400/20',
  高: 'text-amber-200 bg-amber-400/10 border-amber-400/20',
  中: 'text-cyan-200 bg-cyan-400/10 border-cyan-400/20',
  低: 'text-white/55 bg-white/[0.04] border-white/10',
};

const typeIcon: Record<WorkItemType, React.ElementType> = {
  任务: ListChecks,
  服务请求: Inbox,
  故障: AlertTriangle,
  变更: Wrench,
  巡检: ShieldCheck,
};

const WorkItemRow: React.FC<{ task: TaskItem; compact?: boolean; onClick?: () => void }> = ({ task, compact, onClick }) => {
  const TypeIcon = typeIcon[getWorkItemType(task)];
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15 transition-colors p-3.5 group">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-emerald-300 shrink-0"><TypeIcon className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[12px] font-semibold text-white/90 group-hover:text-white truncate">{task.title}</h3>
            <span className={clsx('px-2 py-0.5 rounded-full border text-[9px] font-semibold shrink-0', priorityTone[task.priority])}>{task.priority}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/45 flex-wrap">
            <span>{getWorkItemType(task)}</span><span className="text-white/20">•</span>
            <span>{phaseLabel[task.phase]}</span>
            {task.project && <><span className="text-white/20">•</span><span>{task.project}</span></>}
            {!compact && <><span className="text-white/20">•</span><span className={isOverdue(task) ? 'text-rose-300' : ''}>{task.deadline || '待确认'}</span></>}
          </div>
        </div>
      </div>
    </button>
  );
};

const StatCard: React.FC<{ label: string; value: number; hint: string; icon: React.ElementType; tone?: string }> = ({ label, value, hint, icon: Icon, tone = 'text-emerald-300' }) => (
  <div className="liquid-glass p-4 min-w-0">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-white/50">{label}</span>
      <Icon className={clsx('w-4 h-4', tone)} />
    </div>
    <div className="text-[26px] font-extrabold font-mono text-white mt-2 leading-none">{value}</div>
    <p className="text-[10px] text-white/35 mt-2 truncate">{hint}</p>
  </div>
);

export const DashboardPage: React.FC<{ onNavigate: Navigate }> = ({ onNavigate }) => {
  const { businessTasks, files, workspaces, setIsNewTaskOpen, setSelectedTask } = useApp();
  const { connected, phase, dirty } = useShiguangSync();
  const pending = businessTasks.filter((task) => task.status === '待处理');
  const active = businessTasks.filter((task) => task.status === '进行中');
  const overdue = businessTasks.filter(isOverdue);
  const today = businessTasks.filter((task) => task.deadline === todayIso() || task.status === '待处理').slice(0, 5);
  const assetCount = files.filter((file) => file.category === '设备资产').length;
  const knowledgeCount = files.length - assetCount;
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());

  return (
    <div className="p-1 pb-5 space-y-4">
      <Panel className="overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-center relative z-10">
          <div>
            <p className="text-[11px] text-emerald-300/80 font-medium">{dateLabel}</p>
            <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-white mt-1">今天先把重要的事处理清楚</h1>
            <p className="text-[12px] text-white/50 mt-2 leading-5">统一查看待办、信息化项目、故障、资产和工作资料。所有数字只来自当前工作台真实记录。</p>
          </div>
          <div className="flex flex-wrap lg:justify-end gap-2">
            <SmallButton onClick={() => onNavigate('inbox')}><Inbox className="w-3.5 h-3.5" />查看收件箱</SmallButton>
            <SmallButton primary onClick={() => setIsNewTaskOpen(true)}><Plus className="w-3.5 h-3.5" />新增工作事项</SmallButton>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="待处理" value={pending.length} hint="尚未开始的事项" icon={CircleDot} tone="text-amber-300" />
        <StatCard label="处理中" value={active.length} hint="正在推进的事项" icon={Activity} tone="text-cyan-300" />
        <StatCard label="已逾期" value={overdue.length} hint="需要优先检查" icon={AlertTriangle} tone="text-rose-300" />
        <StatCard label="信息化项目" value={workspaces.length} hint="当前登记项目" icon={FolderKanban} />
      </div>

      <div className="grid xl:grid-cols-[1.3fr_.7fr] gap-4 items-start">
        <Panel>
          <SectionTitle icon={ListChecks} title="今天的工作" meta="待处理和今日到期事项" action={<button onClick={() => onNavigate('work')} className="text-[10px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1">全部事项 <ArrowRight className="w-3 h-3" /></button>} />
          <div className="space-y-2.5">
            {today.length > 0 ? today.map((task) => <WorkItemRow key={task.id} task={task} compact onClick={() => { setSelectedTask(task); onNavigate('work'); }} />) : (
              <EmptyState icon={CheckCircle2} title="今天没有待处理事项" text="可以从收件箱整理新事项，或者直接创建任务、故障、变更和巡检。" action={<SmallButton primary onClick={() => setIsNewTaskOpen(true)}><Plus className="w-3.5 h-3.5" />新增事项</SmallButton>} />
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle icon={Gauge} title="工作台状态" meta="本机与 PAW 同步" />
            <div className="space-y-3 text-[11px]">
              <div className="flex items-center justify-between"><span className="text-white/50">本地保存</span><span className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />已启用</span></div>
              <div className="flex items-center justify-between"><span className="text-white/50">NodeGateway</span><span className={connected ? 'text-emerald-300' : 'text-amber-300'}>{connected ? '已连接' : '未连接'}</span></div>
              <div className="flex items-center justify-between"><span className="text-white/50">同步状态</span><span className="text-white/70">{!connected ? '等待连接' : phase === 'conflict' ? '存在冲突' : dirty ? '本地有变更' : '无待提交变更'}</span></div>
            </div>
          </Panel>
          <Panel>
            <SectionTitle icon={Database} title="数据概览" meta="当前真实条目" />
            <div className="grid grid-cols-2 gap-2">
              {[['工作事项', businessTasks.length], ['项目', workspaces.length], ['设备资产', assetCount], ['资料知识', knowledgeCount]].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3"><div className="text-[18px] font-bold font-mono text-white">{value}</div><div className="text-[10px] text-white/40 mt-1">{label}</div></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export const InboxPage: React.FC<{ onNavigate: Navigate }> = ({ onNavigate }) => {
  const { businessTasks, updateTask, setSelectedTask, setIsNewTaskOpen } = useApp();
  const inboxItems = businessTasks.filter((task) => task.status === '待处理');
  return (
    <div className="p-1 pb-5">
      <Panel>
        <SectionTitle icon={Inbox} title="统一收件箱" meta="把零散输入整理成可执行事项" action={<SmallButton primary onClick={() => setIsNewTaskOpen(true)}><Plus className="w-3.5 h-3.5" />快速记录</SmallButton>} />
        {inboxItems.length === 0 ? <EmptyState icon={Inbox} title="收件箱已经清空" text="后续可接收 C·ONE 总结、微信摘要和其他 Agent 提交的待整理事项。当前未连接的来源不会显示成已启用。" /> : (
          <div className="space-y-2.5">
            {inboxItems.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0"><div className="text-[12px] font-semibold text-white truncate">{task.title}</div><div className="text-[10px] text-white/40 mt-1">来源：{getSource(task)}　类型：{getWorkItemType(task)}　截止：{task.deadline}</div></div>
                <div className="flex gap-2 shrink-0">
                  <SmallButton onClick={() => { setSelectedTask(task); onNavigate('work'); }}>查看详情</SmallButton>
                  <SmallButton primary onClick={() => updateTask(task.id, { status: '进行中', phase: '产品设计' })}>开始处理</SmallButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export const WorkItemsPage: React.FC = () => {
  const { businessTasks, selectedTask, setSelectedTask, setIsNewTaskOpen, updateTask, completeTask, deleteTask } = useApp();
  const [typeFilter, setTypeFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState('全部');
  const filtered = businessTasks.filter((task) => (typeFilter === '全部' || getWorkItemType(task) === typeFilter) && (statusFilter === '全部' || task.status === statusFilter));
  return (
    <div className="p-1 pb-5 grid xl:grid-cols-[1fr_340px] gap-4 items-start">
      <Panel>
        <SectionTitle icon={ListChecks} title="工作事项" meta="任务、请求、故障、变更和巡检共用一套流程" action={<SmallButton primary onClick={() => setIsNewTaskOpen(true)}><Plus className="w-3.5 h-3.5" />新增事项</SmallButton>} />
        <div className="flex flex-wrap gap-2 mb-4">
          <LiquidSelect value={typeFilter} onChange={setTypeFilter} variant="pill" aria-label="按事项类型筛选" options={['全部', '任务', '服务请求', '故障', '变更', '巡检'].map((value) => ({ value, label: value }))} />
          <LiquidSelect value={statusFilter} onChange={setStatusFilter} variant="pill" aria-label="按处理状态筛选" options={['全部', '待处理', '进行中', '已完成', '已延期'].map((value) => ({ value, label: value }))} />
        </div>
        <div className="space-y-2.5">
          {filtered.length > 0 ? filtered.map((task) => <WorkItemRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />) : <EmptyState icon={ListChecks} title="没有符合条件的事项" text="调整筛选条件，或者新增一条工作事项。" />}
        </div>
      </Panel>
      <Panel className="xl:sticky xl:top-0">
        <SectionTitle icon={FileText} title="事项详情" meta={selectedTask ? selectedTask.id : '选择左侧事项'} />
        {selectedTask ? (
          <div className="space-y-4">
            <div><h3 className="text-[15px] font-bold text-white leading-6">{selectedTask.title}</h3><p className="text-[11px] text-white/45 mt-2 leading-5">{selectedTask.description || '暂无补充说明'}</p></div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {[['类型', getWorkItemType(selectedTask)], ['状态', phaseLabel[selectedTask.phase]], ['项目', selectedTask.project || '待确认'], ['截止', selectedTask.deadline || '待确认'], ['负责人', selectedTask.assignee.name || '老大'], ['来源', getSource(selectedTask)]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3"><div className="text-white/35">{label}</div><div className="text-white/80 mt-1 truncate">{value}</div></div>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTask.status !== '进行中' && selectedTask.status !== '已完成' && <SmallButton onClick={() => updateTask(selectedTask.id, { status: '进行中', phase: '产品设计' })}>开始处理</SmallButton>}
              {selectedTask.status !== '已完成' && <SmallButton primary onClick={() => completeTask(selectedTask.id)}><CheckCircle2 className="w-3.5 h-3.5" />完成</SmallButton>}
              <SmallButton onClick={() => deleteTask(selectedTask.id)} className="text-rose-300"><XCircle className="w-3.5 h-3.5" />删除</SmallButton>
            </div>
          </div>
        ) : <EmptyState icon={FileText} title="尚未选择事项" text="从左侧选择一条事项查看完整信息。" />}
      </Panel>
    </div>
  );
};

export const ProjectsPage: React.FC = () => {
  const { workspaces, currentWorkspace, setCurrentWorkspace, addWorkspace, businessTasks } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!name.trim()) return; addWorkspace(name); setName(''); setOpen(false); };
  return (
    <div className="p-1 pb-5">
      <Panel>
        <SectionTitle icon={FolderKanban} title="信息化项目" meta="项目、里程碑和相关工作事项" action={<SmallButton primary onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />新增项目</SmallButton>} />
        <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {workspaces.map((workspace) => {
            const items = businessTasks.filter((task) => task.project === workspace);
            const done = items.filter((task) => task.status === '已完成').length;
            const progress = items.length ? Math.round(done / items.length * 100) : 0;
            return <button key={workspace} onClick={() => setCurrentWorkspace(workspace)} className={clsx('text-left rounded-2xl border p-4 transition-colors', currentWorkspace === workspace ? 'bg-emerald-400/[0.08] border-emerald-400/25' : 'bg-white/[0.025] border-white/[0.08] hover:border-white/15')}>
              <div className="flex items-center justify-between gap-3"><span className="w-9 h-9 rounded-xl liquid-icon-well flex items-center justify-center text-emerald-300"><FolderKanban className="w-4 h-4" /></span><span className="text-[10px] text-white/40">{items.length} 项事项</span></div>
              <h3 className="text-[13px] font-semibold text-white mt-4">{workspace}</h3>
              <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${progress}%` }} /></div>
              <div className="flex justify-between mt-2 text-[10px] text-white/40"><span>真实完成度</span><span>{progress}%</span></div>
            </button>;
          })}
        </div>
      </Panel>
      <LiquidModal open={open} onClose={() => setOpen(false)} title="新增信息化项目" subtitle="创建后可关联任务、故障和资料" icon={<FolderKanban className="w-5 h-5" />} footer={<div className="flex justify-end gap-2"><SmallButton onClick={() => setOpen(false)}>取消</SmallButton><SmallButton primary type="submit" form="project-form">创建</SmallButton></div>}>
        <form id="project-form" onSubmit={submit}><label className="text-[11px] text-white/50 block mb-1.5" htmlFor="project-name">项目名称</label><input id="project-name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="liquid-input w-full rounded-xl px-3.5 py-2.5 text-[12px]" placeholder="例如：办公网络改造" /></form>
      </LiquidModal>
    </div>
  );
};

const AssetModal: React.FC<{ open: boolean; onClose: () => void; onCreate: (file: Partial<FileDoc>) => void }> = ({ open, onClose, onCreate }) => {
  const [form, setForm] = useState({ name: '', type: '网络设备', code: '', ip: '', location: '', owner: '老大', status: '在用' });
  const submit = (event: React.FormEvent) => { event.preventDefault(); onCreate({ title: form.name, category: '设备资产', size: form.type, author: form.owner, tags: [`编号:${form.code || '待确认'}`, `IP:${form.ip || '待确认'}`, `位置:${form.location || '待确认'}`, `状态:${form.status}`] }); setForm({ name: '', type: '网络设备', code: '', ip: '', location: '', owner: '老大', status: '在用' }); onClose(); };
  const field = 'liquid-input w-full rounded-xl px-3.5 py-2.5 text-[12px]';
  return <LiquidModal open={open} onClose={onClose} title="登记设备资产" subtitle="记录真实信息，未知字段保留待确认" icon={<Server className="w-5 h-5" />} footer={<div className="flex justify-end gap-2"><SmallButton onClick={onClose}>取消</SmallButton><SmallButton primary type="submit" form="asset-form">保存资产</SmallButton></div>}>
    <form id="asset-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
      <label className="col-span-2 text-[11px] text-white/50">资产名称<input autoFocus required className={`${field} mt-1.5`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="text-[11px] text-white/50">类型<input className={`${field} mt-1.5`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
      <label className="text-[11px] text-white/50">资产编号<input className={`${field} mt-1.5`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="待确认" /></label>
      <label className="text-[11px] text-white/50">IP 地址<input className={`${field} mt-1.5`} value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="待确认" /></label>
      <label className="text-[11px] text-white/50">位置<input className={`${field} mt-1.5`} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="待确认" /></label>
      <label className="text-[11px] text-white/50">负责人<input className={`${field} mt-1.5`} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></label>
      <label className="text-[11px] text-white/50">状态<LiquidSelect value={form.status} onChange={(status) => setForm({ ...form, status })} className="mt-1.5" options={['在用', '备用', '维修', '停用'].map((value) => ({ value, label: value }))} /></label>
    </form>
  </LiquidModal>;
};

export const AssetsPage: React.FC = () => {
  const { files, addFile, deleteFile } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const assets = files.filter((file) => file.category === '设备资产' && [file.title, file.size, ...file.tags].join(' ').toLowerCase().includes(needle));
  return <div className="p-1 pb-5"><Panel>
    <SectionTitle icon={HardDrive} title="设备资产" meta="网络、终端、服务器、系统和其他信息化资产" action={<SmallButton primary onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />登记资产</SmallButton>} />
    <div className="liquid-pill h-10 px-3.5 flex items-center gap-2 mb-4 max-w-md"><Search className="w-3.5 h-3.5 text-white/35" /><input aria-label="搜索设备资产" value={query} onChange={(e) => setQuery(e.target.value)} className="bg-transparent outline-none border-0 flex-1 text-[12px]" placeholder="搜索名称、类型、编号、IP 或位置" /></div>
    {assets.length === 0 ? <EmptyState icon={Server} title="还没有设备资产" text="先登记真实设备。后续可以接入专业资产发现工具，但拾光本身不重复制造一套网络扫描引擎。" action={<SmallButton primary onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />登记第一台设备</SmallButton>} /> : <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">{assets.map((asset) => <article key={asset.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-3"><span className="w-9 h-9 rounded-xl liquid-icon-well flex items-center justify-center text-cyan-300"><Network className="w-4 h-4" /></span><button aria-label={`删除资产 ${asset.title}`} onClick={() => deleteFile(asset.id)} className="text-white/30 hover:text-rose-300"><XCircle className="w-4 h-4" /></button></div>
      <h3 className="text-[13px] font-semibold text-white mt-3">{asset.title}</h3><p className="text-[10px] text-white/40 mt-1">{asset.size}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4 text-[10px]">{[['编号', fileTagValue(asset.tags, '编号')], ['IP', fileTagValue(asset.tags, 'IP')], ['位置', fileTagValue(asset.tags, '位置')], ['状态', fileTagValue(asset.tags, '状态')]].map(([k,v]) => <div key={k}><dt className="text-white/30">{k}</dt><dd className="text-white/75 mt-0.5 truncate">{v}</dd></div>)}</dl>
    </article>)}</div>}
    <AssetModal open={open} onClose={() => setOpen(false)} onCreate={addFile} />
  </Panel></div>;
};

export const KnowledgePage: React.FC = () => {
  const { files, addFile, deleteFile } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: '工作资料', tags: '' });
  const knowledge = files.filter((file) => file.category !== '设备资产');
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.title.trim()) return; addFile({ title: form.title, category: form.category, size: '本地条目', tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }); setForm({ title: '', category: '工作资料', tags: '' }); setOpen(false); };
  return <div className="p-1 pb-5"><Panel>
    <SectionTitle icon={BookOpen} title="资料与知识" meta="工作资料、操作手册、故障知识和制度流程" action={<SmallButton primary onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />新增条目</SmallButton>} />
    {knowledge.length === 0 ? <EmptyState icon={BookOpen} title="还没有知识条目" text="当前版本先建立可检索的元数据条目。真实文件读取与附件同步尚未启用，不再使用假上传按钮。" action={<SmallButton primary onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />新增第一条</SmallButton>} /> : <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">{knowledge.map((file) => <article key={file.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><span className="w-9 h-9 rounded-xl liquid-icon-well flex items-center justify-center text-emerald-300"><FileText className="w-4 h-4" /></span><button aria-label={`删除条目 ${file.title}`} onClick={() => deleteFile(file.id)} className="text-white/30 hover:text-rose-300"><XCircle className="w-4 h-4" /></button></div><h3 className="text-[13px] font-semibold text-white mt-3">{file.title}</h3><p className="text-[10px] text-white/40 mt-1">{file.category}　{file.updatedAt}</p><div className="flex flex-wrap gap-1.5 mt-3">{file.tags.length ? file.tags.map((tag) => <span key={tag} className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[9px] text-white/50">{tag}</span>) : <span className="text-[10px] text-white/30">暂无标签</span>}</div></article>)}</div>}
    <LiquidModal open={open} onClose={() => setOpen(false)} title="新增知识条目" subtitle="只记录真实存在的资料" icon={<BookOpen className="w-5 h-5" />} footer={<div className="flex justify-end gap-2"><SmallButton onClick={() => setOpen(false)}>取消</SmallButton><SmallButton primary type="submit" form="knowledge-form">保存</SmallButton></div>}><form id="knowledge-form" onSubmit={submit} className="space-y-3"><label className="text-[11px] text-white/50 block">标题<input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="liquid-input w-full mt-1.5 rounded-xl px-3.5 py-2.5 text-[12px]" /></label><label className="text-[11px] text-white/50 block">分类<LiquidSelect value={form.category} onChange={(category) => setForm({ ...form, category })} className="mt-1.5" options={['工作资料', '操作手册', '故障知识', '项目资料', '制度流程'].map((value) => ({ value, label: value }))} /></label><label className="text-[11px] text-white/50 block">标签<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="liquid-input w-full mt-1.5 rounded-xl px-3.5 py-2.5 text-[12px]" placeholder="用逗号分隔" /></label></form></LiquidModal>
  </Panel></div>;
};

export const ReportsPage: React.FC = () => {
  const { businessTasks, files, workspaces } = useApp();
  const done = businessTasks.filter((task) => task.status === '已完成').length;
  const incidents = businessTasks.filter((task) => getWorkItemType(task) === '故障');
  const openIncidents = incidents.filter((task) => task.status !== '已完成').length;
  const changes = businessTasks.filter((task) => getWorkItemType(task) === '变更');
  const completedChanges = changes.filter((task) => task.status === '已完成').length;
  const completion = businessTasks.length ? Math.round(done / businessTasks.length * 100) : 0;
  return <div className="p-1 pb-5 space-y-4">
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><StatCard label="事项完成率" value={completion} hint="百分比，来自真实事项" icon={CheckCircle2} /><StatCard label="未关闭故障" value={openIncidents} hint={`共登记 ${incidents.length} 条故障`} icon={AlertTriangle} tone="text-rose-300" /><StatCard label="已完成变更" value={completedChanges} hint={`共登记 ${changes.length} 条变更`} icon={Wrench} tone="text-cyan-300" /><StatCard label="资料与资产" value={files.length} hint={`${workspaces.length} 个信息化项目`} icon={Archive} /></div>
    <Panel><SectionTitle icon={Gauge} title="统计说明" meta="不使用演示数字和无来源 AI 指标" /><div className="grid md:grid-cols-3 gap-3 text-[11px]">{[['数据来源', '当前拾光本地状态'], ['统计口径', '业务事项，不含系统占位记录'], ['尚未具备', 'SLA、平均响应时间、资产覆盖率等需真实字段后启用']].map(([title, text]) => <div key={title} className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4"><div className="text-emerald-300 font-semibold">{title}</div><p className="text-white/50 mt-2 leading-5">{text}</p></div>)}</div></Panel>
  </div>;
};

export const SettingsPage: React.FC = () => {
  const { accentColor, setAccentColor, glassBlur, setGlassBlur, enableConfetti, setEnableConfetti, businessTasks, files, workspaces } = useApp();
  const sync = useShiguangSync();
  return <div className="p-1 pb-5 grid xl:grid-cols-2 gap-4 items-start">
    <Panel><SectionTitle icon={Settings2} title="界面与体验" meta="只保留当前真实生效的设置" /><div className="space-y-4"><div><label className="text-[11px] text-white/50 block mb-2">强调色</label><div className="flex gap-2">{(['emerald', 'cyan', 'purple'] as const).map((color) => <button key={color} aria-label={`选择 ${color} 强调色`} onClick={() => setAccentColor(color)} className={clsx('w-10 h-10 rounded-xl border transition-transform', color === 'emerald' ? 'bg-emerald-400' : color === 'cyan' ? 'bg-cyan-400' : 'bg-violet-400', accentColor === color ? 'border-white scale-105' : 'border-white/10 opacity-45')} />)}</div></div><div><label className="text-[11px] text-white/50 block mb-2">玻璃模糊</label><LiquidSelect value={glassBlur} onChange={(value) => setGlassBlur(value as typeof glassBlur)} options={[{ value: 'standard', label: '标准' }, { value: 'ultra', label: '增强' }, { value: 'max', label: '最高' }]} /></div><label className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4"><span><span className="text-[12px] text-white/85 block">完成动效</span><span className="text-[10px] text-white/40 mt-1 block">完成事项时播放轻量庆祝效果</span></span><input type="checkbox" checked={enableConfetti} onChange={(e) => setEnableConfetti(e.target.checked)} className="accent-emerald-400 w-4 h-4" /></label></div></Panel>
    <Panel><SectionTitle icon={Database} title="本地与同步" meta="本地保存默认启用，远端提交保持人工触发" /><div className="space-y-3 text-[11px]"><div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 space-y-3"><div className="flex justify-between"><span className="text-white/45">本地持久化</span><span className="text-emerald-300">已启用</span></div><div className="flex justify-between"><span className="text-white/45">NodeGateway</span><span className={sync.connected ? 'text-emerald-300' : 'text-amber-300'}>{sync.connected ? '已连接' : '未连接'}</span></div><div className="flex justify-between"><span className="text-white/45">同步阶段</span><span className="text-white/75">{sync.phase}</span></div><div className="flex justify-between"><span className="text-white/45">本地变更</span><span className="text-white/75">{sync.dirty ? '有' : '无'}</span></div></div><div className="grid grid-cols-3 gap-2">{[['事项', businessTasks.length], ['项目', workspaces.length], ['条目', files.length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 text-center"><div className="text-[18px] font-bold font-mono">{value}</div><div className="text-[9px] text-white/35 mt-1">{label}</div></div>)}</div><div className="flex flex-wrap gap-2"><SmallButton onClick={() => void sync.refresh()} disabled={sync.busy}>刷新状态</SmallButton><SmallButton onClick={() => void sync.pullNow()} disabled={!sync.connected || sync.busy}>拉取已验证版本</SmallButton><SmallButton primary onClick={() => void sync.submitNow()} disabled={!sync.connected || sync.busy || !sync.dirty}>提交当前版本</SmallButton></div><p className="text-[10px] text-white/35 leading-5">拾光不直连 COS。未连接时仍可本地工作，提交按钮不会伪造成功结果。</p></div></Panel>
  </div>;
};
