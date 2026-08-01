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
- **COS 工作区数据桥**（`server/data-api.ts`）

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
server/             # COS 数据桥 API
DESIGN.md           # 设计系统规范
```

---

## License

MIT
