import type { ShiguangState } from './shiguangState.ts';

export type SyncPhase = 'initializing' | 'connected' | 'offline' | 'conflict' | 'error';

export interface SyncSnapshot {
  phase: SyncPhase;
  configured: boolean;
  connected: boolean;
  busy: boolean;
  dirty: boolean;
  code: string;
  error: string | null;
  headCount: number;
  headVersionIds: string[];
  versionId: string | null;
  lastPulledAt: string | null;
  lastSubmittedAt: string | null;
  submitStatus: 'accepted' | 'committed' | null;
}

type GatewayBridge = NonNullable<Window['shiguangGateway']>;
type Listener = (snapshot: SyncSnapshot) => void;

const INITIAL_SNAPSHOT: SyncSnapshot = {
  phase: 'initializing',
  configured: false,
  connected: false,
  busy: true,
  dirty: false,
  code: 'NODEGATEWAY_INITIALIZING',
  error: null,
  headCount: 0,
  headVersionIds: [],
  versionId: null,
  lastPulledAt: null,
  lastSubmittedAt: null,
  submitStatus: null,
};

function stateFingerprint(state: ShiguangState): string {
  return JSON.stringify(state);
}

export class ShiguangSyncController {
  private readonly gateway: GatewayBridge | undefined;
  private readonly importState: (state: unknown) => void;
  private readonly exportState: () => ShiguangState;
  private readonly now: () => string;
  private readonly pollMs: number;
  private snapshot: SyncSnapshot = { ...INITIAL_SNAPSHOT };
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private generation = 0;
  private readyForDirtyTracking = false;
  private baselineFingerprint: string | null = null;

  constructor(
    gateway: GatewayBridge | undefined,
    importState: (state: unknown) => void,
    exportState: () => ShiguangState,
    now: () => string = () => new Date().toLocaleString('zh-CN'),
    pollMs = 60_000,
  ) {
    this.gateway = gateway;
    this.importState = importState;
    this.exportState = exportState;
    this.now = now;
    this.pollMs = pollMs;
  }

  getSnapshot = (): SyncSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<SyncSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const generation = ++this.generation;
    await this.pullNow();
    if (!this.started || generation !== this.generation) return;
    this.timer = setInterval(() => {
      if (!this.snapshot.busy && !this.snapshot.dirty && this.snapshot.phase !== 'conflict') void this.pullNow();
      else void this.refreshStatus();
    }, this.pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
    this.generation += 1;
  }

  async refreshStatus(): Promise<void> {
    if (!this.gateway) {
      this.update({ phase: 'offline', configured: false, connected: false, code: 'NODEGATEWAY_IPC_UNAVAILABLE' });
      return;
    }
    try {
      const result = await this.gateway.status();
      if (!result.ok) {
        this.update({ phase: 'offline', connected: false, code: result.error.code, error: result.error.code });
        return;
      }
      const conflict = this.snapshot.phase === 'conflict' && result.value.connected;
      this.update({
        phase: conflict ? 'conflict' : result.value.connected ? 'connected' : 'offline',
        configured: result.value.configured,
        connected: result.value.connected,
        code: conflict ? 'SHIGUANG_STATE_CONFLICT' : result.value.code,
        error: conflict ? 'SHIGUANG_STATE_CONFLICT' : result.value.connected ? null : result.value.code,
      });
    } catch {
      this.update({ phase: 'offline', connected: false, code: 'NODEGATEWAY_STATUS_FAILED', error: 'NODEGATEWAY_STATUS_FAILED' });
    }
  }

  async pullNow(): Promise<SyncSnapshot> {
    if (this.snapshot.busy && this.snapshot.phase !== 'initializing') return this.snapshot;
    this.update({ busy: true, error: null });
    try {
      if (!this.gateway) throw new Error('NODEGATEWAY_IPC_UNAVAILABLE');
      const status = await this.gateway.status();
      if (!status.ok) throw new Error(status.error.code);
      if (!status.value.connected) throw new Error(status.value.code);

      const result = await this.gateway.pullState();
      if (!result.ok) throw new Error(result.error.code);
      if (result.value.status === 'conflict') {
        this.readyForDirtyTracking = true;
        this.update({
          phase: 'conflict', configured: true, connected: true, busy: false,
          code: 'SHIGUANG_STATE_CONFLICT', error: 'SHIGUANG_STATE_CONFLICT',
          headCount: result.value.headCount,
          headVersionIds: result.value.headVersionIds,
          versionId: null,
        });
        return this.snapshot;
      }

      if (result.value.status === 'remote-loaded') {
        this.importState(result.value.state);
        this.baselineFingerprint = stateFingerprint(result.value.state);
        this.update({
          versionId: result.value.versionId,
          headCount: 1,
          headVersionIds: [result.value.versionId],
          lastPulledAt: this.now(),
          dirty: false,
        });
      } else {
        this.baselineFingerprint = stateFingerprint(this.exportState());
        this.update({ headCount: 0, headVersionIds: [], versionId: null, dirty: false });
      }

      this.readyForDirtyTracking = true;
      this.update({
        phase: 'connected', configured: status.value.configured, connected: true,
        busy: false, code: status.value.code, error: null,
      });
      return this.snapshot;
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'NODEGATEWAY_UNKNOWN_ERROR';
      this.readyForDirtyTracking = true;
      this.update({ phase: 'offline', connected: false, busy: false, code, error: code });
      return this.snapshot;
    }
  }

  markLocalState(state: ShiguangState): void {
    if (!this.readyForDirtyTracking || this.snapshot.phase === 'conflict') return;
    this.update({ dirty: stateFingerprint(state) !== this.baselineFingerprint });
  }

  async submitNow(): Promise<SyncSnapshot> {
    if (this.snapshot.busy) return this.snapshot;
    if (this.snapshot.phase === 'conflict') throw new Error('SHIGUANG_STATE_CONFLICT');
    this.update({ busy: true, error: null });
    try {
      if (!this.gateway) throw new Error('NODEGATEWAY_IPC_UNAVAILABLE');
      const state = this.exportState();
      const result = await this.gateway.pushState(state);
      if (!result.ok) throw new Error(result.error.code);
      this.baselineFingerprint = stateFingerprint(state);
      this.update({
        phase: 'connected', connected: true, busy: false, dirty: false,
        code: 'SHIGUANG_STATE_SUBMITTED', error: null,
        versionId: result.value.version_id,
        headCount: 1,
        headVersionIds: [result.value.version_id],
        lastSubmittedAt: this.now(),
        submitStatus: result.value.status,
      });
      return this.snapshot;
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'NODEGATEWAY_UNKNOWN_ERROR';
      this.update({ busy: false, code, error: code });
      throw cause;
    }
  }
}
