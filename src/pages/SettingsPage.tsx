import React, { useEffect, useState } from 'react';
import {
  Activity, Bot, CloudCog, Database, FolderOpen, Gauge,
  HardDrive, KeyRound, MonitorSmartphone, Palette, PlugZap, RefreshCw, Rocket, Settings2,
  ShieldCheck, TriangleAlert, Workflow,
} from 'lucide-react';
import { clsx } from 'clsx';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useApp } from '@/context/AppContext';
import { useShiguangSync } from '@/context/ShiguangSyncContext';
import { SHIGUANG_INTEGRATIONS } from '@/lib/integrations';
import type { NavTab, UpdateCheckResult } from '@/types';
import type { InterfaceDensity, SyncIntervalMinutes } from '@/lib/settings';

const WORK_DISK_PATH = 'D:\\拾光工作盘';

const Panel: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
  <section className={clsx('liquid-glass p-4 sm:p-5 min-w-0', className)}>{children}</section>
);

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; meta?: string; action?: React.ReactNode }> = ({ icon: Icon, title, meta, action }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="liquid-icon-well w-8 h-8 rounded-xl flex items-center justify-center text-emerald-300 shrink-0"><Icon className="w-4 h-4" /></span>
      <div className="min-w-0"><h2 className="text-[14px] font-bold text-white truncate">{title}</h2>{meta && <p className="text-[10px] text-white/45 mt-0.5 truncate">{meta}</p>}</div>
    </div>
    {action}
  </div>
);

const SmallButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className, children, ...props }) => (
  <button {...props} className={clsx(primary ? 'liquid-btn-primary text-[#04120c]' : 'liquid-btn-ghost text-white/70', 'touch-action min-h-9 px-3 rounded-xl text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed', className)}>{children}</button>
);

const StatusPill: React.FC<{ state: 'good' | 'warn' | 'neutral'; children: React.ReactNode }> = ({ state, children }) => (
  <span className={clsx('text-[9px] px-2 py-1 rounded-full border shrink-0', state === 'good' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : state === 'warn' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/[0.04] text-white/55')}>{children}</span>
);

const SwitchRow: React.FC<{ label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, hint, checked, onChange }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 text-left">
    <span><span className="text-[12px] text-white/85 block">{label}</span><span className="text-[10px] text-white/50 mt-1 block leading-4">{hint}</span></span>
    <span className={clsx('w-10 h-6 rounded-full border p-0.5 transition-colors shrink-0', checked ? 'bg-[var(--accent-main)] border-white/30' : 'bg-white/[0.05] border-white/15')}><span className={clsx('block w-4 h-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} /></span>
  </button>
);

const Readout: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4"><span className="text-white/50 shrink-0">{label}</span><span className={clsx('text-white/80 text-right break-all', mono && 'font-mono text-[10px]')}>{value}</span></div>
);

const shortDigest = (value: string | null) => value ? `${value.slice(0, 18)}…${value.slice(-6)}` : '未取得';

type IntegrationStatus = {
  runtime?: { taskInstalled: boolean; taskState: string };
  ai?: { configured: boolean; endpointHost: string | null; model: string | null };
  cos?: { configured: boolean; bucket: string | null; region: string | null };
};

const gatewayCodeLabel = (code: string) => ({
  NODEGATEWAY_READY: '底座已就绪',
  NODEGATEWAY_CONNECTED: '连接正常',
  NODEGATEWAY_IPC_UNAVAILABLE: '桌面通信不可用',
  NODEGATEWAY_NOT_CONFIGURED: '底座尚未配置',
  NODEGATEWAY_UNREACHABLE: '本地服务未启动',
  NODEGATEWAY_STATUS_FAILED: '状态检测失败',
  NODEGATEWAY_TASK_NOT_INSTALLED: '本机底座组件尚未安装',
  NODEGATEWAY_START_REQUESTED: '已请求启动本机底座',
  AI_CONFIGURATION_SAVED: 'AI 配置已安全保存',
  AI_CONNECTION_TEST_PASSED: 'AI 最小连接测试通过',
  AI_CONNECTION_TEST_FAILED: 'AI 连接测试失败',
  AI_NOT_CONFIGURED: '请先配置 AI',
  COS_CONFIGURATION_SAVED: 'COS 配置已安全保存',
  INTEGRATION_USER_CANCELLED: '已取消配置',
  INTEGRATION_CREDENTIAL_PROMPT_FAILED: '本地密钥输入窗口启动失败',
  INTEGRATION_CONFIG_WRITE_FAILED: '本地安全配置写入失败',
  INTEGRATION_CONFIGURATOR_MISSING: '安全配置器缺失，请重新安装拾光',
  INTEGRATION_CONFIGURATOR_FAILED: '安全配置器执行失败',
}[code] ?? code);

const STARTUP_OPTIONS: Array<{ value: NavTab; label: string }> = [
  { value: 'dashboard', label: '今日工作台' },
  { value: 'inbox', label: '收件箱' },
  { value: 'work', label: '工作事项' },
  { value: 'projects', label: '信息化项目' },
  { value: 'knowledge', label: '文件盘' },
];

export const SettingsPage: React.FC = () => {
  const {
    accentColor, setAccentColor, glassBlur, setGlassBlur, enableConfetti, setEnableConfetti,
    reducedMotion, setReducedMotion, interfaceDensity, setInterfaceDensity,
    startupPage, setStartupPage, autoPull, setAutoPull, syncIntervalMinutes, setSyncIntervalMinutes,
    businessTasks, files, workspaces, legacyLocalStatePresent,
  } = useApp();
  const sync = useShiguangSync();
  const [aiOpen, setAiOpen] = useState(false);
  const [cosOpen, setCosOpen] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationResult, setIntegrationResult] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState({ endpoint: '', model: '' });
  const [cosForm, setCosForm] = useState({ bucket: '', region: '' });
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [workDiskResult, setWorkDiskResult] = useState<string | null>(null);

  const phaseLabel = { initializing: '初始化中', connected: '已连接', offline: '未连接', conflict: '存在冲突', error: '错误' }[sync.phase];
  const submitLabel = sync.submitStatus === 'committed' ? '已提交并确认' : sync.submitStatus === 'accepted' ? '已受理' : '暂无提交';
  const gatewayGood = sync.connected && sync.configured;
  const aiConfigured = integrationStatus?.ai?.configured === true;
  const cosConfigured = integrationStatus?.cos?.configured === true;
  const aiReady = gatewayGood && aiConfigured;

  const refreshIntegrationStatus = async () => {
    if (!window.shiguangIntegrations) {
      setIntegrationResult('仅桌面版支持安全接入配置');
      return;
    }
    const result = await window.shiguangIntegrations.status();
    if (!result.ok) {
      setIntegrationResult(gatewayCodeLabel(result.error.code));
      return;
    }
    setIntegrationStatus(result.value);
    if (result.value.ai?.configured) setAiForm({ endpoint: `https://${result.value.ai.endpointHost}/v1/chat/completions`, model: result.value.ai.model ?? '' });
    if (result.value.cos?.configured) setCosForm({ bucket: result.value.cos.bucket ?? '', region: result.value.cos.region ?? '' });
  };

  useEffect(() => { void refreshIntegrationStatus(); }, []);

  const configureIntegration = async (kind: 'ai' | 'cos') => {
    if (!window.shiguangIntegrations) return;
    setIntegrationBusy(true);
    setIntegrationResult(null);
    try {
      const result = kind === 'ai'
        ? await window.shiguangIntegrations.configure('ai', aiForm)
        : await window.shiguangIntegrations.configure('cos', cosForm);
      setIntegrationResult(gatewayCodeLabel(result.ok ? result.value.code : result.error.code));
      if (result.ok) await refreshIntegrationStatus();
    } finally {
      setIntegrationBusy(false);
    }
  };

  const testAi = async () => {
    if (!window.shiguangIntegrations) return;
    setIntegrationBusy(true);
    try {
      const result = await window.shiguangIntegrations.test('ai');
      setIntegrationResult(gatewayCodeLabel(result.ok ? result.value.code : result.error.code));
    } finally { setIntegrationBusy(false); }
  };

  const startRuntime = async () => {
    if (!window.shiguangIntegrations) return;
    setIntegrationBusy(true);
    try {
      const result = await window.shiguangIntegrations.startRuntime();
      setIntegrationResult(gatewayCodeLabel(result.ok ? result.value.code : result.error.code));
      await refreshIntegrationStatus();
      if (result.ok) window.setTimeout(() => { void sync.refresh(); }, 1200);
    } finally { setIntegrationBusy(false); }
  };

  const checkUpdates = async () => {
    setUpdateBusy(true);
    try {
      if (!window.shiguang?.isElectron) {
        setUpdateResult({ currentVersion: '本地预览', error: '仅桌面版支持版本检查' });
        return;
      }
      setUpdateResult(await window.shiguang.checkForUpdates());
    } finally {
      setUpdateBusy(false);
    }
  };

  const openWorkDisk = async () => {
    if (!window.shiguang?.openWorkDisk) {
      setWorkDiskResult('仅桌面版可打开本地目录');
      return;
    }
    const result = await window.shiguang.openWorkDisk();
    setWorkDiskResult(result.ok ? '已打开工作盘' : result.error ?? '打开失败');
  };

  return <div className="p-1 pb-5 grid xl:grid-cols-2 gap-4 items-start">
    <Panel>
      <SectionTitle icon={Palette} title="界面与操作" meta="偏好即时保存，不写入业务数据或 COS" />
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4">
          <label className="text-[11px] text-white/60 block mb-2">强调色</label>
          <div className="flex gap-2">{(['emerald', 'cyan', 'amber'] as const).map((color) => <button key={color} aria-label={`选择 ${color} 强调色`} onClick={() => setAccentColor(color)} className={clsx('w-10 h-10 rounded-xl border transition-transform', color === 'emerald' ? 'bg-emerald-400' : color === 'cyan' ? 'bg-cyan-400' : 'bg-amber-400', accentColor === color ? 'border-white scale-105' : 'border-white/10 opacity-55')} />)}</div>
        </div>
        <div className="space-y-3">
          <label className="text-[11px] text-white/60 block">玻璃模糊<LiquidSelect aria-label="玻璃模糊" value={glassBlur} onChange={(value) => setGlassBlur(value as typeof glassBlur)} className="mt-2" options={[{ value: 'standard', label: '标准' }, { value: 'ultra', label: '增强' }, { value: 'max', label: '最高' }]} /></label>
          <label className="text-[11px] text-white/60 block">信息密度<LiquidSelect aria-label="信息密度" value={interfaceDensity} onChange={(value) => setInterfaceDensity(value as InterfaceDensity)} className="mt-2" options={[{ value: 'comfortable', label: '舒适' }, { value: 'compact', label: '紧凑' }]} /></label>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <SwitchRow label="完成动效" hint="完成事项时播放轻量庆祝效果" checked={enableConfetti} onChange={setEnableConfetti} />
        <SwitchRow label="减少动态效果" hint="关闭大幅位移，保留必要状态反馈" checked={reducedMotion} onChange={setReducedMotion} />
      </div>
      <label className="text-[11px] text-white/60 block mt-4">启动后进入<LiquidSelect aria-label="启动页面" value={startupPage} onChange={(value) => setStartupPage(value as NavTab)} className="mt-2" options={STARTUP_OPTIONS} /></label>
      <p className="text-[10px] text-white/40 mt-2">启动页设置从下次打开拾光开始生效。</p>
    </Panel>

    <Panel>
      <SectionTitle icon={Activity} title="NodeGateway" meta="拾光、AI 与 COS 共用的本地安全底座" action={<StatusPill state={gatewayGood ? 'good' : 'warn'}>{gatewayGood ? '已连接' : '未就绪'}</StatusPill>} />
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 space-y-3 text-[11px]">
        <Readout label="服务地址" value="127.0.0.1:8765" mono />
        <Readout label="当前状态" value={gatewayCodeLabel(sync.code)} />
        <Readout label="节点" value={sync.nodeId ?? '未取得'} mono />
        <Readout label="Agent 实例" value={sync.agentInstanceId ?? '未取得'} mono />
        <Readout label="启动代次" value={sync.gatewayBootGeneration ?? '未取得'} />
        <Readout label="全局 README" value={shortDigest(sync.globalReadmeSha256)} mono />
        <Readout label="读取回执" value={shortDigest(sync.receiptDigest)} mono />
      </div>
      {!gatewayGood && <div role="alert" className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-[10px] text-amber-100 leading-5"><TriangleAlert className="w-4 h-4 inline mr-2" />当前设置页可正常保存本地偏好，但 AI、COS 拉取和提交会保持停用，直到 NodeGateway 启动并通过 README 门禁。</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <SmallButton primary onClick={() => void sync.refresh()} disabled={sync.busy}><RefreshCw className={clsx('w-3.5 h-3.5', sync.busy && 'animate-spin')} />重新检测</SmallButton>
        <SmallButton onClick={() => void startRuntime()} disabled={integrationBusy}><Workflow className="w-3.5 h-3.5" />{integrationStatus?.runtime?.taskInstalled ? '启动本机底座' : '检查底座组件'}</SmallButton>
      </div>
      <p className="text-[10px] text-white/40 mt-2">底座入口只启动已安装的固定任务，不会静默创建服务、计划任务、防火墙规则或公网入口。</p>
      {integrationResult && <div role="status" className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] text-white/65">{integrationResult}</div>}
    </Panel>

    <Panel>
      <SectionTitle icon={Bot} title="AI 接入" meta="候选分类、每日摘要与状态建议" action={<StatusPill state={aiReady ? 'good' : 'warn'}>{aiReady ? '可用' : '待配置'}</StatusPill>} />
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 space-y-3 text-[11px]">
        <Readout label="接入类型" value="OpenAI Compatible" />
        <Readout label="能力接口" value={SHIGUANG_INTEGRATIONS.ai.backendCapability} mono />
        <Readout label="配置归属" value="NodeGateway" />
        <Readout label="密钥保存" value="Windows DPAPI CurrentUser" />
        <Readout label="执行边界" value="只给建议，不直接执行任务" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><SmallButton primary onClick={() => setAiOpen(true)}><PlugZap className="w-3.5 h-3.5" />{aiConfigured ? '管理 AI 接入' : '接入 AI'}</SmallButton><SmallButton onClick={() => void sync.refresh()} disabled={sync.busy}>检测底座</SmallButton></div>
      <p className="text-[10px] text-white/45 leading-5 mt-3">模型 API Key 不写入 localStorage、日志、工作状态或 COS。Provider 仍由 NodeGateway 持有。</p>
    </Panel>

    <Panel>
      <SectionTitle icon={CloudCog} title="COS 同步" meta="加密不可变版本，经 NodeGateway 双向同步" action={<StatusPill state={sync.connected ? 'good' : cosConfigured ? 'neutral' : 'warn'}>{sync.connected ? '通道可达' : cosConfigured ? '已配置' : '待配置'}</StatusPill>} />
      <SwitchRow label="自动拉取远端更新" hint="仅在本地无待提交变更、无冲突时执行" checked={autoPull} onChange={setAutoPull} />
      <label className="text-[11px] text-white/60 block mt-3">状态检查间隔<LiquidSelect aria-label="状态检查间隔" value={String(syncIntervalMinutes)} onChange={(value) => setSyncIntervalMinutes(Number(value) as SyncIntervalMinutes)} disabled={!autoPull} className="mt-2" options={[1, 5, 15, 30].map((value) => ({ value: String(value), label: `${value} 分钟` }))} /></label>
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 mt-3 space-y-3 text-[11px]">
        <Readout label="同步阶段" value={phaseLabel} />
        <Readout label="待提交变更" value={sync.dirty ? '有' : '无'} />
        <Readout label="远端 Head" value={`${sync.headCount} 个`} />
        <Readout label="当前版本" value={shortDigest(sync.versionId)} mono />
        <Readout label="上次拉取" value={sync.lastPulledAt ?? '尚未拉取'} />
        <Readout label="上次提交" value={sync.lastSubmittedAt ?? '尚未提交'} />
        <Readout label="提交结果" value={submitLabel} />
      </div>
      {sync.error && sync.phase !== 'conflict' && <div role="alert" className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[10px] text-amber-100">{gatewayCodeLabel(sync.error)}</div>}
      <div className="flex flex-wrap gap-2 mt-3"><SmallButton primary onClick={() => setCosOpen(true)}><KeyRound className="w-3.5 h-3.5" />{cosConfigured ? '管理 COS 接入' : '接入 COS'}</SmallButton><SmallButton onClick={() => void sync.refresh()} disabled={sync.busy}><Gauge className="w-3.5 h-3.5" />检测通道</SmallButton><SmallButton onClick={() => void sync.pullNow()} disabled={!sync.connected || sync.busy}>立即拉取</SmallButton><SmallButton onClick={() => void sync.submitNow()} disabled={!sync.connected || sync.busy || !sync.dirty}>提交当前版本</SmallButton></div>
    </Panel>

    <Panel>
      <SectionTitle icon={HardDrive} title="工作盘与本地数据" meta="本地工作目录固定在 D 盘" />
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 space-y-3 text-[11px]">
        <Readout label="工作盘" value={WORK_DISK_PATH} mono />
        <Readout label="目录分层" value="收到 / 分类 / 正在干 / 干完 / 归档" />
        <Readout label="默认驻留" value="仅元数据，按需物化" />
        <Readout label="本地事项" value={`${businessTasks.length} 条`} />
        <Readout label="文件索引" value={`${files.length} 条`} />
        <Readout label="项目" value={`${workspaces.length} 个`} />
        <Readout label="旧状态迁移" value={legacyLocalStatePresent ? '待迁移' : '无'} />
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap"><SmallButton primary onClick={() => void openWorkDisk()}><FolderOpen className="w-3.5 h-3.5" />打开工作盘</SmallButton>{workDiskResult && <span role="status" className="text-[10px] text-white/50">{workDiskResult}</span>}</div>
    </Panel>

    <Panel>
      <SectionTitle icon={Rocket} title="版本与维护" meta="检查 GitHub 正式发布，不自动安装" />
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.08] p-4 space-y-3 text-[11px]">
        <Readout label="当前版本" value={updateResult?.currentVersion ?? '点击检查后读取'} />
        <Readout label="最新版本" value={updateResult?.latestVersion ?? '尚未检查'} />
        <Readout label="检查结果" value={updateResult?.error ? updateResult.error : updateResult?.hasUpdate ? '发现新版本' : updateResult ? '已是最新版本' : '尚未检查'} />
        <Readout label="更新方式" value="人工确认后下载安装" />
      </div>
      <div className="mt-3"><SmallButton primary onClick={() => void checkUpdates()} disabled={updateBusy}><RefreshCw className={clsx('w-3.5 h-3.5', updateBusy && 'animate-spin')} />检查更新</SmallButton></div>
    </Panel>

    <Panel className="xl:col-span-2">
      <SectionTitle icon={MonitorSmartphone} title="三端协同边界" meta="家庭电脑、办公电脑、C·ONE 与 COS 的真实状态" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { title: '家庭电脑', state: gatewayGood ? '本机底座已连接' : '本机未验证', text: '独立身份、独立工作盘、独立 NodeGateway' },
          { title: '办公电脑', state: '尚未接入', text: '保留独立身份与一键安装入口' },
          { title: 'C·ONE', state: '本页不改动', text: '独立 OpenClaw，通过隔离连接器读取获准视图' },
          { title: 'COS', state: sync.connected ? '经本机网关可达' : '等待本机网关', text: '唯一持久化真源，只做加密中转' },
        ].map((item) => <article key={item.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-center justify-between gap-3"><span className="w-9 h-9 rounded-xl liquid-icon-well flex items-center justify-center text-emerald-300"><Database className="w-4 h-4" /></span><span className="text-[9px] text-white/45">{item.state}</span></div><h3 className="text-[12px] font-semibold mt-3">{item.title}</h3><p className="text-[10px] text-white/45 leading-5 mt-1">{item.text}</p></article>)}
      </div>
    </Panel>

    <LiquidModal open={aiOpen} onClose={() => setAiOpen(false)} title="AI 安全接入" subtitle="填写非敏感参数，API Key 在独立的 Windows 本地安全窗口中输入" icon={<Bot className="w-5 h-5" />} widthClass="max-w-2xl" footer={<div className="flex justify-end gap-2"><SmallButton onClick={() => setAiOpen(false)}>关闭</SmallButton><SmallButton primary onClick={() => void configureIntegration('ai')} disabled={integrationBusy || !aiForm.endpoint || !aiForm.model}><KeyRound className="w-3.5 h-3.5" />安全保存 API Key</SmallButton></div>}>
      <div className="space-y-3 text-[11px]">
        <div className="grid sm:grid-cols-2 gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
          <label className="text-white/60">接口地址
            <input value={aiForm.endpoint} onChange={(event) => setAiForm({ ...aiForm, endpoint: event.target.value.trim() })} placeholder="https://服务域名/v1/chat/completions" className="liquid-input w-full mt-2" autoComplete="off" spellCheck={false} />
          </label>
          <label className="text-white/60">模型名称
            <input value={aiForm.model} onChange={(event) => setAiForm({ ...aiForm, model: event.target.value.trim() })} placeholder="例如：工作状态模型名称" className="liquid-input w-full mt-2" autoComplete="off" spellCheck={false} />
          </label>
          <div className="sm:col-span-2 text-[10px] text-white/45 leading-5">只允许 HTTPS 且路径固定为 <span className="font-mono">/v1/chat/completions</span>。保存时系统会弹出独立密码框，拾光网页层看不到 API Key。</div>
        </div>
        {[
          { title: '1. 本地底座', state: gatewayGood ? '通过' : '未通过', good: gatewayGood, text: gatewayGood ? 'NodeGateway 已认证并通过 README 门禁。' : `当前：${gatewayCodeLabel(sync.code)}。` },
          { title: '2. Provider 配置', state: aiConfigured ? '已保存' : '待配置', good: aiConfigured, text: aiConfigured ? `当前主机：${integrationStatus?.ai?.endpointHost ?? '已隐藏'}；模型：${integrationStatus?.ai?.model ?? '已隐藏'}。` : 'Provider、模型和允许域名由安全配置器校验，API Key 使用 DPAPI CurrentUser 加密。' },
          { title: '3. 能力范围', state: '已限定', good: true, text: '仅允许候选分类、每日摘要和状态建议；不能直接完成、归档、删除或对外发送。' },
        ].map((step) => <div key={step.title} className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-white/85">{step.title}</span><StatusPill state={step.good ? 'good' : 'warn'}>{step.state}</StatusPill></div><p className="text-white/45 mt-2 leading-5">{step.text}</p></div>)}
        <div className="flex items-center gap-3 flex-wrap"><SmallButton onClick={() => void testAi()} disabled={integrationBusy || !aiConfigured}>发送一次最小连接测试</SmallButton><span className="text-[10px] text-white/40">仅手动触发，避免消耗模型配额。</span></div>
        {integrationResult && <div role="status" className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] text-white/65">{integrationResult}</div>}
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4 text-[10px] text-emerald-100/80 leading-5"><ShieldCheck className="w-4 h-4 inline mr-2" />安全约束：拾光设置页不接收 SecretId、SecretKey 或模型 API Key；这些 L3 凭据不会进入 renderer、业务状态、日志或 COS。</div>
      </div>
    </LiquidModal>

    <LiquidModal open={cosOpen} onClose={() => setCosOpen(false)} title="COS 安全接入" subtitle="填写桶和地域，SecretId/SecretKey 在独立的 Windows 本地安全窗口中输入" icon={<CloudCog className="w-5 h-5" />} widthClass="max-w-2xl" footer={<div className="flex justify-end gap-2"><SmallButton onClick={() => setCosOpen(false)}>关闭</SmallButton><SmallButton primary onClick={() => void configureIntegration('cos')} disabled={integrationBusy || !cosForm.bucket || !cosForm.region}><KeyRound className="w-3.5 h-3.5" />安全保存 COS 凭据</SmallButton></div>}>
      <div className="space-y-3 text-[11px]">
        <div className="grid sm:grid-cols-2 gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
          <label className="text-white/60">存储桶（含 APPID）
            <input value={cosForm.bucket} onChange={(event) => setCosForm({ ...cosForm, bucket: event.target.value.trim().toLowerCase() })} placeholder="bucket-name-1234567890" className="liquid-input w-full mt-2" autoComplete="off" spellCheck={false} />
          </label>
          <label className="text-white/60">地域
            <input value={cosForm.region} onChange={(event) => setCosForm({ ...cosForm, region: event.target.value.trim().toLowerCase() })} placeholder="ap-beijing" className="liquid-input w-full mt-2" autoComplete="off" spellCheck={false} />
          </label>
        </div>
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-white/85">当前配置</span><StatusPill state={cosConfigured ? 'good' : 'warn'}>{cosConfigured ? '已保存' : '待配置'}</StatusPill></div>
          <div className="mt-3 space-y-2"><Readout label="存储桶" value={integrationStatus?.cos?.bucket ?? '未取得'} mono /><Readout label="地域" value={integrationStatus?.cos?.region ?? '未取得'} mono /><Readout label="通信路径" value="拾光 → NodeGateway → COS" /></div>
        </div>
        <div className="flex flex-wrap gap-2"><SmallButton onClick={() => void refreshIntegrationStatus()} disabled={integrationBusy}>检查本地配置</SmallButton><SmallButton onClick={() => void sync.refresh()} disabled={sync.busy || !cosConfigured}>通过底座检测通道</SmallButton></div>
        {integrationResult && <div role="status" className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] text-white/65">{integrationResult}</div>}
        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4 text-[10px] text-amber-100/80 leading-5"><TriangleAlert className="w-4 h-4 inline mr-2" />保存 COS 凭据会替换当前用户的正式接入配置；系统原生提示会明确显示这一点。拾光仍不直连 COS，也不获得删除、移动、复制或覆盖权限。</div>
      </div>
    </LiquidModal>
  </div>;
};
