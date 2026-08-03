# 拾光

> 面向全厂网络与信息化工作的个人工作台
> React 19 · TypeScript · Vite · Tailwind CSS v4 · Electron

## 当前能力

- 今日工作台：集中显示待处理、处理中、逾期和项目信息
- 收件箱：把零散输入整理为可执行事项
- 工作事项：统一管理任务、服务请求、故障、变更和巡检
- 信息化项目：项目与工作事项关联，完成度只来自真实记录
- 设备资产：登记网络设备、服务器、终端和系统台账
- 资料知识：登记制度、方案、手册、故障知识和复盘资料
- 工作统计：仅统计当前工作台真实数据，不展示演示指标
- 设置：外观、本地持久化和 NodeGateway 人工同步

## 数据原则

- 浏览器与 Electron 均支持本地持久化
- 应用状态保持 `paw.shiguang.state.v1`，继续兼容既有 NodeGateway
- 拾光不直连 COS，不持有 COS 或 CAM 凭据
- 启动只读拉取，远端提交必须由用户在设置页主动触发
- 多远端 head 或删除提案状态会阻断提交，不做自动覆盖
- 未接入的外部来源、附件上传、SLA 和 AI 指标不会伪装成可用

## 快速开始

```bash
npm install
npm run dev
npm run build
npm run test:gateway
```

## 目录结构

```text
src/
  components/
    layout/        # 侧栏与全局搜索
    modals/        # 新增事项弹窗
    ui/            # LiquidModal、LiquidSelect、页面过渡
  context/         # 工作台状态与 NodeGateway 同步状态
  lib/             # 状态合同、同步控制器、工作台语义和测试
  pages/           # 八个工作台页面
  index.css        # Liquid Glass 设计系统和响应式布局
electron/          # 主进程、预加载与六接口安全桥
```

## NodeGateway 安全接入

```text
React renderer → preload 固定 IPC → Electron main → 127.0.0.1 NodeGateway → PAW/COS
```

主进程继续使用既有六条 Shiguang 路由，renderer 只获得实时状态、拉取状态和提交状态三个高层能力。生产启动通过固定 DPAPI helper 读取令牌，并在全局 README 门禁通过后处理业务请求。此次工作台改造没有修改 C·ONE，也没有扩展或绕过 NodeGateway 契约。

## 验证

```bash
npm run test:gateway
npm run build
```

## License

MIT
