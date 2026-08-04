import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { ShiguangSyncController, type SyncSnapshot } from '@/lib/shiguangSync';

interface ShiguangSyncContextValue extends SyncSnapshot {
  refresh: () => Promise<void>;
  pullNow: () => Promise<SyncSnapshot>;
  submitNow: () => Promise<SyncSnapshot>;
}

const ShiguangSyncContext = createContext<ShiguangSyncContextValue | undefined>(undefined);

export const ShiguangSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { exportShiguangState, importShiguangState, autoPull, syncIntervalMinutes } = useApp();
  const exportRef = useRef(exportShiguangState);
  const importRef = useRef(importShiguangState);
  exportRef.current = exportShiguangState;
  importRef.current = importShiguangState;

  const controllerRef = useRef<ShiguangSyncController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new ShiguangSyncController(
      window.shiguangGateway,
      (state) => importRef.current(state),
      () => exportRef.current(),
    );
  }
  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState(controller.getSnapshot());

  useEffect(() => controller.subscribe(setSnapshot), [controller]);
  useEffect(() => controller.configurePolling(autoPull, syncIntervalMinutes * 60_000), [autoPull, controller, syncIntervalMinutes]);
  useEffect(() => {
    void controller.start();
    return () => controller.stop();
  }, [controller]);
  useEffect(() => {
    controller.markLocalState(exportShiguangState());
  }, [controller, exportShiguangState]);

  return (
    <ShiguangSyncContext.Provider value={{
      ...snapshot,
      refresh: () => controller.refreshStatus(),
      pullNow: () => controller.pullNow(),
      submitNow: () => controller.submitNow(),
    }}>
      {children}
    </ShiguangSyncContext.Provider>
  );
};

export function useShiguangSync(): ShiguangSyncContextValue {
  const context = useContext(ShiguangSyncContext);
  if (!context) throw new Error('useShiguangSync must be used within ShiguangSyncProvider');
  return context;
}
