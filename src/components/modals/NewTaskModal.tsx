import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Priority, TaskItem, WorkItemType } from '@/types';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useApp } from '@/context/AppContext';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Partial<TaskItem>) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onAddTask }) => {
  const { currentWorkspace, workspaces } = useApp();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkItemType>('任务');
  const [priority, setPriority] = useState<Priority>('中');
  const [project, setProject] = useState(currentWorkspace);
  const [deadline, setDeadline] = useState('');
  const [assignee, setAssignee] = useState('老大');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (isOpen) setProject(currentWorkspace);
  }, [currentWorkspace, isOpen]);

  const reset = () => {
    setTitle('');
    setType('任务');
    setPriority('中');
    setProject(currentWorkspace);
    setDeadline('');
    setAssignee('老大');
    setDescription('');
    setTagsInput('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const manualTags = tagsInput.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean);
    onAddTask({
      id: `WORK-${Date.now()}`,
      title: title.trim(),
      priority,
      stage: 'RECEIVED',
      assignee: { name: assignee.trim() || '老大', avatar: (assignee.trim() || '老大').slice(0, 2), role: '负责人' },
      project,
      deadline: deadline || '待确认',
      description: description.trim(),
      tags: [`类型:${type}`, '来源:手动录入', ...manualTags],
      aiSuggestions: [],
      completionProgress: 0,
      nextAction: '待分类',
      attentionFlags: [],
      sourceRefs: [`source:manual:${Date.now()}`],
      evidenceRefs: [],
      fileRefs: [],
    });
    close();
  };

  const field = 'liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/30';

  return (
    <LiquidModal
      open={isOpen}
      onClose={close}
      title="新增工作事项"
      subtitle="任务、服务请求、故障、变更和巡检统一登记"
      icon={<Plus className="w-5 h-5" />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={close} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</motion.button>
          <motion.button whileTap={{ scale: 0.96 }} type="submit" form="new-work-form" className="h-10 px-5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />保存事项
          </motion.button>
        </div>
      }
    >
      <form id="new-work-form" onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="work-title" className="block text-[11px] text-white/45 mb-1.5">事项名称 <span className="text-emerald-300">*</span></label>
          <input id="work-title" autoFocus data-autofocus className={field} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：处理办公楼核心交换机告警" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-white/45 mb-1.5">事项类型</label>
            <LiquidSelect aria-label="事项类型" value={type} onChange={(value) => setType(value as WorkItemType)} options={['任务', '服务请求', '故障', '变更', '巡检'].map((value) => ({ value, label: value }))} />
          </div>
          <div>
            <label className="block text-[11px] text-white/45 mb-1.5">优先级</label>
            <LiquidSelect aria-label="优先级" value={priority} onChange={(value) => setPriority(value as Priority)} options={['紧急', '高', '中', '低'].map((value) => ({ value, label: value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-white/45 mb-1.5">所属项目</label>
            <LiquidSelect aria-label="所属项目" value={project} onChange={setProject} options={workspaces.map((value) => ({ value, label: value }))} />
          </div>
          <div>
            <label htmlFor="work-deadline" className="block text-[11px] text-white/45 mb-1.5">截止日期</label>
            <input id="work-deadline" type="date" className={field} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="work-assignee" className="block text-[11px] text-white/45 mb-1.5">负责人</label>
          <input id="work-assignee" className={field} value={assignee} onChange={(event) => setAssignee(event.target.value)} />
        </div>

        <div>
          <label htmlFor="work-description" className="block text-[11px] text-white/45 mb-1.5">说明</label>
          <textarea id="work-description" className={`${field} resize-none`} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="记录影响范围、处理目标或验收条件" />
        </div>

        <div>
          <label htmlFor="work-tags" className="block text-[11px] text-white/45 mb-1.5">标签</label>
          <input id="work-tags" className={field} value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="厂区、系统或部门，使用逗号分隔" />
        </div>
      </form>
    </LiquidModal>
  );
};
