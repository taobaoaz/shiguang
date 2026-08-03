# 拾光

> 个人生产管理平台 · Liquid Glass 暗黑设计
> React 19 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · Electron

---

## 特性

- **Liquid Glass** 暗黑材质（blur / 顶缘高光 / 透光）
- **8 大模块**：生产任务 · 产线总览 · 化验报告 · 量仓管理 · 设备台账 · 生产指标 · 转产记录 · 设置
- **3D CoverFlow** 文档堆：滚轮切卡、自适应尺寸
- **项目时间线** 按真实日期对齐甘特条 + 周/双周/月尺度
- **LiquidSelect** 全站无原生 `<select>`
- **Electron 桌面打包**（NSIS 安装器）
- **PAW NodeGateway 安全桥**（Electron renderer → preload IPC → main process → loopback NodeGateway）

---

## 模块

| 模块 | 能力 |
|------|------|
| 生产任务 | KPI、看板分组、CoverFlow、Gantt 时间线、AI 智能详情 |
| 产线总览 | 健康度 / 风险 / 团队 Tab、模块进度下钻 |
| 化验报告 | 分类搜索、上传、预览、下载 |
| 量仓管理 | 月 / 周 / 日视图、优先级筛选 |
| 设备台账 | 成员矩阵、设备状态 |
| 生产指标 | 周期切换、KPI、提效建议、风险 |
| 转产记录 | 搜索、分类、收藏 |
| 设置中心 | 主题 / 模糊 / 通知 / 账号 / 系统 |

---

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`） |
| 动效 | Framer Motion |
| 图标 | Lucide React |
| 桌面 | Electron + electron-builder |
| 反馈 | canvas-confetti |

---

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 生产构建
npm run build

# Electron 桌面打包
npm run build && npx electron-builder --win
```

---

## 目录结构

```text
src/
  components/
    dashboard/     # KPI · 看板 · CoverFlow · 时间线 · 智能详情
    layout/        # Sidebar · TopBar
    modals/        # 任务 / 通知 / 文档预览等
    ui/            # LiquidModal · LiquidSelect · GlassCard · 过渡
  context/         # 全局状态
  pages/           # 8 个功能页
  lib/             # 动效 tokens · 数据 hooks
  index.css        # 液态玻璃 + 流体布局
electron/           # 主进程 · 预加载
server/             # 已闭锁的旧明文数据桥占位
DESIGN.md           # 设计系统规范
```

## NodeGateway 安全接入

拾光不会直接读取 WeFlow 文件，不会持有 COS/CAM 凭据，也不会从 renderer 访问环境变量。连接固定经过：

```text
React renderer → preload 固定 IPC → Electron main → 127.0.0.1 NodeGateway → PAW/COS
```

主进程内部适配 NodeGateway 的六条 Shiguang 路由；renderer 只得到三个高层固定 IPC：实时状态探测、拉取 `shiguang-state`、提交 `shiguang-state`。通用内容/版本/删除原语不向 renderer 暴露。所有输入和响应均拒绝未知字段；URL 只能是带明确端口的数字 loopback HTTP 地址。浏览器开发模式没有 preload 时保持断开，不回退到 HTTP 明文桥。

生产启动不接收环境变量 token。Electron 主进程通过固定绝对路径调用 `codex-ops` 的 `client-token-stdio` DPAPI helper，以带长度前缀的 JCS JSON 管道协议把 token 仅加载到主进程内存；helper 的超时、帧长、字段、nonce 或 token 校验失败都会阻断启动。环境变量 token 只允许 `--dev` 本地测试，真实 token 不得写入仓库、renderer、日志或截图。拾光使用独立身份 `home-pc-01/shiguang/main`；`agent_boot_id` 由主进程每次启动生成，不从环境注入。主进程会先完整获取全局 README，核对 UTF-8 字节数与 SHA-256，并提交绑定本次启动的读取回执；只有门禁成功后才附带 `X-Agent-Boot-Id` 调用业务接口。

拾光应用状态固定为 `paw.shiguang.state.v1`，逻辑文件 ID 为 `shiguang-state`，数据级别为 L2。启动时只拉取：无远端 head 时保留本地状态；唯一 head 时校验内容摘要后导入；多 head 或 deletion-proposed 时显示冲突且不覆盖。设置中心提供“从 PAW 拉取”和“提交当前版本”两个明确操作；提交只创建 `CREATE` 或基于唯一 head 的 `MODIFY` 不可变版本，不执行 Last-Writer-Wins、覆盖写或硬删除。删除能力只生成待审提案。

验证：

```bash
npm run test:gateway
npm run build
```

---

## License

MIT
