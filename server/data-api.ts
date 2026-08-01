/**
 * Vite 插件：内嵌生产数据 API（COS 数据桥）
 * 零依赖，直接在 Vite dev server 中暴露 REST 端点
 * 数据源：../weflow-messages/messages.jsonl
 */
import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

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

let _cache: GroupData[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;
const DATA_DIR = path.resolve(__dirname, '../../weflow-messages');

function json(res: any, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data, null, 2));
}

function loadAndAggregate(): GroupData[] {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

  try {
    const fp = path.join(DATA_DIR, 'messages.jsonl');
    if (!fs.existsSync(fp)) return [];

    const lines = fs.readFileSync(fp, 'utf-8').trim().split('\n').filter(Boolean);
    const messages: Message[] = [];
    const recent = lines.slice(-10000);
    for (const line of recent) {
      try {
        const msg = JSON.parse(line);
        if (msg.group && msg.sender) messages.push(msg);
      } catch {}
    }

    const groups = ['统计', '化验', '指标'];
    const today = new Date().toISOString().slice(0, 10);

    _cache = groups.map(group => {
      const gm = messages.filter(m => m.group === group);
      const td = gm.filter(m => m.time?.startsWith(today));
      return {
        group,
        latestMessages: gm.slice(-10).reverse(),
        totalCount: gm.length,
        todayCount: td.length,
        lastUpdate: gm.length > 0 ? gm[gm.length - 1].time : null,
      };
    });
    _cacheTime = now;
    return _cache;
  } catch {
    return [];
  }
}

export function dataApiPlugin(): Plugin {
  return {
    name: 'wenxibuddy-data-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // 在 Vite 内置中间件**之前**注入，防止 SPA fallback 吞掉 API 请求
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const p = url.pathname;

        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          // /api/production/workspace
          if (p === '/api/production/workspace') {
            const data = loadAndAggregate();
            return json(res, {
              connected: true,
              dataSource: 'weflow-messages',
              groups: data.map(g => ({
                name: g.group,
                total: g.totalCount,
                today: g.todayCount,
                lastUpdate: g.lastUpdate,
              })),
              totalMessages: data.reduce((s, g) => s + g.totalCount, 0),
            });
          }

          // /api/production/groups
          if (p === '/api/production/groups') {
            return json(res, loadAndAggregate());
          }

          // /api/production/group/:name
          const gm = p.match(/^\/api\/production\/group\/(.+)$/);
          if (gm) {
            const name = decodeURIComponent(gm[1]);
            const data = loadAndAggregate();
            const g = data.find(d => d.group === name);
            return g ? json(res, g) : json(res, { error: '群组不存在' }, 404);
          }

          // /api/production/sync — 手动刷新缓存
          if (p === '/api/production/sync') {
            _cache = null;
            _cacheTime = 0;
            const data = loadAndAggregate();
            return json(res, { ok: true, groups: data.length, refreshed: new Date().toISOString() });
          }
        }

        next();
      });
    },
  };
}
