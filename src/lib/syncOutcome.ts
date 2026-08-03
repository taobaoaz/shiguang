export type VersionReceiptStatus = 'accepted' | 'committed';

export interface SyncPresentation {
  lastStatus: string;
  toast: string;
}

function shortVersion(versionId: string): string {
  return `${versionId.slice(0, 18)}…`;
}

export function pushReceiptPresentation(
  status: VersionReceiptStatus,
  versionId: string,
): SyncPresentation {
  if (status === 'accepted') {
    return {
      lastStatus: '已入本地待同步队列',
      toast: `已入本地待同步队列：${shortVersion(versionId)}`,
    };
  }
  return {
    lastStatus: '已写入本地版本库，等待云端校验',
    toast: `已写入本地版本库，等待云端校验：${shortVersion(versionId)}`,
  };
}

export function verifiedPullPresentation(verifiedAt: string): SyncPresentation {
  return {
    lastStatus: `云端校验完成 ${verifiedAt}`,
    toast: '已从 PAW 拉取，云端版本校验完成',
  };
}
