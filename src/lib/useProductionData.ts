import { useState, useEffect, useCallback, useRef } from 'react';

interface Message {
  time: string;
  group: string;
  sender: string;
  content: string;
  timestamp: number;
  event: string;
}

interface GroupData {
  group: string;
  latestMessages: Message[];
  totalCount: number;
  todayCount: number;
  lastUpdate: string | null;
}

interface WorkspaceStatus {
  connected: boolean;
  dataSource: string;
  groups: { name: string; total: number; today: number; lastUpdate: string | null }[];
  totalMessages: number;
}

const disconnectedStatus = (): WorkspaceStatus => ({
  connected: false,
  dataSource: 'nodegateway',
  groups: [],
  totalMessages: 0,
});

export function useProductionData(onRemoteState?: (state: unknown) => void) {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialPullDone = useRef(false);
  const groupCache = useRef<GroupData[]>([]);

  const fetchAll = useCallback(async (includeState = false) => {
    setLoading(true);
    try {
      const gateway = window.shiguangGateway;
      if (!gateway) throw new Error('NODEGATEWAY_IPC_UNAVAILABLE');
      const gatewayStatus = await gateway.status();
      if (!gatewayStatus.ok || !gatewayStatus.value.connected) {
        throw new Error(gatewayStatus.ok ? gatewayStatus.value.code : gatewayStatus.error.code);
      }
      let nextGroups: GroupData[] = [];
      let stateWarning: string | null = null;
      if (includeState && !initialPullDone.current) {
        const stateResult = await gateway.pullState();
        if (!stateResult.ok) throw new Error(stateResult.error.code);
        if (stateResult.value.status === 'remote-loaded') onRemoteState?.(stateResult.value.state);
        if (stateResult.value.status === 'conflict') stateWarning = 'SHIGUANG_STATE_CONFLICT';
        nextGroups = [{
          group: 'shiguang-state',
          latestMessages: [],
          totalCount: stateResult.value.headCount,
          todayCount: stateResult.value.status === 'conflict' ? stateResult.value.headCount : 0,
          lastUpdate: stateResult.value.status === 'remote-loaded' ? stateResult.value.versionId : null,
        }];
        initialPullDone.current = true;
      } else nextGroups = groupCache.current;
      const total = nextGroups.reduce((sum, item) => sum + item.totalCount, 0);
      groupCache.current = nextGroups;
      setGroups(nextGroups);
      setStatus({
        connected: true,
        dataSource: 'nodegateway',
        groups: nextGroups.map((group) => ({
          name: group.group,
          total: group.totalCount,
          today: group.todayCount,
          lastUpdate: group.lastUpdate,
        })),
        totalMessages: total,
      });
      setError(stateWarning);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'NODEGATEWAY_UNKNOWN_ERROR';
      setStatus(disconnectedStatus());
      setGroups([]);
      setError(code);
    } finally {
      setLoading(false);
    }
  }, [onRemoteState]);

  useEffect(() => {
    void fetchAll(true);
    const interval = window.setInterval(() => void fetchAll(false), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchAll]);

  return { status, groups, loading, error, refresh: () => fetchAll(false) };
}
