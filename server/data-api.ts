/**
 * 旧 Vite 明文 WeFlow 数据桥已停用。
 *
 * 拾光只能通过 Electron preload 暴露的固定 IPC 调用本机 NodeGateway。
 * 本文件保留为显式闭锁，防止旧 import 被恢复后静默重新暴露生产数据。
 */
import type { Plugin } from 'vite';

export function dataApiPlugin(): Plugin {
  throw new Error('SHIGUANG_LEGACY_DATA_API_RETIRED');
}
