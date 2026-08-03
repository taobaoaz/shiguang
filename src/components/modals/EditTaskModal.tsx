import React, { useEffect, useState } from 'react';
import { CheckCircle2, PencilLine } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AttentionFlag, Priority, TaskItem, WorkItemType } from '@/types';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useApp } from '@/context/AppContext';
import { getWorkItemType } from '@/lib/workbench';

interface EditTaskModalProps {
  open: boolean;
  task: TaskItem | null;
  onClose: () => void;
}

const attentionOptions: Array<{ value: AttentionFlag; label: string }> = [
  { value: 'IMPORTANT', label: '重点关注' },
  { value: 'BLOCKED', label: '受阻' },
  { value: 'WAITING', label: '等待外部' },
  { value: 'OVERDUE', label: '已逾期' },
  { value: 'CONFIRMATION_REQUIRED', label: '需要确认' },
];

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ open, task, onClose }) => {
  const { updateTask, workspaces } = useApp();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkItemType>('任务');
  const [priority, setPriority] = useState<Priority>('中');
  const [project, setProject] = useState('个人工作台');
  const [deadline, setDeadline] = useState('');
  const [assignee, setAssignee] = useState('老大');
  const [description, setDescription] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [attentionFlags, setAttentionFlags] = useState<AttentionFlag[]>([]);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setType(getWorkItemType(task));
    setPriority(task.priority);
    setProject(task.project);
    setDeadline(/^\d{4}-\d{2}-\d{2}$/.test(task.deadline) ? task.deadline : '');
    setAssignee(task.assignee.name);
    setDescription(task.description);
    setNextAction(task.nextAction);
    setAttentionFlags(task.attentionFlags);
  }, [open, task]);

  if (!task) return null;

  const toggleAttention = (flag: AttentionFlag) => {
    setAttentionFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag]);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedOwner = assignee.trim();
    const trimmedNextAction = nextAction.trim();
    if (!trimmedTitle || !trimmedNextAction) return;
    const tags = [`类型:${type}`, ...task.tags.filter((tag) => !tag.startsWith('类型:'))];
    updateTask(task.id, {
      title: trimmedTitle,
      priority,
      project,
      deadline: deadline || '待确认',
      assignee: {
        ...task.assignee,
        name: trimmedOwner || '老大',
        avatar: (trimmedOwner || '老大').slice(0, 2),
      },
      description: description.trim(),
      nextAction: trimmedNextAction,
      attentionFlags,
      tags,
    });
    onClose();
  };

  const field = 'liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/30';

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      title="编辑工作事项"
      subtitle={`${task.id} · 不改变来源、文件关联和当前阶段`}
      icon={<PencilLine className="w-5 h-5" />}
      widthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</motion.button>
          <motion.button whileTap={{ scale: 0.96 }} type="submit" form="edit-work-form" className="h-10 px-5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />保存修改
          </motion.button>
        </div>
      }
    >
      <form id="edit-work-form" onSubmit={submit} className="space-y-3.5">
        <div>
          <label htmlFor="edit-work-title" className="block text-[11px] text-white/55 mb-1.5">事项名称 <span className="text-emerald-300">*</span></label>
          <input id="edit-work-title" autoFocus data-autofocus required className={field} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="block text-[11px] text-white/55 mb-1.5">事项类型</label><LiquidSelect aria-label="编辑事项类型" value={type} onChange={(value) => setType(value as WorkItemType)} options={['任务', '服务请求', '故障', '变更', '巡检'].map((value) => ({ value, label: value }))} /></div>
          <div><label className="block text-[11px] text-white/55 mb-1.5">优先级</label><LiquidSelect aria-label="编辑优先级" value={priority} onChange={(value) => setPriority(value as Priority)} options={['紧急', '高优先级', '高', '中', '低'].map((value) => ({ value, label: value }))} /></div>
          <div><label className="block text-[11px] text-white/55 mb-1.5">所属项目</label><LiquidSelect aria-label="编辑所属项目" value={project} onChange={setProject} options={workspaces.map((value) => ({ value, label: value }))} /></div>
          <div><label htmlFor="edit-work-deadline" className="block text-[11px] text-white/55 mb-1.5">截止日期</label><input id="edit-work-deadline" type="date" className={field} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div>
        </div>

        <div><label htmlFor="edit-work-assignee" className="block text-[11px] text-white/55 mb-1.5">负责人</label><input id="edit-work-assignee" className={field} value={assignee} onChange={(event) => setAssignee(event.target.value)} /></div>
        <div><label htmlFor="edit-work-next" className="block text-[11px] text-white/55 mb-1.5">下一步 <span className="text-emerald-300">*</span></label><input id="edit-work-next" required className={field} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="写清可以立即执行的下一步" /></div>
        <div><label htmlFor="edit-work-description" className="block text-[11px] text-white/55 mb-1.5">说明</label><textarea id="edit-work-description" rows={3} className={`${field} resize-none`} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <fieldset>
          <legend className="text-[11px] text-white/55 mb-2">注意事项</legend>
          <div className="flex flex-wrap gap-2">
            {attentionOptions.map((option) => {
              const selected = attentionFlags.includes(option.value);
              return <button key={option.value} type="button" aria-pressed={selected} onClick={() => toggleAttention(option.value)} className={selected ? 'px-3 py-2 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-100 text-[11px]' : 'px-3 py-2 rounded-xl border border-white/10 bg-white/[0.025] text-white/55 text-[11px] hover:text-white'}>{option.label}</button>;
            })}
          </div>
        </fieldset>
      </form>
    </LiquidModal>
  );
};
