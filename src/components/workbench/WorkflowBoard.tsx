import React from 'react';
import { Archive, CheckCircle2, CircleDot, FolderInput, PlayCircle, Paperclip, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import type { TaskItem, WorkStage } from '@/types';
import { getWorkItemType, stageOrder, workStageGroup } from '@/lib/workbench';

const stageIcon: Record<WorkStage, React.ElementType> = {
  RECEIVED: FolderInput,
  TRIAGED: CircleDot,
  IN_PROGRESS: PlayCircle,
  COMPLETED: CheckCircle2,
  ARCHIVED: Archive,
};

const stageTone: Record<WorkStage, string> = {
  RECEIVED: 'text-amber-200 border-amber-400/20 bg-amber-400/[0.05]',
  TRIAGED: 'text-sky-200 border-sky-400/20 bg-sky-400/[0.05]',
  IN_PROGRESS: 'text-cyan-200 border-cyan-400/20 bg-cyan-400/[0.05]',
  COMPLETED: 'text-emerald-200 border-emerald-400/20 bg-emerald-400/[0.05]',
  ARCHIVED: 'text-white/55 border-white/10 bg-white/[0.025]',
};

interface WorkflowBoardProps {
  tasks: TaskItem[];
  selectedId?: string;
  onSelect: (task: TaskItem) => void;
}

export const WorkflowBoard: React.FC<WorkflowBoardProps> = ({ tasks, selectedId, onSelect }) => (
  <div className="workflow-scroll overflow-x-auto pb-2" aria-label="五阶段工作流">
    <div className="workflow-grid grid grid-cols-5 gap-3 min-w-[1080px]">
      {stageOrder.map((stage) => {
        const Icon = stageIcon[stage];
        const items = tasks.filter((task) => task.stage === stage);
        return (
          <section key={stage} className={clsx('workflow-column rounded-2xl border p-3 min-h-[330px]', stageTone[stage])} aria-labelledby={`stage-${stage}`}>
            <header className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <h3 id={`stage-${stage}`} className="text-[11px] font-bold text-white/90 truncate">{workStageGroup[stage]}</h3>
              </div>
              <span className="font-mono text-[10px] text-white/45">{items.length}</span>
            </header>
            <div className="space-y-2">
              {items.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => onSelect(task)}
                  className={clsx(
                    'w-full text-left rounded-xl border p-3 transition-colors',
                    selectedId === task.id
                      ? 'border-[var(--accent-main)] bg-white/[0.08]'
                      : 'border-white/[0.07] bg-black/20 hover:bg-white/[0.05] hover:border-white/15',
                  )}
                >
                  <div className="text-[11px] font-semibold text-white/90 leading-4 line-clamp-2">{task.title}</div>
                  <div className="flex items-center justify-between gap-2 mt-2 text-[9px] text-white/45">
                    <span>{getWorkItemType(task)}</span>
                    <span className="truncate">{task.assignee.name}</span>
                  </div>
                  {(task.attentionFlags.length > 0 || task.fileRefs.length > 0) && (
                    <div className="flex items-center gap-2 mt-2 text-[9px]">
                      {task.attentionFlags.length > 0 && <span className="inline-flex items-center gap-1 text-amber-200"><AlertTriangle className="w-3 h-3" />{task.attentionFlags.length}</span>}
                      {task.fileRefs.length > 0 && <span className="inline-flex items-center gap-1 text-white/45"><Paperclip className="w-3 h-3" />{task.fileRefs.length}</span>}
                    </div>
                  )}
                </button>
              ))}
              {items.length === 0 && <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-8 text-center text-[10px] text-white/35">当前为空</div>}
            </div>
          </section>
        );
      })}
    </div>
  </div>
);

