import { useState, useEffect, useCallback } from 'react';

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
  groups: {
    name: string;
    total: number;
    today: number;
    lastUpdate: string | null;
  }[];
  totalMessages: number;
}

export function useProductionData() {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, groupsRes] = await Promise.all([
        fetch('/api/production/workspace'),
        fetch('/api/production/groups'),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // 每 60 秒自动刷新
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { status, groups, loading, error, refresh: fetchAll };
}
