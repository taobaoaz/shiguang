import type { ShiguangState } from '@/lib/shiguangState';

export {};

type GatewayError = { code: string; message: string };
type GatewayResult<T> = { ok: true; value: T } | { ok: false; error: GatewayError };

interface ShiguangGatewayStatus {
  schemaVersion: 'shiguang.gateway.status.v1';
  configured: boolean;
  connected: boolean;
  code: string;
  nodeId?: string;
  agentInstanceId?: string;
  gatewayBootGeneration?: number;
  globalReadmeSha256?: string;
  receiptDigest?: string;
}

interface VersionReceipt {
  workspace_id: string;
  file_id: 'shiguang-state';
  version_id: string;
  event_id: string;
  event_hash: string;
  status: 'accepted' | 'committed';
  replayed: boolean;
}

type PullStateResult =
  | { schemaVersion: 'shiguang.state-pull-result.v1'; status: 'local-only'; headCount: 0 }
  | { schemaVersion: 'shiguang.state-pull-result.v1'; status: 'conflict'; headCount: number; headVersionIds: string[] }
  | {
      schemaVersion: 'shiguang.state-pull-result.v1';
      status: 'remote-loaded';
      headCount: 1;
      versionId: string;
      contentSha256: string;
      state: ShiguangState;
    };

declare global {
  interface Window {
    shiguangGateway?: Readonly<{
      status(): Promise<GatewayResult<ShiguangGatewayStatus>>;
      pullState(): Promise<GatewayResult<PullStateResult>>;
      pushState(state: ShiguangState): Promise<GatewayResult<VersionReceipt>>;
    }>;
  }
}
